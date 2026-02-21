/**
 * POS Print API - POST
 *
 * Quick print endpoint for POS terminals. Generates and queues a print job.
 *
 * @module app/api/pos/print/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PrintJobService } from '@/src/core/services/print-job.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: {
    type?: string;
    orderId?: string;
    printerId?: string;
    data?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const typeMap: Record<string, string> = {
    receipt: 'RECEIPT',
    kitchen: 'KITCHEN_TICKET',
    'pre-check': 'PRE_CHECK',
    invoice: 'INVOICE',
  };

  const jobType = typeMap[body.type || ''];
  if (!jobType) {
    return NextResponse.json(
      { error: 'type inválido (receipt, kitchen, pre-check, invoice)' },
      { status: 400 },
    );
  }

  const service = new PrintJobService(prisma);
  const result = await service.createPrintJob({
    tenantId: authResult.user.tenantId,
    jobType: jobType as any,
    payload: body.data || {},
    orderId: body.orderId,
    printerId: body.printerId,
    actorId: authResult.user.id,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json({ job: result.data }, { status: 201 });
}
