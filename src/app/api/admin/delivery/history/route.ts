/**
 * GET /api/admin/delivery/history - Historial de deliveries con filtros
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status');
    const driverId = searchParams.get('driverId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build where clause
    const where: Record<string, unknown> = {
      tenant_id: TENANT_ID,
    };

    if (dateFrom) {
      where.created_at = {
        ...(where.created_at as object || {}),
        gte: new Date(dateFrom),
      };
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1); // Include full day
      where.created_at = {
        ...(where.created_at as object || {}),
        lt: endDate,
      };
    }

    if (status) {
      where.status = status;
    }

    if (driverId) {
      where.driver_id = driverId;
    }

    // Get deliveries with pagination
    const [deliveries, total] = await Promise.all([
      prisma.delivery_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.delivery_orders.count({ where }),
    ]);

    // Get driver names for the deliveries
    const driverIds = [...new Set(deliveries.map(d => d.driver_id).filter(Boolean))] as string[];
    const drivers = driverIds.length > 0
      ? await prisma.drivers.findMany({
          where: { id: { in: driverIds } },
          select: { id: true, name: true },
        })
      : [];

    const driverMap = new Map(drivers.map(d => [d.id, d.name]));

    // Enrich deliveries with driver names
    const enrichedDeliveries = deliveries.map(d => ({
      ...d,
      driver_name: d.driver_id ? driverMap.get(d.driver_id) || null : null,
    }));

    return NextResponse.json({
      deliveries: enrichedDeliveries,
      total,
      limit,
      offset,
      hasMore: offset + deliveries.length < total,
    });
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
