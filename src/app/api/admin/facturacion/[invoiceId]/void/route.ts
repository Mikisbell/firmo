/**
 * Admin Void Invoice API - POST
 *
 * Void an issued invoice with reason.
 * Requires admin auth.
 *
 * @module app/api/admin/facturacion/[invoiceId]/void/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { invoiceService } from '@/src/core/services/invoice.service';
import { VoidInvoiceSchema } from '@/src/core/admin/schemas/facturacion.schema';
import { ZodError } from 'zod';

interface RouteContext {
  params: Promise<{ invoiceId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { invoiceId } = await context.params;
    const body = await request.json();
    const { reason } = VoidInvoiceSchema.parse(body);

    const result = await invoiceService.voidInvoice({
      tenantId: authResult.user.tenantId,
      invoiceId,
      reason,
      voidedBy: authResult.user.id,
      approvedBy: authResult.user.id,
      terminalId: 'admin',
    });

    if (!result.success) {
      const status = result.error.code === 'NOT_FOUND' ? 404
        : result.error.code === 'CONFLICT' ? 409
        : result.error.code === 'FORBIDDEN' ? 403
        : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al anular factura' }, { status: 500 });
  }
}
