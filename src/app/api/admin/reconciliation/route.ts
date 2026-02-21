/**
 * Admin Reconciliation API - GET / POST
 *
 * GET: Lists settlement records.
 * POST: Generates settlement period from payments.
 *
 * @module app/api/admin/reconciliation/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ReconciliationService } from '@/src/core/services/reconciliation.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const GenerateSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const service = new ReconciliationService(prisma);
  const status = request.nextUrl.searchParams.get('status') as any;
  const method = request.nextUrl.searchParams.get('method') ?? undefined;

  const result = await service.getSettlements(authResult.user.tenantId, {
    status: status || undefined,
    paymentMethod: method,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ settlements: result.data });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const body = await request.json();
    const data = GenerateSchema.parse(body);

    const service = new ReconciliationService(prisma);
    const result = await service.generateSettlementPeriod(
      authResult.user.tenantId,
      new Date(data.start),
      new Date(`${data.end}T23:59:59.999Z`),
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ settlements: result.data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
