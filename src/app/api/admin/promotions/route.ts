/**
 * Promotions API - GET and POST
 * Requirements: 6.2, 6.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreatePromotionSchema, PromotionQuerySchema } from '@/src/core/admin/schemas/promotion.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

// GET - List all promotions with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_promotions' }, 'Listing promotions');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = PromotionQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'promotions',
      params.page,
      params.limit,
      validatedQuery.is_active !== undefined ? String(validatedQuery.is_active) : 'all',
      validatedQuery.type ?? 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_promotions_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Promotions retrieved from cache');
      return NextResponse.json(cached);
    }

    const now = new Date();
    
    // LAZY EVALUATION: Don't deactivate in GET request
    // Instead, filter out expired promotions in the query
    // Background job handles actual deactivation every 5 minutes
    
    // Build where clause with lazy expiration check
    let where: any = { tenant_id: TENANT_ID };
    
    // Handle is_active filter
    if (validatedQuery.is_active === true) {
      // Only active promotions that haven't expired
      where.is_active = true;
      where.ends_at = { gte: now };
    } else if (validatedQuery.is_active === false) {
      // Only inactive promotions
      where.is_active = false;
    } else {
      // All promotions (both active and inactive)
      // But filter out expired active ones from results
      where.OR = [
        { is_active: false },
        { 
          is_active: true,
          ends_at: { gte: now },
        },
      ];
    }
    
    // Handle type filter
    if (validatedQuery.type) {
      where.type = validatedQuery.type;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.promotions.count({ where });
    logPerformance('db_count_promotions', Date.now() - dbStart, { total });

    // Get paginated promotions
    const queryStart = Date.now();
    const promotions = await prisma.promotions.findMany({
      where,
      orderBy: { starts_at: 'desc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        name: true,
        type: true,
        value: true,
        starts_at: true,
        ends_at: true,
        is_active: true,
      },
    });
    logPerformance('db_query_promotions', Date.now() - queryStart, { 
      count: promotions.length,
      page: params.page,
      limit: params.limit,
    });

    // Create response
    const response = createPaginatedResponse(promotions, total, params);

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    log.info({
      operation: 'list_promotions_success',
      count: promotions.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Promotions listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_promotions_validation_error',
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
      operation: 'list_promotions_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list promotions');
    
    return NextResponse.json(
      { error: 'Error al obtener promociones' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new promotion
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
    log.info({ operation: 'create_promotion' }, 'Creating new promotion');
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = CreatePromotionSchema.parse(body);
    const { name, type, value, rules, starts_at, ends_at, is_active } = validatedData;

    // Create promotion in transaction with audit trail
    const txStart = Date.now();
    const promotion = await prisma.$transaction(async (tx: any) => {
      const newPromotion = await tx.promotions.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          name,
          type,
          value,
          rules: rules ? JSON.parse(JSON.stringify(rules)) : {},
          starts_at: new Date(starts_at),
          ends_at: new Date(ends_at),
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
          resource: 'promotions',
          metadata: { record_id: newPromotion.id },
          created_at: new Date(),
        },
      });

      return newPromotion;
    });
    logPerformance('db_transaction_create_promotion', Date.now() - txStart);

    // Invalidate promotions cache
    await cache.invalidatePattern('promotions:*');

    // Record business metrics
    metrics.increment('promotions_created_total', {
      type: promotion.type,
      tenant_id: TENANT_ID,
    });

    // Update active promotions gauge
    const activeCount = await prisma.promotions.count({
      where: { tenant_id: TENANT_ID, is_active: true },
    });
    metrics.set('promotions_active', activeCount, {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('CREATE', 'promotions', authResult.user.id, {
      promotionId: promotion.id,
      promotionName: promotion.name,
      promotionType: promotion.type,
    });

    log.info({
      operation: 'create_promotion_success',
      promotionId: promotion.id,
      promotionName: promotion.name,
      promotionType: promotion.type,
      durationMs: Date.now() - startTime,
    }, 'Promotion created successfully');

    return NextResponse.json(promotion, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_promotion_validation_error',
        errors: error.errors,
      }, 'Invalid promotion data');
      
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
      operation: 'create_promotion_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create promotion');
    
    return NextResponse.json(
      { error: 'Error al crear promoción' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
