/**
 * Terminals API - GET
 * 
 * Requirements: 5.1
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { TerminalQuerySchema } from '@/src/core/admin/schemas/terminal.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// GET - List all terminals with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_terminals' }, 'Listing terminals');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = TerminalQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'terminals',
      params.page,
      params.limit,
      validatedQuery.is_allowed !== undefined ? String(validatedQuery.is_allowed) : 'all',
      validatedQuery.station_id ?? 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_terminals_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Terminals retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = { tenant_id: TENANT_ID };
    if (validatedQuery.is_allowed !== undefined) {
      where.is_allowed = validatedQuery.is_allowed;
    }
    if (validatedQuery.station_id) {
      where.station_id = validatedQuery.station_id;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.terminals.count({ where });
    logPerformance('db_count_terminals', Date.now() - dbStart, { total });

    // Get paginated terminals
    const queryStart = Date.now();
    const terminals = await prisma.terminals.findMany({
      where,
      orderBy: { terminal_id: 'asc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        terminal_id: true,
        station_id: true,
        is_allowed: true,
        last_seen_at: true,
      },
    });
    logPerformance('db_query_terminals', Date.now() - queryStart, { 
      count: terminals.length,
      page: params.page,
      limit: params.limit,
    });

    // Create response
    const response = createPaginatedResponse(terminals, total, params);

    // Cache for 2 minutes (terminals status changes frequently)
    await cache.set(cacheKey, response, 120);

    // Record business metrics
    const activeCount = terminals.filter(t => t.is_allowed).length;
    metrics.set('terminals_active', activeCount, {
      tenant_id: TENANT_ID,
    });
    metrics.set('terminals_total', total, {
      tenant_id: TENANT_ID,
    });

    log.info({
      operation: 'list_terminals_success',
      count: terminals.length,
      total,
      activeCount,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Terminals listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_terminals_validation_error',
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
      operation: 'list_terminals_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list terminals');
    
    return NextResponse.json(
      { error: 'Error al obtener terminales' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
