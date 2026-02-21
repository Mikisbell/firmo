/**
 * POS Invoice Emission API
 *
 * POST: Emit a boleta or factura from POS terminal.
 * Uses InvoiceService for actual SUNAT emission via Nubefact.
 *
 * @module app/api/pos/invoices/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { InvoiceService, type InvoiceType } from '@/src/core/services/invoice.service';
import prisma from '@/src/core/db/prisma';

export async function POST(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { orderId, checkId, invoiceType, customerDocType, customerDoc, customerName, paymentSummary } = body;

  if (!orderId || !checkId) {
    return NextResponse.json({ error: 'orderId y checkId son requeridos' }, { status: 400 });
  }

  const validTypes: InvoiceType[] = ['BOLETA', 'FACTURA'];
  if (!invoiceType || !validTypes.includes(invoiceType)) {
    return NextResponse.json({ error: 'invoiceType inválido (BOLETA, FACTURA)' }, { status: 400 });
  }

  if (invoiceType === 'FACTURA' && !customerDoc) {
    return NextResponse.json({ error: 'RUC es requerido para FACTURA' }, { status: 400 });
  }

  if (!paymentSummary || !paymentSummary.totalCents) {
    return NextResponse.json({ error: 'paymentSummary con totalCents es requerido' }, { status: 400 });
  }

  const service = new InvoiceService(prisma);
  const result = await service.emitInvoice({
    tenantId: authResult.user.tenantId,
    orderId,
    checkId,
    invoiceType,
    customerDocType: customerDocType || (invoiceType === 'FACTURA' ? 'RUC' : undefined),
    customerDoc,
    customerName,
    paymentSummary,
    issuedBy: authResult.user.id,
    terminalId: authResult.user.terminalId || '',
  });

  if (!result.success) {
    const status = result.error.message.includes('no encontrad') ? 404
      : result.error.message.includes('ya existe') ? 409
      : 400;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  return NextResponse.json(result.data, { status: 201 });
}
