/**
 * Admin Invoice Detail API - GET
 *
 * Returns full invoice detail including CDR and credit notes.
 * Requires admin auth.
 *
 * @module app/api/admin/facturacion/[invoiceId]/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { invoiceId } = await context.params;

    const invoice = await prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        tenant_id: authResult.user.tenantId,
      },
      include: {
        credit_notes: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    // Get CDR if exists
    const cdr = await prisma.invoice_cdr.findFirst({
      where: {
        tenant_id: authResult.user.tenantId,
        invoice_id: invoiceId,
      },
    });

    // Get SUNAT status
    const sunatStatus = cdr
      ? cdr.response_code === '0' ? 'ACCEPTED' : 'REJECTED'
      : 'PENDING';

    return NextResponse.json({
      ...invoice,
      sunat_status: sunatStatus,
      cdr: cdr ? {
        response_code: cdr.response_code,
        response_message: cdr.response_message,
        hash: cdr.hash,
        received_at: cdr.received_at,
      } : null,
    });
  } catch {
    return NextResponse.json({ error: 'Error al obtener detalle' }, { status: 500 });
  }
}
