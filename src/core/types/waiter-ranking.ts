/**
 * Waiter Ranking Types
 *
 * Types for waiter/mozo performance metrics and ranking reports.
 * All monetary values in centavos (integer).
 *
 * @module core/types/waiter-ranking
 */

export interface WaiterPerformanceMetrics {
  employeeId: string;
  employeeName: string;
  role: string;
  totalOrders: number;
  totalSalesCents: number;
  averageTicketCents: number;
  averageServiceMinutes: number;
  totalTipsCents: number;
  ordersByType: {
    DINE_IN: number;
    TAKEOUT: number;
    DELIVERY: number;
  };
  periodStart: string;
  periodEnd: string;
}

export interface WaiterRankingReport {
  rankings: WaiterPerformanceMetrics[];
  summary: {
    totalWaiters: number;
    totalOrdersAll: number;
    totalSalesAllCents: number;
    averageTicketAllCents: number;
    bestPerformerId: string | null;
    bestPerformerName: string | null;
  };
  period: { start: string; end: string };
}

export type RankingSortField = 'sales' | 'orders' | 'tips' | 'avg_ticket' | 'avg_time';

export interface RankingQueryParams {
  start: string;
  end: string;
  sort?: RankingSortField;
}
