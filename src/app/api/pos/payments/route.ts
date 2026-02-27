/**
 * POS Payments API
 *
 * POST: Record a payment (server-side confirmation)
 * GET: Get payments for the current shift
 *
 * @module app/api/pos/payments/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { PaymentService } from '@/src/core/services/payment.service';
import prisma from '@/src/core/db/prisma';

const PaymentSchema = z.object({
  orderId: z.string().min(1).max(255),
  checkId: z.string().min(1).max(255),
  amountCents: z.number().int().positive().max(99999999),
  method: z.enum(['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER']),
  reference: z.string().max(255).optional(),
  shiftId: z.string().optional(),
  terminalId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const parsed = PaymentSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    return NextResponse.json(
      { error: fieldErrors, details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { orderId, checkId, amountCents, method, reference, shiftId, terminalId } = parsed.data;

  const service = new PaymentService(prisma);
  const result = await service.processPayment({
    orderId,
    checkId,
    amountCents,
    method,
    reference,
    tenantId: authResult.user.tenantId,
    actorId: authResult.user.id,
    terminalId: terminalId || (authResult.user as any).terminalId || '',
    shiftId,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  return NextResponse.json(result.data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const shiftId = request.nextUrl.searchParams.get('shiftId');
  const orderId = request.nextUrl.searchParams.get('orderId');

  const service = new PaymentService(prisma);

  if (shiftId) {
    const result = await service.getPaymentsByShift(authResult.user.tenantId, shiftId);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ payments: result.data });
  }

  if (orderId) {
    const result = await service.getPaymentsByOrder(authResult.user.tenantId, orderId);
    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ payments: result.data });
  }

  return NextResponse.json({ error: 'shiftId o orderId es requerido' }, { status: 400 });
}
