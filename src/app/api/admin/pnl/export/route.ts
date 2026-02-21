/**
 * Admin P&L Export API - GET
 *
 * Exports P&L report as XLSX, CSV, or PDF.
 *
 * @module app/api/admin/pnl/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { PnLReportService } from '@/src/core/services/pnl-report.service';
import { exportService, type ExportColumn } from '@/src/core/services/export.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
});

const columns: ExportColumn[] = [
  { header: 'Concepto', key: 'concept', width: 35, format: 'text' },
  { header: 'Monto (S/)', key: 'amountCents', width: 18, format: 'currency' },
];

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const pnlService = new PnLReportService(prisma);
    const result = await pnlService.generatePnL(authResult.user.tenantId, {
      start: new Date(params.start),
      end: new Date(`${params.end}T23:59:59.999Z`),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    const d = result.data;
    const rows = [
      { concept: 'INGRESOS', amountCents: '' },
      { concept: '  Ventas Brutas', amountCents: d.revenue.grossSalesCents },
      { concept: '  (-) Descuentos', amountCents: -d.revenue.discountsCents },
      { concept: '  (-) Devoluciones', amountCents: -d.revenue.refundsCents },
      { concept: '  (+) Tarifa Delivery', amountCents: d.revenue.deliveryFeesCents },
      { concept: 'Ventas Netas', amountCents: d.revenue.netSalesCents },
      { concept: '', amountCents: '' },
      { concept: 'COSTO DE VENTAS', amountCents: '' },
      { concept: '  Compras Recibidas', amountCents: d.cogs.purchasesCents },
      { concept: 'Total COGS', amountCents: d.cogs.totalCogsCents },
      { concept: '', amountCents: '' },
      { concept: 'UTILIDAD BRUTA', amountCents: d.grossProfit.grossProfitCents },
      { concept: `  Margen Bruto: ${d.grossProfit.grossMarginPercent}%`, amountCents: '' },
      { concept: '', amountCents: '' },
      { concept: 'GASTOS OPERATIVOS', amountCents: '' },
      { concept: '  Nómina', amountCents: d.operatingExpenses.payrollCents },
      { concept: '  Caja Chica', amountCents: d.operatingExpenses.pettyCashExpensesCents },
      ...d.operatingExpenses.byCategory.map(c => ({
        concept: `    ${c.category}`,
        amountCents: c.amountCents,
      })),
      { concept: 'Total Gastos', amountCents: d.operatingExpenses.totalExpensesCents },
      { concept: '', amountCents: '' },
      { concept: 'UTILIDAD NETA', amountCents: d.netIncome.netIncomeCents },
      { concept: `  Margen Neto: ${d.netIncome.netMarginPercent}%`, amountCents: '' },
    ];

    const title = `Estado de Resultados — ${params.start} a ${params.end}`;
    const filename = `estado-resultados-${params.start}-${params.end}`;

    switch (params.format) {
      case 'xlsx': {
        const buffer = await exportService.generateExcel({
          sheetName: 'Estado de Resultados',
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
      }
      case 'csv': {
        const csv = exportService.generateCSV({ columns, rows });
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      }
      case 'pdf': {
        const html = exportService.generatePDFHtml({
          title,
          columns,
          rows,
        });
        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al exportar' }, { status: 500 });
  }
}
