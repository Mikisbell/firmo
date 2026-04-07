/**
 * Daily Stock Alerts Cron
 *
 * Queries all inventory items below min_stock for all active tenants.
 * Logs a summary per tenant. Push/email integration is handled by
 * the real-time stock-alert-notifier on each deduction — this cron
 * serves as a daily catch-all summary.
 *
 * Protected by CRON_SECRET header (Vercel Cron Jobs set this automatically).
 *
 * Schedule: Daily at 6:00 AM UTC (11:00 PM Lima -5, or 1:00 AM Lima -5 next day)
 * Configured in vercel.json
 *
 * @module api/cron/stock-alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all active tenants that have inventory configured
    const tenantsWithInventory = await prisma.inventory.groupBy({
      by: ['tenant_id'],
      where: {
        min_stock: { not: null },
      },
    });

    let totalLowStock = 0;
    let totalTenants = 0;
    const summaries: Array<{ tenantId: string; lowStockCount: number; items: string[] }> = [];

    for (const { tenant_id } of tenantsWithInventory) {
      // Find all items below min_stock for this tenant
      const lowStockItems = await prisma.$queryRaw<
        Array<{ code: string; name: string; stock: number; min_stock: number; unit: string }>
      >`
        SELECT code, name, stock::numeric AS stock, min_stock::numeric AS min_stock, unit
        FROM inventory
        WHERE tenant_id = ${tenant_id}::uuid
          AND min_stock IS NOT NULL
          AND stock < min_stock
        ORDER BY (stock / NULLIF(min_stock, 0)) ASC
        LIMIT 50
      `;

      if (lowStockItems.length > 0) {
        totalLowStock += lowStockItems.length;
        totalTenants++;

        const items = lowStockItems.map(
          (item) => `${item.name} (${item.code}): ${item.stock}/${item.min_stock} ${item.unit}`,
        );

        summaries.push({
          tenantId: tenant_id,
          lowStockCount: lowStockItems.length,
          items,
        });

        logger.info('CRON_STOCK_ALERT_TENANT', `Tenant ${tenant_id}: ${lowStockItems.length} insumos bajo stock minimo`, {
          tenant_id,
          low_stock_count: lowStockItems.length,
          items: items.slice(0, 10), // Limit logged items
        });
      }
    }

    logger.info('CRON_STOCK_ALERT_SUMMARY', `Resumen diario: ${totalLowStock} insumos bajo stock en ${totalTenants} tenants`, {
      total_low_stock: totalLowStock,
      total_tenants: totalTenants,
    });

    return NextResponse.json({
      success: true,
      totalLowStock,
      totalTenants,
      summaries: summaries.map((s) => ({
        tenantId: s.tenantId,
        lowStockCount: s.lowStockCount,
        topItems: s.items.slice(0, 5),
      })),
    });
  } catch (error) {
    logger.error(
      'CRON_STOCK_ALERT_ERROR',
      'Error en cron de alertas de stock',
      error instanceof Error ? error : new Error(String(error)),
    );

    return NextResponse.json(
      { error: 'Error procesando alertas de stock' },
      { status: 500 },
    );
  }
}
