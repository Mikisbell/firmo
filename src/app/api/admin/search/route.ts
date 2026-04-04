/**
 * Global Search API — GET /api/admin/search?q=query&limit=5
 *
 * Searches orders (by order_number), employees (by name), and products (by name/SKU)
 * in parallel. Protected with requireAdminAuth — tenant_id from JWT.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { user } = authResult;
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 5, 10);

  if (!q) {
    return NextResponse.json({ orders: [], employees: [], products: [] });
  }

  const isNumeric = /^\d+$/.test(q);

  const [orders, employees, products] = await Promise.all([
    // Orders — search by order_number if numeric
    isNumeric
      ? prisma.orders.findMany({
          where: {
            tenant_id: user.tenantId,
            order_number: { equals: Number(q) },
          },
          select: {
            id: true,
            order_number: true,
            order_type: true,
            total_cents: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),

    // Employees — ILIKE name search
    prisma.employees.findMany({
      where: {
        tenant_id: user.tenantId,
        name: { contains: q, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        role: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    }),

    // Products — ILIKE name OR sku search
    prisma.products.findMany({
      where: {
        tenant_id: user.tenantId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        station: true,
        price_cents: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    }),
  ]);

  return NextResponse.json({ orders, employees, products });
}
