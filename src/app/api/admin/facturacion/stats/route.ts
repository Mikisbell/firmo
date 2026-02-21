/**
 * Admin Facturación Stats API - GET
 *
 * Returns invoice statistics for the dashboard.
 * Requires admin auth.
 *
 * @module app/api/admin/facturacion/stats/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { invoiceService } from '@/src/core/services/invoice.service';
import { InvoiceStatsQuerySchema } from '@/src/core/admin/schemas/facturacion.schema';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = InvoiceStatsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const result = await invoiceService.getInvoiceStats(
      authResult.user.tenantId,
      params.from,
      params.to,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch {
    return NextResponse.json({ error: 'Error al obtener estadísticas' }, { status: 500 });
  }
}
