/**
 * GET /api/delivery/stats/driver/[driverId] — Delivery stats for a specific driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const { driverId } = await params;
    const tenantId = authResult.user.tenantId;

    // Verify driver belongs to tenant
    const driver = await prisma.drivers.findFirst({
      where: { id: driverId, tenant_id: tenantId },
    });

    if (!driver) {
      return NextResponse.json(
        { error: 'Driver no encontrado' },
        { status: 404 }
      );
    }

    const [total, delivered, failed, avgResult] = await Promise.all([
      prisma.delivery_orders.count({
        where: { driver_id: driverId },
      }),
      prisma.delivery_orders.count({
        where: { driver_id: driverId, status: 'DELIVERED' },
      }),
      prisma.delivery_orders.count({
        where: { driver_id: driverId, status: 'FAILED' },
      }),
      prisma.delivery_orders.aggregate({
        where: { driver_id: driverId, status: 'DELIVERED', delivery_time_mins: { not: null } },
        _avg: { delivery_time_mins: true },
      }),
    ]);

    return NextResponse.json({
      total,
      delivered,
      failed,
      avgTimeMins: avgResult._avg.delivery_time_mins
        ? Math.round(avgResult._avg.delivery_time_mins)
        : null,
    });
  } catch (error) {
    logger.error('Error al obtener stats de driver', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
