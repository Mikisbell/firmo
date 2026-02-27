/**
 * Orders API - Root Endpoint
 * GET - List all orders for current user/terminal
 * 
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - orderStatus: Filter by order status
 * - terminalId: Filter by terminal ID
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId();
    
    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Get filter parameters
    const searchParams = request.nextUrl.searchParams;
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

    // Get orders with pagination
    const orders = await prisma.orders.findMany({
      where,
      skip: params.skip,
      take: params.limit,
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

    // Return standardized paginated response
    return NextResponse.json(createPaginatedResponse(orders, total, params));
  } catch (error) {
    console.error('Error fetching orders:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al obtener órdenes' },
      { status: 500 }
    );
  }
}
