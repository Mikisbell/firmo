/**
 * Promotions API - List Available Promotions
 * 
 * GET /api/promotions
 * 
 * Returns all active promotions for the current tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const tenantId = getTenantId();
    
    const now = new Date();
    
    // Get all active promotions for this tenant
    const promotions = await prisma.promotions.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { starts_at: null, ends_at: null },
          { starts_at: { lte: now }, ends_at: null },
          { starts_at: null, ends_at: { gte: now } },
          { starts_at: { lte: now }, ends_at: { gte: now } },
        ],
      },
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
      user_id: user.id,
      tenant_id: tenantId,
    }, 'Promotions listed');

    return NextResponse.json({
      success: true,
      promotions: promotions.map(promo => ({
        ...promo,
        rules: promo.rules as any,
        is_currently_active: !promo.starts_at || !promo.ends_at || 
          (promo.starts_at <= now && promo.ends_at >= now),
      })),
      count: promotions.length,
    });

  } catch (error) {
    pinoLogger.error({ error }, 'Error listing promotions');
    return NextResponse.json(
      { error: 'Failed to list promotions' },
      { status: 500 }
    );
  }
}
