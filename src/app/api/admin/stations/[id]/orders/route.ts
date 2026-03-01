// src/app/api/admin/stations/[id]/orders/route.ts
// GET endpoint for active orders at a station
// Created: 22 Enero 2026
// Updated: 01 Febrero 2026 - Added admin authentication middleware

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/tenant';

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
 * Authentication: Admin only (ADMIN, MANAGER, OWNER roles)
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    pinoLogger.info({ 
      stationId: id, 
      limit, 
      offset, 
      userId: user.id,
      userRole: user.role 
    }, 'Fetching station orders');

    // Get station by ID and verify it belongs to the user's tenant
    const station = await prisma.stations.findUnique({
      where: { id },
      select: { code: true, tenant_id: true },
    });

    if (!station) {
      pinoLogger.warn({ stationId: id }, 'Station not found');
      return NextResponse.json(
        { error: 'Estación no encontrada' },
        { status: 404 }
      );
    }

    // Verify tenant isolation - user can only access stations in their tenant
    if (station.tenant_id !== user.tenantId) {
      pinoLogger.warn({ 
        stationId: id, 
        stationTenantId: station.tenant_id,
        userTenantId: user.tenantId 
      }, 'Tenant isolation violation attempt');
      return NextResponse.json(
        { error: 'Acceso denegado - La estación pertenece a otro local' },
        { status: 403 }
      );
    }

    // Query active orders that have items for this station
    // Active = fulfillment_status in ('COOKING', 'READY') and order_status != 'CANCELLED'
    const orders = await prisma.orders.findMany({
      where: {
        tenant_id: user.tenantId,
        order_status: { not: 'CANCELLED' },
        fulfillment_status: { in: ['COOKING', 'READY'] },
        // Check if station is in the stations_active array
        stations_active: { has: station.code },
      },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset,
    });

    // Get total count for pagination
    const total = await prisma.orders.count({
      where: {
        tenant_id: user.tenantId,
        order_status: { not: 'CANCELLED' },
        fulfillment_status: { in: ['COOKING', 'READY'] },
        stations_active: { has: station.code },
      },
    });

    // Map to response format
    const now = new Date();
    const stationOrders: StationOrder[] = orders.map(order => {
      const items: OrderItem[] = (order.items as any[] || []).map((item: any) => ({
        itemId: item.line_id || item.id,
        productName: item.name,
        quantity: item.qty,
        status: item.status || 'PENDING',
      }));

      const waitTime = Math.floor(
        (now.getTime() - new Date(order.created_at).getTime()) / 60000
      );

      return {
        orderId: order.id,
        orderNumber: order.order_number,
        tableNumber: (order.fulfillment as any)?.table_number,
        items,
        waitTime,
        status: order.fulfillment_status,
        createdAt: order.created_at.toISOString(),
      };
    });

    pinoLogger.info({ 
      stationId: id, 
      count: stationOrders.length, 
      total,
      userId: user.id 
    }, 'Station orders fetched successfully');

    return NextResponse.json({
      orders: stationOrders,
      total,
      hasMore: offset + stationOrders.length < total,
    });

  } catch (error) {
    pinoLogger.error({ error, stationId: (await params).id }, 'Error fetching station orders');
    return NextResponse.json(
      { error: 'Error al obtener órdenes de la estación' },
      { status: 500 }
    );
  }
}
