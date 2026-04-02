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
  jobType: z.enum(['RECEIPT', 'KITCHEN_TICKET', 'PRE_CHECK', 'INVOICE', 'TEST'], { message: 'jobType inválido' }),
  payload: z.record(z.unknown()).optional().default({}),
  printerId: z.string().optional(),
  orderId: z.string().optional(),
  checkId: z.string().optional(),
  terminalId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const printerId = request.nextUrl.searchParams.get('printer_id') || undefined;
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const all = request.nextUrl.searchParams.get('all') === 'true';
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    if (all || status) {
      const where: Record<string, unknown> = { tenant_id: authResult.user.tenantId };
      if (status) where.status = status;
      if (printerId) where.printer_id = printerId;

      const jobs = await prisma.print_jobs.findMany({
        where: where as any,
        include: { printers: { select: { name: true } } },
        orderBy: [{ created_at: 'desc' }],
        take: Math.min(limit, 500),
      });

      const mapped = jobs.map((j: any) => ({
        id: j.id,
        tenantId: j.tenant_id,
        printerId: j.printer_id,
        printerName: j.printers?.name ?? null,
        jobType: j.job_type,
        priority: j.priority,
        status: j.status,
        attempts: j.attempts,
        orderId: j.order_id,
        checkId: j.check_id,
        actorId: j.actor_id,
        terminalId: j.terminal_id,
        createdAt: new Date(j.created_at).toISOString(),
        sentAt: j.sent_at ? new Date(j.sent_at).toISOString() : null,
        printedAt: j.printed_at ? new Date(j.printed_at).toISOString() : null,
        failedAt: j.failed_at ? new Date(j.failed_at).toISOString() : null,
      }));

      // If stats requested, also compute them
      if (request.nextUrl.searchParams.get('stats') === 'true') {
        const service = new PrintJobService(prisma);
        const statsResult = await service.getJobStats(authResult.user.tenantId);
        return NextResponse.json({
          jobs: mapped,
          stats: statsResult.success ? statsResult.data : null,
        });
      }

      return NextResponse.json({ jobs: mapped });
    }

    const service = new PrintJobService(prisma);
    const result = await service.getPendingJobs(authResult.user.tenantId, printerId);

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    return NextResponse.json({ jobs: result.data });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
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
