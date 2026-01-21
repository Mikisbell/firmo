/**
 * Zones API - GET and POST
 * Gestión de zonas/pisos del restaurante
 * 
 * Requirements: 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreateZoneSchema, ZoneQuerySchema } from '@/src/core/admin/schemas/zone.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId, getLocationId } from '@/src/core/config/location';

const TENANT_ID = getTenantId();
const LOCATION_ID = getLocationId();

// GET - List all zones with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_zones' }, 'Listing zones');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = ZoneQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'zones',
      params.page,
      params.limit,
      validatedQuery.is_active !== undefined ? String(validatedQuery.is_active) : 'all',
      validatedQuery.is_outdoor !== undefined ? String(validatedQuery.is_outdoor) : 'all',
      validatedQuery.is_smoking !== undefined ? String(validatedQuery.is_smoking) : 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_zones_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Zones retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = { 
      tenant_id: TENANT_ID,
      location_id: LOCATION_ID,
    };
    if (validatedQuery.is_active !== undefined) {
      where.is_active = validatedQuery.is_active;
    }
    if (validatedQuery.is_outdoor !== undefined) {
      where.is_outdoor = validatedQuery.is_outdoor;
    }
    if (validatedQuery.is_smoking !== undefined) {
      where.is_smoking = validatedQuery.is_smoking;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.zones.count({ where });
    logPerformance('db_count_zones', Date.now() - dbStart, { total });

    // Get paginated zones with table count
    const queryStart = Date.now();
    const zones = await prisma.zones.findMany({
      where,
      orderBy: { sort_order: 'asc' },
      skip: params.skip,
      take: params.limit,
      include: {
        _count: { select: { tables: true } },
      },
    });
    logPerformance('db_query_zones', Date.now() - queryStart, { 
      count: zones.length,
      page: params.page,
      limit: params.limit,
    });

    // Transform response
    const transformedZones = zones.map(z => ({
      ...z,
      tables_count: z._count.tables,
    }));

    // Create response
    const response = createPaginatedResponse(transformedZones, total, params);

    // Cache for 5 minutes (zones don't change often)
    await cache.set(cacheKey, response, 300);

    log.info({
      operation: 'list_zones_success',
      count: zones.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Zones listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_zones_validation_error',
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
      operation: 'list_zones_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list zones');
    
    return NextResponse.json(
      { error: 'Error al obtener zonas' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new zone
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
    log.info({ operation: 'create_zone' }, 'Creating new zone');
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = CreateZoneSchema.parse(body);
    const { code, name, color, is_outdoor, is_smoking, has_ac, sort_order, is_active } = validatedData;

    // Check for duplicate code
    const checkStart = Date.now();
    const existing = await prisma.zones.findFirst({
      where: { 
        tenant_id: TENANT_ID,
        location_id: LOCATION_ID,
        code,
      },
    });
    logPerformance('db_check_duplicate_zone', Date.now() - checkStart);

    if (existing) {
      log.warn({
        operation: 'create_zone_duplicate',
        code,
      }, 'Zone code already exists');
      
      return NextResponse.json(
        { error: 'El código de zona ya existe' },
        { status: 409 }
      );
    }

    // Create zone in transaction with audit trail
    const txStart = Date.now();
    const zone = await prisma.$transaction(async (tx) => {
      const newZone = await tx.zones.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          code,
          name,
          color,
          is_outdoor,
          is_smoking,
          has_ac,
          sort_order,
          is_active,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'zones',
          metadata: { record_id: newZone.id },
          created_at: new Date(),
        },
      });

      return newZone;
    });
    logPerformance('db_transaction_create_zone', Date.now() - txStart);

    // Invalidate zones cache
    await cache.invalidatePattern('zones:*');

    // Record business metrics
    metrics.increment('zones_created_total', {
      tenant_id: TENANT_ID,
      location_id: LOCATION_ID,
    });

    // Update active zones gauge
    const activeCount = await prisma.zones.count({
      where: { 
        tenant_id: TENANT_ID,
        location_id: LOCATION_ID,
        is_active: true,
      },
    });
    metrics.set('zones_active', activeCount, {
      tenant_id: TENANT_ID,
      location_id: LOCATION_ID,
    });

    // Log audit event
    logAudit('CREATE', 'zones', authResult.user.id, {
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneName: zone.name,
    });

    log.info({
      operation: 'create_zone_success',
      zoneId: zone.id,
      zoneCode: zone.code,
      zoneName: zone.name,
      durationMs: Date.now() - startTime,
    }, 'Zone created successfully');

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_zone_validation_error',
        errors: error.errors,
      }, 'Invalid zone data');
      
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
      operation: 'create_zone_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create zone');
    
    return NextResponse.json(
      { error: 'Error al crear zona' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
