/**
 * Audit Events API - GET
 * 
 * Task 10.3 - Terminal Architecture v2
 * Requirements: 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { queryEvents, type EventFilters } from '@/src/core/auth/audit-logger';
import { AuditEventsQuerySchema } from '@/src/core/admin/schemas/audit.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_audit_events' }, 'Getting audit events');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = AuditEventsQuerySchema.parse(queryParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'audit:events',
      validatedQuery.terminal_id ?? 'all',
      validatedQuery.employee_id ?? 'all',
      validatedQuery.event_type ?? 'all',
      validatedQuery.start_date ?? 'all',
      validatedQuery.end_date ?? 'all',
      validatedQuery.limit ?? 100
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_audit_events_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Audit events retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build filters
    const filters: EventFilters = {
      tenant_id: TENANT_ID,
      terminal_id: validatedQuery.terminal_id,
      employee_id: validatedQuery.employee_id,
      event_type: validatedQuery.event_type as any,
      start_date: validatedQuery.start_date ? new Date(validatedQuery.start_date) : undefined,
      end_date: validatedQuery.end_date ? new Date(validatedQuery.end_date) : undefined,
      limit: validatedQuery.limit,
    };

    // Query events
    const serviceStart = Date.now();
    const events = await queryEvents(filters);
    logPerformance('service_query_audit_events', Date.now() - serviceStart, {
      count: events.length,
    });

    const response = {
      events,
      count: events.length,
      filters: {
        terminal_id: filters.terminal_id,
        employee_id: filters.employee_id,
        event_type: filters.event_type,
        start_date: filters.start_date?.toISOString(),
        end_date: filters.end_date?.toISOString(),
        limit: filters.limit ?? 100,
      },
    };

    // Cache for 2 minutes (audit data doesn't change often)
    await cache.set(cacheKey, response, 120);

    // Record business metrics
    metrics.increment('audit_events_requests_total', {
      tenant_id: TENANT_ID,
    });
    metrics.set('audit_events_count', events.length, {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_audit_events_success',
      eventsCount: events.length,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Audit events retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_audit_events_validation_error',
        errors: error.errors,
      }, 'Invalid query parameters');
      
      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'get_audit_events_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get audit events');
    
    return NextResponse.json(
      { error: 'Error al obtener eventos de auditoría' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
