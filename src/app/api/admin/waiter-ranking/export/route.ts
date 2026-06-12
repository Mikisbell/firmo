/**
 * Admin Waiter Ranking Export API - GET
 *
 * Exports waiter ranking data as XLSX, CSV, or PDF (HTML).
 * Requires admin auth.
 *
 * @module app/api/admin/waiter-ranking/export/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { WaiterRankingService } from '@/src/core/services/waiter-ranking.service';
import { exportService, type ExportColumn } from '@/src/core/services/export.service';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const QuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sort: z.enum(['sales', 'orders', 'tips', 'avg_ticket', 'avg_time']).default('sales'),
  format: z.enum(['xlsx', 'csv', 'pdf']).default('xlsx'),
});

const columns: ExportColumn[] = [
  { header: '#', key: 'rank', width: 5, format: 'number' },
  { header: 'Mozo', key: 'name', width: 25, format: 'text' },
  { header: 'Órdenes', key: 'orders', width: 10, format: 'number' },
  { header: 'Ventas', key: 'salesCents', width: 15, format: 'currency' },
  { header: 'Ticket Prom.', key: 'avgTicketCents', width: 15, format: 'currency' },
  { header: 'Propinas', key: 'tipsCents', width: 12, format: 'currency' },
  { header: 'Tiempo Prom. (min)', key: 'avgMinutes', width: 18, format: 'number' },
  { header: 'Salón', key: 'dineIn', width: 8, format: 'number' },
  { header: 'Para Llevar', key: 'takeout', width: 10, format: 'number' },
  { header: 'Delivery', key: 'delivery', width: 10, format: 'number' },
];

export async function GET(request: NextRequest) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const params = QuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const service = new WaiterRankingService(prisma);
    const result = await service.getRankings(
      authResult.user.tenantId,
      {
        start: new Date(params.start),
        end: new Date(`${params.end}T23:59:59.999Z`),
      },
      params.sort,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error.message }, { status: 400 });
    }

    const rows = result.data.rankings.map((r, i) => ({
      rank: i + 1,
      name: r.employeeName,
      orders: r.totalOrders,
      salesCents: r.totalSalesCents,
      avgTicketCents: r.averageTicketCents,
      tipsCents: r.totalTipsCents,
      avgMinutes: r.averageServiceMinutes,
      dineIn: r.ordersByType.DINE_IN,
      takeout: r.ordersByType.TAKEOUT,
      delivery: r.ordersByType.DELIVERY,
    }));

    const footerRow = {
      rank: '',
      name: 'TOTAL',
      orders: result.data.summary.totalOrdersAll,
      salesCents: result.data.summary.totalSalesAllCents,
      avgTicketCents: result.data.summary.averageTicketAllCents,
      tipsCents: rows.reduce((s, r) => s + (r.tipsCents as number), 0),
      avgMinutes: '',
      dineIn: rows.reduce((s, r) => s + (r.dineIn as number), 0),
      takeout: rows.reduce((s, r) => s + (r.takeout as number), 0),
      delivery: rows.reduce((s, r) => s + (r.delivery as number), 0),
    };

    const title = `Ranking Mozos — ${params.start} a ${params.end}`;
    const filename = `ranking-mozos-${params.start}-${params.end}`;

    switch (params.format) {
      case 'xlsx': {
        const buffer = await exportService.generateExcel({
          sheetName: 'Ranking Mozos',
          title,
          columns,
          rows,
          footerRow,
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
          subtitle: `${result.data.summary.totalWaiters} mozos · ${result.data.summary.totalOrdersAll} órdenes`,
          columns,
          rows,
          footerRow,
          orientation: 'landscape',
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
