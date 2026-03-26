/**
 * GET /api/admin/delivery/history - Historial de deliveries con filtros
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { DeliveryHistoryQuerySchema } from '@/src/core/admin/schemas/delivery.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  // Extract tenantId from JWT
  const tenantId = authResult.user.tenantId;

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    log.info({ operation: 'get_delivery_history' }, 'Getting delivery history');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = DeliveryHistoryQuerySchema.parse(queryParams);

    // Generate cache key — tenantId MUST be included to prevent cross-tenant leaks
    const cacheKey = generateCacheKey(
      'delivery:history',
      tenantId,
      validatedQuery.dateFrom ?? 'all',
      validatedQuery.dateTo ?? 'all',
      validatedQuery.status ?? 'all',
      validatedQuery.driverId ?? 'all',
      validatedQuery.limit ?? 50,
      validatedQuery.offset ?? 0
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_delivery_history_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Delivery history retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
    };

    if (validatedQuery.dateFrom) {
      where.created_at = {
        ...(where.created_at as object || {}),
        gte: new Date(validatedQuery.dateFrom),
      };
    }

    if (validatedQuery.dateTo) {
      const endDate = new Date(validatedQuery.dateTo);
      endDate.setDate(endDate.getDate() + 1); // Include full day
      where.created_at = {
        ...(where.created_at as object || {}),
        lt: endDate,
      };
    }

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    if (validatedQuery.driverId) {
      where.driver_id = validatedQuery.driverId;
    }

    // Get deliveries with pagination
    const dbStart = Date.now();
    const [deliveries, total] = await Promise.all([
      prisma.delivery_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: validatedQuery.limit,
        skip: validatedQuery.offset,
      }),
      prisma.delivery_orders.count({ where }),
    ]);
    logPerformance('db_query_delivery_history', Date.now() - dbStart, {
      count: deliveries.length,
      total,
    });

    // Get driver names for the deliveries
    const driverIds = [...new Set(deliveries.map((d: any) => d.driver_id).filter(Boolean))] as string[];
    const drivers = driverIds.length > 0
      ? await prisma.drivers.findMany({
          where: { id: { in: driverIds }, tenant_id: tenantId },
          select: { id: true, name: true },
        })
      : [];

    const driverMap = new Map(drivers.map((d: any) => [d.id, d.name]));

    // Enrich deliveries with driver names
    const enrichedDeliveries = deliveries.map((d: any) => ({
      ...d,
      driver_name: d.driver_id ? driverMap.get(d.driver_id) || null : null,
    }));

    const response = {
      deliveries: enrichedDeliveries,
      total,
      limit: validatedQuery.limit,
      offset: validatedQuery.offset,
      hasMore: (validatedQuery.offset ?? 0) + deliveries.length < total,
    };

    // Cache for 2 minutes
    await cache.set(cacheKey, response, { ttl: 120, tags: ['delivery:history'] });

    // Record business metrics
    metrics.increment('delivery_history_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_delivery_history_success',
      deliveriesCount: deliveries.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Delivery history retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'get_delivery_history_validation_error',
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
      operation: 'get_delivery_history_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get delivery history');
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
