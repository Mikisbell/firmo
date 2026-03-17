/**
 * Admin CRM RFM Summary API
 * GET /api/admin/crm/rfm/summary - RFM distribution stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;

    // Get RFM segment distribution
    const distribution = await (prisma as any).$queryRawUnsafe(
      `SELECT
         COALESCE(rfm_segment, 'SIN_DATOS') as segment,
         COUNT(*)::INT as count
       FROM customer_profile
       WHERE tenant_id = $1
       GROUP BY rfm_segment
       ORDER BY count DESC`,
      tenantId,
    );

    // Get last computation time
    const lastComputed = await (prisma as any).customer_profile.findFirst({
      where: { tenant_id: tenantId, rfm_calculated_at: { not: null } },
      select: { rfm_calculated_at: true },
      orderBy: { rfm_calculated_at: 'desc' },
    });

    return NextResponse.json({
      distribution,
      last_computed_at: lastComputed?.rfm_calculated_at ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'Error al obtener resumen RFM' }, { status: 500 });
  }
}
