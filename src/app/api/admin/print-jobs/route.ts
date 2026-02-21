/**
 * Print Jobs API - GET/POST
 *
 * @module app/api/admin/print-jobs/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PrintJobService } from '@/src/core/services/print-job.service';
import prisma from '@/src/core/db/prisma';

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const validTypes = ['RECEIPT', 'KITCHEN_TICKET', 'PRE_CHECK', 'INVOICE'];
  if (!body.jobType || !validTypes.includes(body.jobType)) {
    return NextResponse.json({ error: 'jobType inválido' }, { status: 400 });
  }

  const service = new PrintJobService(prisma);
  const result = await service.createPrintJob({
    tenantId: authResult.user.tenantId,
    jobType: body.jobType,
    payload: body.payload || {},
    printerId: body.printerId,
    orderId: body.orderId,
    checkId: body.checkId,
    actorId: authResult.user.id,
    terminalId: body.terminalId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ job: result.data }, { status: 201 });
}
