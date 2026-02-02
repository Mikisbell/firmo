/**
 * Inventory API - Root Endpoint
 * GET - List inventory stock
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
    const search = searchParams.get('search') || '';
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await prisma.inventory.count({ where });

    // Get inventory items
    let items = await prisma.inventory.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        stock: true,
        min_stock: true,
        unit: true,
        location_id: true,
        last_count_at: true,
        updated_at: true,
      },
    });

    // Filter low stock if requested
    if (lowStockOnly) {
      items = items.filter(item => 
        item.min_stock && item.stock <= item.min_stock
      );
    }

    return NextResponse.json({
      data: items,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Error al obtener inventario' },
      { status: 500 }
    );
  }
}
