// src/app/api/admin/stations/[id]/orders/route.ts
// GET endpoint for active orders at a station
// Created: 22 Enero 2026

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { pinoLogger } from '@/src/core/observability/logger-pino';

const prisma = new PrismaClient();

interface OrderItem {
  itemId: string;
  productName: string;
  quantity: number;
  status: string;
}

interface StationOrder {
  orderId: string;
  orderNumber: number;
  tableNumber?: string;
  items: OrderItem[];
  waitTime: number;
  status: string;
  createdAt: string;
}

/**
 * GET /api/admin/stations/:id/orders
 * 
 * Returns active orders for a specific KDS station
 * 
 * Query params:
 * - limit: Max orders to return (default: 50)
 * - offset: Pagination offset (default: 0)
 * 
 * Authentication: Admin only (TODO: Add auth middleware)
 * 
 * Response:
 * {
 *   orders: StationOrder[];
 *   total: number;
 *   hasMore: boolean;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // TODO: Add admin authentication check
    // const session = await getSession(request);
    // if (!session || session.role !== 'ADMIN') {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    pinoLogger.info({ stationId: id, limit, offset }, 'Fetching station orders');

    // Get station by ID to find the code
    const station = await prisma.stations.findUnique({
      where: { id },
      select: { code: true, tenant_id: true },
    });

    if (!station) {
      pinoLogger.warn({ stationId: id }, 'Station not found');
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Query active orders that have items for this station
    // Active = fulfillment_status in ('COOKING', 'READY') and order_status != 'CANCELLED'
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: station.tenant_id,
        order_status: { not: 'CANCELLED' },
        fulfillment_status: { in: ['COOKING', 'READY'] },
      },
      select: {
        id: true,
        order_number: true,
        items: true,
        fulfillment: true,
        created_at: true,
        fulfillment_status: true,
      },
      orderBy: {
        created_at: 'asc', // Oldest first (most urgent)
      },
      skip: offset,
      take: limit + 1, // Fetch one extra to check if there are more
    });

    // Filter orders that have items for this station
    const now = new Date();
    const stationOrders: StationOrder[] = [];

    for (const order of orders.slice(0, limit)) {
      const items = order.items as any[];
      const stationItems = items.filter(
        (item: any) => item.station === station.code
      );

      if (stationItems.length === 0) {
        continue; // Skip orders without items for this station
      }

      // Calculate wait time in minutes
      const waitTime = Math.floor(
        (now.getTime() - order.created_at.getTime()) / 60000
      );

      // Determine overall status for this station's items
      const statuses = stationItems.map((item: any) => item.status);
      let overallStatus = 'PENDING';
      if (statuses.every((s: string) => s === 'DONE')) {
        overallStatus = 'READY';
      } else if (statuses.some((s: string) => s === 'COOKING')) {
        overallStatus = 'COOKING';
      }

      // Extract table number from fulfillment
      const fulfillment = order.fulfillment as any;
      const tableNumber = fulfillment?.table_number;

      stationOrders.push({
        orderId: order.id,
        orderNumber: order.order_number,
        tableNumber,
        items: stationItems.map((item: any) => ({
          itemId: item.line_id,
          productName: item.name,
          quantity: item.qty,
          status: item.status,
        })),
        waitTime,
        status: overallStatus,
        createdAt: order.created_at.toISOString(),
      });
    }

    // Sort by wait time (most urgent first)
    stationOrders.sort((a, b) => b.waitTime - a.waitTime);

    const hasMore = orders.length > limit;
    const total = stationOrders.length;

    pinoLogger.info(
      { stationId: id, total, hasMore },
      'Station orders fetched'
    );

    return NextResponse.json({
      orders: stationOrders,
      total,
      hasMore,
    });
  } catch (error) {
    pinoLogger.error(
      { error, stationId: params.id },
      'Error fetching station orders'
    );

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
