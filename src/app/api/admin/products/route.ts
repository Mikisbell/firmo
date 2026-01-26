/**
 * Products API - GET (list) and POST (create)
 * Requirements: 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 10.4
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { CreateProductSchema, ProductQuerySchema } from '@/src/core/admin/schemas/product.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics, MetricNames } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

// GET - List all products with pagination
async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'list_products' }, 'Listing products');
    
    // Parse and validate query parameters with Zod
    const queryParams = Object.fromEntries(request.nextUrl.searchParams);
    const validatedQuery = ProductQuerySchema.parse(queryParams);
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Generate cache key
    const cacheKey = generateCacheKey(
      'products',
      params.page,
      params.limit,
      validatedQuery.is_active !== undefined ? String(validatedQuery.is_active) : 'all',
      validatedQuery.category ?? 'all',
      validatedQuery.station ?? 'all'
    );

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'list_products_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Products retrieved from cache');
      return NextResponse.json(cached);
    }

    // Build where clause
    const where: any = { tenant_id: TENANT_ID };
    if (validatedQuery.is_active !== undefined) {
      where.is_active = validatedQuery.is_active;
    }
    if (validatedQuery.category) {
      where.category = validatedQuery.category;
    }
    if (validatedQuery.station) {
      where.station = validatedQuery.station;
    }

    // Get total count
    const dbStart = Date.now();
    const total = await prisma.products.count({ where });
    logPerformance('db_count_products', Date.now() - dbStart, { total });

    // Get paginated products
    const queryStart = Date.now();
    const products = await prisma.products.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        sku: true,
        name: true,
        short_name: true,
        price_cents: true,
        category: true,
        station: true,
        type: true,
        is_active: true,
      },
    });
    logPerformance('db_query_products', Date.now() - queryStart, { 
      count: products.length,
      page: params.page,
      limit: params.limit,
    });

    // Create response
    const response = createPaginatedResponse(products, total, params);

    // Cache for 60 seconds
    await cache.set(cacheKey, response, 60);

    log.info({
      operation: 'list_products_success',
      count: products.length,
      total,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Products listed successfully');

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'list_products_validation_error',
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
      operation: 'list_products_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to list products');
    
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);

// POST - Create new product
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
    log.info({ operation: 'create_product' }, 'Creating new product');
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = CreateProductSchema.parse(body);
    const { sku, name, short_name, price_cents, category, station, type = 'SIMPLE', is_active = true } = validatedData;

    // Check SKU uniqueness
    const existingSku = await prisma.products.findFirst({
      where: {
        tenant_id: TENANT_ID,
        sku,
      },
    });

    if (existingSku) {
      log.warn({
        operation: 'create_product_duplicate_sku',
        sku,
        name,
      }, 'Attempted to create product with duplicate SKU');
      
      return NextResponse.json(
        { error: 'Este SKU ya está en uso' },
        { status: 409 }
      );
    }

    // Create product in transaction with audit trail and catalog version increment
    const txStart = Date.now();
    const product = await prisma.$transaction(async (tx: any) => {
      const newProduct = await tx.products.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          sku,
          name,
          short_name: short_name || null,
          price_cents,
          category,
          station,
          type,
          is_active,
        },
      });

      // Increment catalog version
      await tx.catalog_meta.upsert({
        where: { tenant_id: TENANT_ID },
        create: {
          tenant_id: TENANT_ID,
          catalog_version: 1,
          updated_at: new Date(),
        },
        update: {
          catalog_version: { increment: 1 },
          updated_at: new Date(),
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'CREATE',
          resource: 'products',
          metadata: { record_id: newProduct.id },
          created_at: new Date(),
        },
      });

      return newProduct;
    });
    logPerformance('db_transaction_create_product', Date.now() - txStart);

    // Invalidate products cache
    await cache.invalidatePattern('products:*');

    // Record business metrics
    metrics.increment('products_created_total', {
      category: product.category,
      station: product.station,
      tenant_id: TENANT_ID,
    });

    // Update active products gauge
    const activeCount = await prisma.products.count({
      where: { tenant_id: TENANT_ID, is_active: true },
    });
    metrics.set('products_active', activeCount, {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('CREATE', 'products', authResult.user.id, {
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      productCategory: product.category,
    });

    log.info({
      operation: 'create_product_success',
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      durationMs: Date.now() - startTime,
    }, 'Product created successfully');

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'create_product_validation_error',
        errors: error.errors,
      }, 'Invalid product data');
      
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
      operation: 'create_product_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to create product');
    
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    );
  }
}

export const POST = withRequestLogging(handlePOST);
