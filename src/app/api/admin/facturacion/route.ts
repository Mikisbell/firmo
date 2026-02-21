/**
 * Admin Facturación API - GET (list invoices)
 *
 * Paginated list with filters: type, status, date range, search.
 * Requires admin auth.
 *
 * @module app/api/admin/facturacion/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { InvoiceQuerySchema } from '@/src/core/admin/schemas/facturacion.schema';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = InvoiceQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenant_id: authResult.user.tenantId,
    };

    if (params.type) where.invoice_type = params.type;
    if (params.status) where.status = params.status;

    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.gte = params.from;
      if (params.to) dateFilter.lte = params.to;
      where.created_at = dateFilter;
    }

    if (params.search) {
      where.OR = [
        { customer_doc: { contains: params.search } },
        { series: { contains: params.search } },
        { invoice_number: { contains: params.search } },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          invoice_type: true,
          series: true,
          invoice_number: true,
          customer_doc_type: true,
          customer_doc: true,
          total_cents: true,
          status: true,
          created_at: true,
        },
      }),
      prisma.invoices.count({ where }),
    ]);

    return NextResponse.json({
      items: invoices,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al listar facturas' }, { status: 500 });
  }
}
