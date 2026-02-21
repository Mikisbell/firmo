/**
 * Admin Reconciliation Export API - GET
 *
 * Exports reconciliation data as XLSX.
 *
 * @module app/api/admin/reconciliation/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ReconciliationService } from '@/src/core/services/reconciliation.service';
import { exportService, type ExportColumn } from '@/src/core/services/export.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const columns: ExportColumn[] = [
  { header: 'Método', key: 'method', width: 20, format: 'text' },
  { header: 'Esperado', key: 'expectedCents', width: 15, format: 'currency' },
  { header: 'Recibido', key: 'receivedCents', width: 15, format: 'currency' },
  { header: 'Diferencia', key: 'differenceCents', width: 15, format: 'currency' },
  { header: 'Estado', key: 'status', width: 15, format: 'text' },
];

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const service = new ReconciliationService(prisma);
    const result = await service.getDiscrepancyReport(authResult.user.tenantId, {
      start: new Date(params.start),
      end: new Date(`${params.end}T23:59:59.999Z`),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    const rows = result.data.byMethod.map((m) => ({
      method: m.method,
      expectedCents: m.expectedCents,
      receivedCents: m.receivedCents,
      differenceCents: m.differenceCents,
      status: m.status,
    }));

    const title = `Conciliación de Pagos — ${params.start} a ${params.end}`;
    const filename = `conciliacion-${params.start}-${params.end}`;

    const buffer = await exportService.generateExcel({
      sheetName: 'Conciliación',
      title,
      columns,
      rows,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 });
  }
}
