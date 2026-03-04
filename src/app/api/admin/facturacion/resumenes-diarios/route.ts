/**
 * SUNAT Daily Summaries API — GET (list) and POST (resend)
 *
 * GET: Returns paginated list of daily summaries for tenant.
 * POST: Resend a specific failed/pending summary.
 *
 * Auth: requireAdminPermission('manage_fiscal') — OWNER only.
 *
 * @module app/api/admin/facturacion/resumenes-diarios/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAdminPermission } from '@/src/core/middleware/admin-permission';
import prisma from '@/src/core/db/prisma';
import { createLogger } from '@/src/core/observability';

const log = createLogger('facturacion-resumenes');

// Prisma generic PrismaClient type doesn't expose model accessors — cast required
const dailySummary = prisma.sunat_daily_summary as any;

/** Shape returned by sunat_daily_summary select query */
interface DailySummaryRow {
  id: string;
  tenant_id: string;
  summary_date: Date;
  summary_number: string | null;
  boletas_count: number;
  boletas_total: number;
  ticket_number: string | null;
  sunat_status: string;
  last_error: string | null;
  created_at: Date;
}

// ============================================================================
// GET — Paginated list of daily summaries
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) dateFilter.lte = new Date(to);
      where.summary_date = dateFilter;
    }

    const [items, total] = await Promise.all([
      dailySummary.findMany({
        where,
        orderBy: { summary_date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          tenant_id: true,
          summary_date: true,
          summary_number: true,
          boletas_count: true,
          boletas_total: true,
          ticket_number: true,
          sunat_status: true,
          last_error: true,
          created_at: true,
        },
      }),
      dailySummary.count({ where }),
    ]);

    return NextResponse.json({
      items: (items as DailySummaryRow[]).map((item) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        summary_date: item.summary_date,
        summary_number: item.summary_number,
        boletas_count: item.boletas_count,
        boletas_total_cents: item.boletas_total,
        ticket_number: item.ticket_number,
        sunat_status: item.sunat_status,
        last_error: item.last_error,
        created_at: item.created_at,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    log.error('Failed to list daily summaries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener resúmenes diarios' },
      { status: 500 },
    );
  }
}

// ============================================================================
// POST — Resend a failed/pending summary
// ============================================================================

const ResendSchema = z.object({
  summaryId: z.string().uuid(),
}).strict();

export async function POST(request: NextRequest) {
  const authResult = await requireAdminPermission(request, 'manage_fiscal');
  if (!authResult.authorized) return authResult.response;

  try {
    const tenantId = authResult.user.tenantId;
    const body = await request.json();
    const { summaryId } = ResendSchema.parse(body);

    const summary = await dailySummary.findFirst({
      where: { id: summaryId, tenant_id: tenantId },
    });

    if (!summary) {
      return NextResponse.json(
        { error: 'Resumen no encontrado' },
        { status: 404 },
      );
    }

    if (summary.sunat_status === 'ACCEPTED') {
      return NextResponse.json(
        { error: 'El resumen ya fue aceptado por SUNAT' },
        { status: 409 },
      );
    }

    // Reset status to PENDING so the cron picks it up again
    await dailySummary.update({
      where: { id: summaryId },
      data: {
        sunat_status: 'PENDING',
        last_error: null,
        attempts: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Resumen marcado para reenvío en el próximo ciclo',
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 },
      );
    }
    log.error('Failed to resend daily summary', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al reenviar resumen' },
      { status: 500 },
    );
  }
}
