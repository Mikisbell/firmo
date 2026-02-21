/**
 * Admin P&L Report API - GET
 *
 * Generates a Profit & Loss report for a given period.
 *
 * @module app/api/admin/pnl/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PnLReportService } from '@/src/core/services/pnl-report.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const service = new PnLReportService(prisma);
    const result = await service.generatePnL(authResult.user.tenantId, {
      start: new Date(params.start),
      end: new Date(`${params.end}T23:59:59.999Z`),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
  }
}
