/**
 * Promotions API - List Available Promotions
 * 
 * GET /api/promotions
 * 
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * 
 * Returns all active promotions for the current tenant
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = getTenantId();
    
    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    const now = new Date();
    
    // Build where clause for active promotions
    const where = {
      tenant_id: tenantId,
      is_active: true,
      OR: [
        { starts_at: null, ends_at: null },
        { starts_at: { lte: now }, ends_at: null },
        { starts_at: null, ends_at: { gte: now } },
        { starts_at: { lte: now }, ends_at: { gte: now } },
      ],
    };
    
    // Get total count
    const total = await prisma.promotions.count({ where });
    
    // Get paginated promotions
    const promotions = await prisma.promotions.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: [
        { priority: 'asc' },
        { created_at: 'desc' },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        value: true,
        rules: true,
        starts_at: true,
        ends_at: true,
        is_active: true,
        stackable: true,
        priority: true,
      },
    });

    pinoLogger.info({
      count: promotions.length,
      total,
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Promotions listed');

    // Transform promotions data
    const transformedPromotions = promotions.map(promo => ({
      ...promo,
      rules: promo.rules as any,
      is_currently_active: !promo.starts_at || !promo.ends_at || 
        (promo.starts_at <= now && promo.ends_at >= now),
    }));

    // Return standardized paginated response
    const response = createPaginatedResponse(transformedPromotions, total, params);

    return NextResponse.json({
      success: true,
      ...response,
      // Maintain backward compatibility with 'promotions' key
      promotions: response.items,
      count: total,
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error listing promotions');
    return NextResponse.json(
      { error: 'Failed to list promotions' },
      { status: 500 }
    );
  }
}
