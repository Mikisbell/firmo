/**
 * Tables API - GET and POST
 * Gestión de mesas del restaurante
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreateTableSchema, TableQuerySchema } from '@/src/core/admin/schemas/table.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId, getLocationId } from '@/src/core/config/location';

const TENANT_ID = getTenantId();
const LOCATION_ID = getLocationId();

// GET - List all tables with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_tables' }, 'Listing tables');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = TableQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'tables',
      params.page,
      params.limit,
      validatedQuery.zone_id ?? 'all',
      validatedQuery.active !== undefined ? String(validatedQuery.active) : 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_tables_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Tables retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: Record<string, unknown> = {
      tenant_id: TENANT_ID,
      location_id: LOCATION_ID,
    };
    
    if (validatedQuery.zone_id) where.zone_id = validatedQuery.zone_id;
    if (validatedQuery.active !== undefined) where.is_active = validatedQuery.active;

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.tables.count({ where });
    logPerformance('db_count_tables', Date.now() - dbStart, { total });

    // Get paginated tables
    const queryStart = Date.now();
    const tables = await prisma.tables.findMany({
      where,
      orderBy: [{ zone_id: 'asc' }, { number: 'asc' }],
      skip: params.skip,
      take: params.limit,
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    logPerformance('db_query_tables', Date.now() - queryStart, { 
      count: tables.length,
      page: params.page,
      limit: params.limit,
    });

    const items = tables.map(t => ({
      id: t.id,
      number: t.number,
      display_name: t.display_name,
      capacity: t.capacity,
      shape: t.shape,
      position_x: t.position_x,
      position_y: t.position_y,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status,
      is_active: t.is_active,
      zone_id: t.zone_id,
      zone: t.zones ? {
        id: t.zones.id,
        code: t.zones.code,
        name: t.zones.name,
        color: t.zones.color,
      } : null,
    }));

    // Create response
    const response = createPaginatedResponse(items, total, params);

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    log.info({
      operation: 'list_tables_success',
      count: items.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Tables listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_tables_validation_error',
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
      operation: 'list_tables_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list tables');
    
    return NextResponse.json(
      { error: 'Error al obtener mesas' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new table
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
    log.info({ operation: 'create_table' }, 'Creating new table');
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = CreateTableSchema.parse(body);
    const { number, display_name, zone_id, capacity, shape, position_x, position_y, width, height, rotation, is_active } = validatedData;

    // Check duplicate number
    const existing = await prisma.tables.findFirst({
      where: { tenant_id: TENANT_ID, location_id: LOCATION_ID, number },
    });

    if (existing) {
      log.warn({
        operation: 'create_table_duplicate_number',
        number,
      }, 'Attempted to create table with duplicate number');
      
      return NextResponse.json(
        { error: 'El número de mesa ya existe' },
        { status: 409 }
      );
    }

    // Validate zone exists if provided
    if (zone_id) {
      const zone = await prisma.zones.findFirst({
        where: { id: zone_id, tenant_id: TENANT_ID },
      });
      if (!zone) {
        log.warn({
          operation: 'create_table_invalid_zone',
          zone_id,
        }, 'Attempted to create table with invalid zone');
        
        return NextResponse.json(
          { error: 'Zona no encontrada' },
          { status: 400 }
        );
      }
    }

    // Create table in transaction with audit trail
    const txStart = Date.now();
    const table = await prisma.$transaction(async (tx: any) => {
      const newTable = await tx.tables.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          number,
          display_name: display_name || `Mesa ${number}`,
          zone_id: zone_id || null,
          capacity,
          shape,
          position_x,
          position_y,
          width,
          height,
          rotation,
          is_active,
        },
        include: {
          zones: { select: { id: true, code: true, name: true, color: true } },
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'tables',
          metadata: { record_id: newTable.id },
          created_at: new Date(),
        },
      });

      return newTable;
    });
    logPerformance('db_transaction_create_table', Date.now() - txStart);

    // Invalidate tables cache
    await cache.invalidatePattern('tables:*');

    // Record business metrics
    metrics.increment('tables_created_total', {
      zone_id: zone_id || 'none',
      tenant_id: TENANT_ID,
    });

    // Update active tables gauge
    const activeCount = await prisma.tables.count({
      where: { tenant_id: TENANT_ID, is_active: true },
    });
    metrics.set('tables_active', activeCount, {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('CREATE', 'tables', authResult.user.id, {
      tableId: table.id,
      tableNumber: table.number,
      tableZone: zone_id || 'none',
    });

    log.info({
      operation: 'create_table_success',
      tableId: table.id,
      tableNumber: table.number,
      durationMs: Date.now() - startTime,
    }, 'Table created successfully');

    return NextResponse.json({
      ...table,
      zone: table.zones,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_table_validation_error',
        errors: error.errors,
      }, 'Invalid table data');
      
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
      operation: 'create_table_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create table');
    
    return NextResponse.json(
      { error: 'Error al crear mesa' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
