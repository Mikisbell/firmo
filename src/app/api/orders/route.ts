/**
 * Orders API - Root Endpoint
 * GET - List all orders for current user/terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId();
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');
    const orderStatus = searchParams.get('orderStatus');
    const terminalId = searchParams.get('terminalId');

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (orderStatus) {
      where.order_status = orderStatus;
    }

    if (terminalId) {
      where.terminal_id = terminalId;
    }

    // Get total count
    const total = await prisma.orders.count({ where });

    // Get orders
    const orders = await prisma.orders.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        order_number: true,
        order_status: true,
        total_cents: true,
        terminal_id: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      data: orders,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Error al obtener órdenes' },
      { status: 500 }
    );
  }
}
