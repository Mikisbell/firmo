/**
 * Products API - Root Endpoint
 * GET - List all products (delegates to admin endpoint)
 * 
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - search: Search by name, SKU, or short name
 * - category: Filter by category
 * - isActive: Filter by active status (default: true)
 * 
 * Cache Integration: Task 9.7
 * - Cache products with 1-hour TTL (3600s)
 * - Cache key includes tenant, pagination, filters
 * - Invalidate on product updates
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { cache, generateCacheKey, DEFAULT_TTLS } from '@/src/core/cache/cache-service';
import { metrics } from '@/src/core/observability/metrics';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId();
    
    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Get filter parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const isActive = searchParams.get('isActive') !== 'false';

    // Generate cache key based on query parameters
    const cacheKey = generateCacheKey(
      'products',
      tenantId,
      params.page.toString(),
      params.limit.toString(),
      search,
      category,
      isActive.toString()
    );

    // Try to get from cache first (cache-aside pattern)
    const cached = await cache.get<{
      items: any[];
      pagination: any;
    }>(cacheKey);

    if (cached) {
      metrics.increment('cache.hit', { resource: 'products', backend: cache.getType() });
      return NextResponse.json(cached);
    }

    metrics.increment('cache.miss', { resource: 'products', backend: cache.getType() });

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      is_active: isActive,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { short_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    // Get total count
    const total = await prisma.products.count({ where });

    // Get products with pagination
    const products = await prisma.products.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        short_name: true,
        category: true,
        price_cents: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Create standardized paginated response
    const result = createPaginatedResponse(products, total, params);

    // Store in cache with 1-hour TTL and tags for invalidation
    await cache.set(cacheKey, result, {
      ttl: DEFAULT_TTLS.products, // 3600 seconds (1 hour)
      tags: [`tenant:${tenantId}`, 'products'],
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    metrics.increment('api.error', { endpoint: 'products', operation: 'GET' });
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}
