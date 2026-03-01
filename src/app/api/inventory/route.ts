/**
 * Inventory API - Root Endpoint
 * GET - List inventory stock
 * 
 * Query Parameters:
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - search: Search by code or name
 * - lowStockOnly: Filter low stock items (default: false)
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import { logger } from '@/src/core/observability/structured-logger';

export async function GET(request: NextRequest) {
  try {
    const tenantId = getTenantId();
    
    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Get filter parameters
    const searchParams = request.nextUrl.searchParams;
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

    // Get inventory items with pagination
    let items = await prisma.inventory.findMany({
      where,
      skip: params.skip,
      take: params.limit,
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

    // Convert Decimal fields to numbers
    const convertedItems = items.map(item => ({
      ...item,
      stock: Number(item.stock),
      min_stock: item.min_stock ? Number(item.min_stock) : null,
    })) as any[];

    // Filter low stock if requested (after pagination to maintain accurate counts)
    if (lowStockOnly) {
      const filtered = convertedItems.filter(item => 
        item.min_stock && item.stock <= item.min_stock
      );
      // For low stock filter, we need to recalculate total
      const lowStockTotal = await prisma.inventory.count({
        where: {
          ...where,
          AND: [
            { min_stock: { not: null } },
            { stock: { lte: prisma.inventory.fields.min_stock } }
          ]
        }
      });
      return NextResponse.json(createPaginatedResponse(filtered, lowStockTotal, params));
    }

    return NextResponse.json(createPaginatedResponse(convertedItems, total, params));
  } catch (error) {
    logger.error('Error al obtener inventario', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener inventario' },
      { status: 500 }
    );
  }
}
