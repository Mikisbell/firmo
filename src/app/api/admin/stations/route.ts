/**
 * Stations API - GET and POST
 * Gestión de estaciones KDS (Kitchen Display System)
 * 
 * Requirements: KDS stations management
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreateStationSchema, StationQuerySchema } from '@/src/core/admin/schemas/station.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';


// GET - List all stations with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    log.info({ operation: 'list_stations' }, 'Listing stations');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = StationQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key with tenantId
    const cacheKey = generateCacheKey(
      'stations',
      tenantId,
      params.page,
      params.limit,
      validatedQuery.is_active !== undefined ? String(validatedQuery.is_active) : 'all',
      validatedQuery.search || 'none'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_stations_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Stations retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause with tenantId from JWT
    const where: any = { 
      tenant_id: tenantId,
    };
    
    // Default: only active stations. Pass is_active=false to see inactive
    if (validatedQuery.is_active !== undefined) {
      where.is_active = validatedQuery.is_active;
    } else {
      where.is_active = true;
    }

    if (validatedQuery.search) {
      where.OR = [
        { code: { contains: validatedQuery.search, mode: 'insensitive' } },
        { name: { contains: validatedQuery.search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.stations.count({ where });
    logPerformance('db_count_stations', Date.now() - dbStart, { total });

    // Get paginated stations with counts
    const queryStart = Date.now();
    const stations = await prisma.stations.findMany({
      where,
      orderBy: { code: 'asc' },
      skip: params.skip,
      take: params.limit,
      include: {
        _count: {
          select: {
            terminals: true,
            printers: true,
          },
        },
      },
    });
    logPerformance('db_query_stations', Date.now() - queryStart, { 
      count: stations.length,
      page: params.page,
      limit: params.limit,
    });

    // Transform response
    const items = stations.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      is_active: s.is_active,
      terminals_count: s._count.terminals,
      printers_count: s._count.printers,
    }));

    // Create response
    const response = createPaginatedResponse(items, total, params);

    // Cache for 5 minutes (stations don't change often)
    await cache.set(cacheKey, response, { ttl: 300, tags: ['stations'] });

    log.info({
      operation: 'list_stations_success',
      count: items.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Stations listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_stations_validation_error',
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
      operation: 'list_stations_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list stations');
    
    return NextResponse.json(
      { error: 'Error al obtener estaciones' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new station
async function handlePOST(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });

  try {
    log.info({ operation: 'create_station' }, 'Creating new station');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = CreateStationSchema.parse(body);
    const { code, name, is_active } = validatedData;

    // Check for duplicate code with tenantId from JWT
    const checkStart = Date.now();
    const existing = await prisma.stations.findFirst({
      where: { 
        tenant_id: tenantId,
        code,
      },
    });
    logPerformance('db_check_duplicate_station', Date.now() - checkStart);

    if (existing) {
      log.warn({
        operation: 'create_station_duplicate',
        code,
      }, 'Station code already exists');
      
      return NextResponse.json(
        { error: 'El código de estación ya existe' },
        { status: 409 }
      );
    }

    // Create station in transaction with audit trail (using tenantId from JWT)
    const txStart = Date.now();
    const station = await prisma.$transaction(async (tx: any) => {
      const newStation = await tx.stations.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          code,
          name,
          is_active,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'stations',
          metadata: { record_id: newStation.id },
          created_at: new Date(),
        },
      });

      return newStation;
    });
    logPerformance('db_transaction_create_station', Date.now() - txStart);

    // Invalidate stations cache
    await cache.invalidatePattern('stations:*');

    // Record business metrics with tenantId from JWT
    metrics.increment('stations_created_total', {
      tenant_id: tenantId,
    });

    // Update active stations gauge with tenantId from JWT
    const activeCount = await prisma.stations.count({
      where: { 
        tenant_id: tenantId,
        is_active: true,
      },
    });
    metrics.set('stations_active', activeCount, {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('CREATE', 'stations', authResult.user.id, {
      stationId: station.id,
      stationCode: station.code,
      stationName: station.name,
    });

    log.info({
      operation: 'create_station_success',
      stationId: station.id,
      stationCode: station.code,
      stationName: station.name,
      durationMs: Date.now() - startTime,
    }, 'Station created successfully');

    return NextResponse.json(station, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_station_validation_error',
        errors: error.errors,
      }, 'Invalid station data');
      
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'create_station_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create station');
    
    return NextResponse.json(
      { error: 'Error al crear estación' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
