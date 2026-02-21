/**
 * Dashboard Service - Business KPIs and Activity Feed
 *
 * @module core/services/dashboard.service
 */

import { PrismaClient } from '@prisma/client';
import { Result, ok, err, DomainError } from '@/src/core/result';

export interface DailyKPIs {
  ordersCount: number;
  grossSalesCents: number;
  avgTicketCents: number;
  topProducts: { name: string; qty: number; revenueCents: number }[];
  paymentBreakdown: Record<string, { count: number; totalCents: number }>;
  hourlySales: number[]; // 24 buckets (0-23), each is total cents for that hour
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export class DashboardService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get daily KPIs for a tenant on a specific date
   */
  async getDailyKPIs(
    tenantId: string,
    date: Date
  ): Promise<Result<DailyKPIs, DomainError>> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Parallel queries
      const [orders, payments] = await Promise.all([
        this.prisma.orders.findMany({
          where: {
            tenant_id: tenantId,
            order_status: 'CONFIRMED',
            created_at: { gte: startOfDay, lte: endOfDay },
          },
          select: { total_cents: true, items: true, created_at: true },
        }),
        this.prisma.payments.findMany({
          where: {
            tenant_id: tenantId,
            status: 'COMPLETED',
            processed_at: { gte: startOfDay, lte: endOfDay },
          },
          select: { amount_cents: true, payment_method: true },
        }),
      ]);

      const ordersCount = orders.length;
      const grossSalesCents = orders.reduce((sum, o) => sum + o.total_cents, 0);
      const avgTicketCents = ordersCount > 0 ? Math.round(grossSalesCents / ordersCount) : 0;

      // Top products from order items
      const productMap: Record<string, { name: string; qty: number; revenueCents: number }> = {};
      for (const order of orders) {
        const items = (order.items as any[]) || [];
        for (const item of items) {
          const key = item.product_id || item.name;
          if (!productMap[key]) {
            productMap[key] = { name: item.name || key, qty: 0, revenueCents: 0 };
          }
          productMap[key].qty += item.qty || 1;
          productMap[key].revenueCents += (item.qty || 1) * (item.unit_price_cents || 0);
        }
      }
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 5);

      // Payment breakdown
      const paymentBreakdown: Record<string, { count: number; totalCents: number }> = {};
      for (const p of payments) {
        if (!paymentBreakdown[p.payment_method]) {
          paymentBreakdown[p.payment_method] = { count: 0, totalCents: 0 };
        }
        paymentBreakdown[p.payment_method].count++;
        paymentBreakdown[p.payment_method].totalCents += p.amount_cents;
      }

      // Hourly sales distribution
      const hourlySales = new Array(24).fill(0);
      for (const order of orders) {
        const hour = new Date(order.created_at).getHours();
        hourlySales[hour] += order.total_cents;
      }

      return ok({
        ordersCount,
        grossSalesCents,
        avgTicketCents,
        topProducts,
        paymentBreakdown,
        hourlySales,
      });
    } catch (error) {
      return err(new DomainError('Error al obtener KPIs', 'QUERY_FAILED'));
    }
  }

  /**
   * Get recent activity feed for a tenant
   */
  async getRecentActivity(
    tenantId: string,
    limit: number = 5
  ): Promise<Result<ActivityItem[], DomainError>> {
    try {
      const events = await this.prisma.events.findMany({
        where: {
          tenant_id: tenantId,
          type: { in: ['ORDER_CREATED', 'SHIFT_OPENED', 'SHIFT_CLOSED', 'INVOICE_ISSUED', 'CHECK_MARKED_PAID'] },
        },
        orderBy: { occurred_at: 'desc' },
        take: limit,
        select: { id: true, type: true, payload: true, occurred_at: true },
      });

      const items: ActivityItem[] = events.map((e) => {
        const p = e.payload as any;
        let message = '';

        switch (e.type) {
          case 'ORDER_CREATED':
            message = `Nueva orden #${p?.order_number || '?'} — ${p?.order_type || 'DINE_IN'}`;
            break;
          case 'SHIFT_OPENED':
            message = `Turno abierto — Caja S/ ${((p?.cash_opening_cents || 0) / 100).toFixed(2)}`;
            break;
          case 'SHIFT_CLOSED':
            message = `Turno cerrado`;
            break;
          case 'INVOICE_ISSUED':
            message = `${p?.invoice_type || 'Comprobante'} emitido — S/ ${((p?.total_cents || 0) / 100).toFixed(2)}`;
            break;
          case 'CHECK_MARKED_PAID':
            message = `Pago confirmado — Orden ${p?.order_id?.slice(0, 8) || '?'}`;
            break;
          default:
            message = e.type;
        }

        return {
          id: e.id,
          type: e.type,
          message,
          timestamp: e.occurred_at.toISOString(),
        };
      });

      return ok(items);
    } catch (error) {
      return err(new DomainError('Error al obtener actividad reciente', 'QUERY_FAILED'));
    }
  }
}
