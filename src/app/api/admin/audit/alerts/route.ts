/**
 * Security Alerts API - GET
 * 
 * Task 10.3 - Terminal Architecture v2
 * Requirements: 6.4
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { queryAlerts, type AlertFilters } from '@/src/core/auth/audit-logger';
import { AuditAlertsQuerySchema } from '@/src/core/admin/schemas/audit.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_audit_alerts' }, 'Getting audit alerts');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = AuditAlertsQuerySchema.parse(queryParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'audit:alerts',
      validatedQuery.terminal_id ?? 'all',
      validatedQuery.severity ?? 'all',
      validatedQuery.acknowledged !== undefined ? String(validatedQuery.acknowledged) : 'all',
      validatedQuery.start_date ?? 'all',
      validatedQuery.end_date ?? 'all',
      validatedQuery.limit ?? 100
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_audit_alerts_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Audit alerts retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build filters
    const filters: AlertFilters = {
      tenant_id: TENANT_ID,
      terminal_id: validatedQuery.terminal_id,
      severity: validatedQuery.severity as any,
      acknowledged: validatedQuery.acknowledged,
      start_date: validatedQuery.start_date ? new Date(validatedQuery.start_date) : undefined,
      end_date: validatedQuery.end_date ? new Date(validatedQuery.end_date) : undefined,
      limit: validatedQuery.limit,
    };

    // Query alerts
    const serviceStart = Date.now();
    const alerts = await queryAlerts(filters);
    logPerformance('service_query_audit_alerts', Date.now() - serviceStart, {
      count: alerts.length,
    });

    const response = {
      alerts,
      count: alerts.length,
      filters: {
        terminal_id: filters.terminal_id,
        severity: filters.severity,
        acknowledged: filters.acknowledged,
        start_date: filters.start_date?.toISOString(),
        end_date: filters.end_date?.toISOString(),
        limit: filters.limit ?? 100,
      },
    };

    // Cache for 1 minute (alerts are time-sensitive)
    await cache.set(cacheKey, response, 60);

    // Record business metrics
    metrics.increment('audit_alerts_requests_total', {
      tenant_id: TENANT_ID,
    });
    metrics.set('audit_alerts_count', alerts.length, {
      tenant_id: TENANT_ID,
    });
    
    // Count by severity
    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;
    metrics.set('audit_alerts_critical', criticalCount, {
      tenant_id: TENANT_ID,
    });
    metrics.set('audit_alerts_high', highCount, {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'get_audit_alerts_success',
      alertsCount: alerts.length,
      criticalCount,
      highCount,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Audit alerts retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_audit_alerts_validation_error',
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
      operation: 'get_audit_alerts_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get audit alerts');
    
    return NextResponse.json(
      { error: 'Error al obtener alertas de seguridad' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
