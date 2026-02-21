/**
 * Waiter Ranking Service
 *
 * Aggregates waiter performance metrics from orders.
 * Queries orders grouped by waiter_id, calculates sales, avg ticket,
 * service time, and tips from checks JSON.
 *
 * @module core/services/waiter-ranking.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result } from '@/src/core/result';
import { DomainError, ValidationError } from '@/src/core/result';
import type {
  WaiterPerformanceMetrics,
  WaiterRankingReport,
  RankingSortField,
} from '@/src/core/types/waiter-ranking';

// ============================================================================
// Types
// ============================================================================

interface DateRange {
  start: Date;
  end: Date;
}

interface CheckPayment {
  method?: string;
  amount_cents?: number;
  tip_cents?: number;
}

interface OrderCheck {
  check_id?: string;
  payment?: CheckPayment;
  payments?: CheckPayment[];
}

// ============================================================================
// Service
// ============================================================================

export class WaiterRankingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get rankings for all waiters in a period
   */
  async getRankings(
    tenantId: string,
    period: DateRange,
    sort: RankingSortField = 'sales',
  ): Promise<Result<WaiterRankingReport, DomainError>> {
    if (period.start > period.end) {
      return err(new ValidationError('La fecha de inicio debe ser anterior a la fecha de fin'));
    }

    // Get all completed orders with waiter in the period
    const orders = await this.prisma.orders.findMany({
      where: {
        tenant_id: tenantId,
        waiter_id: { not: null },
        order_status: { in: ['CONFIRMED', 'COMPLETED', 'CLOSED'] },
        created_at: {
          gte: period.start,
          lte: period.end,
        },
      },
      select: {
        waiter_id: true,
        total_cents: true,
        order_type: true,
        checks: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Get employees for names
    const waiterIds = [...new Set(orders.map((o) => o.waiter_id!))];

    if (waiterIds.length === 0) {
      return ok({
        rankings: [],
        summary: {
          totalWaiters: 0,
          totalOrdersAll: 0,
          totalSalesAllCents: 0,
          averageTicketAllCents: 0,
          bestPerformerId: null,
          bestPerformerName: null,
        },
        period: { start: period.start.toISOString(), end: period.end.toISOString() },
      });
    }

    const employees = await this.prisma.employees.findMany({
      where: {
        id: { in: waiterIds },
        tenant_id: tenantId,
      },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    // Aggregate per waiter
    const waiterMap = new Map<string, {
      totalOrders: number;
      totalSalesCents: number;
      totalTipsCents: number;
      totalServiceMinutes: number;
      ordersByType: { DINE_IN: number; TAKEOUT: number; DELIVERY: number };
    }>();

    for (const order of orders) {
      const waiterId = order.waiter_id!;

      if (!waiterMap.has(waiterId)) {
        waiterMap.set(waiterId, {
          totalOrders: 0,
          totalSalesCents: 0,
          totalTipsCents: 0,
          totalServiceMinutes: 0,
          ordersByType: { DINE_IN: 0, TAKEOUT: 0, DELIVERY: 0 },
        });
      }

      const stats = waiterMap.get(waiterId)!;
      stats.totalOrders += 1;
      stats.totalSalesCents += order.total_cents;

      // Tips from checks JSON
      stats.totalTipsCents += this.extractTips(order.checks);

      // Service time
      const created = new Date(order.created_at);
      const updated = new Date(order.updated_at);
      const minutes = Math.max(0, (updated.getTime() - created.getTime()) / 60000);
      stats.totalServiceMinutes += minutes;

      // Order type breakdown
      const orderType = order.order_type as 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
      if (orderType in stats.ordersByType) {
        stats.ordersByType[orderType] += 1;
      }
    }

    // Build rankings
    const rankings: WaiterPerformanceMetrics[] = [];

    for (const [waiterId, stats] of waiterMap) {
      const employee = employeeMap.get(waiterId);
      rankings.push({
        employeeId: waiterId,
        employeeName: employee?.name ?? 'Desconocido',
        role: employee?.role ?? 'mesero',
        totalOrders: stats.totalOrders,
        totalSalesCents: stats.totalSalesCents,
        averageTicketCents: stats.totalOrders > 0
          ? Math.round(stats.totalSalesCents / stats.totalOrders)
          : 0,
        averageServiceMinutes: stats.totalOrders > 0
          ? Math.round(stats.totalServiceMinutes / stats.totalOrders)
          : 0,
        totalTipsCents: stats.totalTipsCents,
        ordersByType: stats.ordersByType,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
      });
    }

    // Sort
    this.sortRankings(rankings, sort);

    // Summary
    const totalOrdersAll = rankings.reduce((s, r) => s + r.totalOrders, 0);
    const totalSalesAllCents = rankings.reduce((s, r) => s + r.totalSalesCents, 0);
    const best = rankings.length > 0 ? rankings[0] : null;

    return ok({
      rankings,
      summary: {
        totalWaiters: rankings.length,
        totalOrdersAll,
        totalSalesAllCents,
        averageTicketAllCents: totalOrdersAll > 0 ? Math.round(totalSalesAllCents / totalOrdersAll) : 0,
        bestPerformerId: best?.employeeId ?? null,
        bestPerformerName: best?.employeeName ?? null,
      },
      period: { start: period.start.toISOString(), end: period.end.toISOString() },
    });
  }

  /**
   * Get detailed metrics for a single waiter
   */
  async getWaiterDetail(
    tenantId: string,
    waiterId: string,
    period: DateRange,
  ): Promise<Result<WaiterPerformanceMetrics, DomainError>> {
    const result = await this.getRankings(tenantId, period, 'sales');
    if (!result.success) return result;

    const waiter = result.data.rankings.find((r) => r.employeeId === waiterId);
    if (!waiter) {
      return err(new ValidationError(`Mesero ${waiterId} no tiene órdenes en el período`));
    }

    return ok(waiter);
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  private extractTips(checks: unknown): number {
    if (!Array.isArray(checks)) return 0;

    let totalTips = 0;

    for (const check of checks as OrderCheck[]) {
      // Single payment format
      if (check.payment?.tip_cents && typeof check.payment.tip_cents === 'number') {
        totalTips += check.payment.tip_cents;
      }
      // Multiple payments format
      if (Array.isArray(check.payments)) {
        for (const payment of check.payments) {
          if (payment.tip_cents && typeof payment.tip_cents === 'number') {
            totalTips += payment.tip_cents;
          }
        }
      }
    }

    return totalTips;
  }

  private sortRankings(rankings: WaiterPerformanceMetrics[], sort: RankingSortField): void {
    switch (sort) {
      case 'sales':
        rankings.sort((a, b) => b.totalSalesCents - a.totalSalesCents);
        break;
      case 'orders':
        rankings.sort((a, b) => b.totalOrders - a.totalOrders);
        break;
      case 'tips':
        rankings.sort((a, b) => b.totalTipsCents - a.totalTipsCents);
        break;
      case 'avg_ticket':
        rankings.sort((a, b) => b.averageTicketCents - a.averageTicketCents);
        break;
      case 'avg_time':
        rankings.sort((a, b) => a.averageServiceMinutes - b.averageServiceMinutes);
        break;
    }
  }
}
