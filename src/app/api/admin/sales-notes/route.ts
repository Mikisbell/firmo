/**
 * Admin Sales Notes API - GET (listar notas de venta)
 *
 * Lista paginada con filtros: estado, rango de fechas, busqueda (serie/numero).
 * Requiere auth de admin. tenant_id SIEMPRE desde el JWT.
 *
 * @module app/api/admin/sales-notes/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { z, ZodError } from 'zod';

const SalesNoteQuerySchema = z.object({
  status: z.enum(['OPEN', 'CONVERTED', 'VOIDED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = SalesNoteQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      tenant_id: authResult.user.tenantId,
    };

    if (params.status) where.status = params.status;

    if (params.from || params.to) {
      const dateFilter: Record<string, Date> = {};
      if (params.from) dateFilter.gte = params.from;
      if (params.to) dateFilter.lte = params.to;
      where.created_at = dateFilter;
    }

    if (params.search) {
      where.OR = [
        { serie: { contains: params.search } },
        { numero: { contains: params.search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.sales_notes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          serie: true,
          numero: true,
          total_cents: true,
          status: true,
          invoice_id: true,
          invoice_type: true,
          converted_at: true,
          voided_at: true,
          created_at: true,
        },
      }),
      prisma.sales_notes.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al listar notas de venta' }, { status: 500 });
  }
}
