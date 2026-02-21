/**
 * POS Payments API
 *
 * POST: Record a payment (server-side confirmation)
 * GET: Get payments for the current shift
 *
 * @module app/api/pos/payments/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PaymentService } from '@/src/core/services/payment.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { orderId, checkId, amountCents, method, reference, shiftId, terminalId } = body;

  if (!orderId || !checkId) {
    return NextResponse.json({ error: 'orderId y checkId son requeridos' }, { status: 400 });
  }

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents debe ser mayor a 0' }, { status: 400 });
  }

  const validMethods = ['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER'];
  if (!method || !validMethods.includes(method)) {
    return NextResponse.json(
      { error: `method inválido (${validMethods.join(', ')})` },
      { status: 400 },
    );
  }

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
  const authResult = await requireAdminAuth(request);
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
