/**
 * Print Jobs API - GET/POST
 *
 * @module app/api/admin/print-jobs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PrintJobService } from '@/src/core/services/print-job.service';
import prisma from '@/src/core/db/prisma';

const createPrintJobSchema = z.object({
  jobType: z.enum(['RECEIPT', 'KITCHEN_TICKET', 'PRE_CHECK', 'INVOICE'], { message: 'jobType inválido' }),
  payload: z.record(z.unknown()).optional().default({}),
  printerId: z.string().optional(),
  orderId: z.string().optional(),
  checkId: z.string().optional(),
  terminalId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  const printerId = request.nextUrl.searchParams.get('printer_id') || undefined;

  const service = new PrintJobService(prisma);
  const result = await service.getPendingJobs(authResult.user.tenantId, printerId);

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ jobs: result.data });
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = createPrintJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { jobType, payload, printerId, orderId, checkId, terminalId } = parsed.data;

  const service = new PrintJobService(prisma);
  const result = await service.createPrintJob({
    tenantId: authResult.user.tenantId,
    jobType,
    payload,
    printerId,
    orderId,
    checkId,
    actorId: authResult.user.id,
    terminalId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ job: result.data }, { status: 201 });
}
