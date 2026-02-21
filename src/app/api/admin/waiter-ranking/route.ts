/**
 * Admin Waiter Ranking API - GET
 *
 * Returns waiter performance rankings for a date range.
 * Requires admin auth.
 *
 * @module app/api/admin/waiter-ranking/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { WaiterRankingService } from '@/src/core/services/waiter-ranking.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: YYYY-MM-DD'),
  sort: z.enum(['sales', 'orders', 'tips', 'avg_ticket', 'avg_time']).default('sales'),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const service = new WaiterRankingService(prisma);
    const result = await service.getRankings(
      authResult.user.tenantId,
      {
        start: new Date(params.start),
        end: new Date(`${params.end}T23:59:59.999Z`),
      },
      params.sort,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al obtener ranking' }, { status: 500 });
  }
}
