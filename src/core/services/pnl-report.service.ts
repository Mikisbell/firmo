/**
 * P&L Report Service
 *
 * Generates Profit & Loss (Estado de Resultados) reports combining:
 * - Revenue from daily_sales_summary
 * - COGS from profitability service
 * - Operating expenses from petty_cash_transactions
 * - Purchases from purchase_orders (RECEIVED)
 * - Payroll from payroll_records
 *
 * All amounts in centavos (integer).
 *
 * @module core/services/pnl-report.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, ValidationError } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface PnLReport {
  period: { start: string; end: string };
  revenue: RevenueBreakdown;
  cogs: COGSBreakdown;
  grossProfit: GrossProfitSection;
  operatingExpenses: OperatingExpensesBreakdown;
  netIncome: NetIncomeSection;
}

export interface RevenueBreakdown {
  grossSalesCents: number;
  discountsCents: number;
  refundsCents: number;
  deliveryFeesCents: number;
  tipsCents: number;
  netSalesCents: number;
  ordersCount: number;
}

export interface COGSBreakdown {
  totalCogsCents: number;
  purchasesCents: number;
}

export interface GrossProfitSection {
  grossProfitCents: number;
  grossMarginPercent: number;
}

export interface OperatingExpensesBreakdown {
  totalExpensesCents: number;
  payrollCents: number;
  pettyCashExpensesCents: number;
  byCategory: { category: string; amountCents: number }[];
}

export interface NetIncomeSection {
  netIncomeCents: number;
  netMarginPercent: number;
}

export interface PnLPeriod {
  start: Date;
  end: Date;
}

// ============================================================================
// Service
// ============================================================================

export class PnLReportService {
  constructor(private prisma: PrismaClient) {}

  async generatePnL(
    tenantId: string,
    period: PnLPeriod,
  ): Promise<Result<PnLReport, DomainError>> {
    if (period.start > period.end) {
      return err(new ValidationError('La fecha de inicio debe ser anterior a la fecha de fin'));
    }

    const [salesData, pettyCashData, purchasesData, payrollData] = await Promise.all([
      this.getSalesData(tenantId, period),
      this.getPettyCashExpenses(tenantId, period),
      this.getPurchasesData(tenantId, period),
      this.getPayrollData(tenantId, period),
    ]);

    // Revenue
    const revenue: RevenueBreakdown = {
      grossSalesCents: salesData.grossSalesCents,
      discountsCents: salesData.discountsCents,
      refundsCents: salesData.refundsCents,
      deliveryFeesCents: salesData.deliveryFeesCents,
      tipsCents: salesData.tipsCents,
      netSalesCents:
        salesData.grossSalesCents -
        salesData.discountsCents -
        salesData.refundsCents +
        salesData.deliveryFeesCents,
      ordersCount: salesData.ordersCount,
    };

    // COGS
    const cogs: COGSBreakdown = {
      totalCogsCents: purchasesData.receivedTotalCents,
      purchasesCents: purchasesData.receivedTotalCents,
    };

    // Gross Profit
    const grossProfitCents = revenue.netSalesCents - cogs.totalCogsCents;
    const grossMarginPercent =
      revenue.netSalesCents > 0
        ? Math.round((grossProfitCents / revenue.netSalesCents) * 10000) / 100
        : 0;

    const grossProfit: GrossProfitSection = {
      grossProfitCents,
      grossMarginPercent,
    };

    // Operating Expenses
    const totalExpensesCents = payrollData.totalCents + pettyCashData.totalCents;
    const operatingExpenses: OperatingExpensesBreakdown = {
      totalExpensesCents,
      payrollCents: payrollData.totalCents,
      pettyCashExpensesCents: pettyCashData.totalCents,
      byCategory: pettyCashData.byCategory,
    };

    // Net Income
    const netIncomeCents = grossProfitCents - totalExpensesCents;
    const netMarginPercent =
      revenue.netSalesCents > 0
        ? Math.round((netIncomeCents / revenue.netSalesCents) * 10000) / 100
        : 0;

    const netIncome: NetIncomeSection = {
      netIncomeCents,
      netMarginPercent,
    };

    return ok({
      period: {
        start: period.start.toISOString().split('T')[0],
        end: period.end.toISOString().split('T')[0],
      },
      revenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netIncome,
    });
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private async getSalesData(
    tenantId: string,
    period: PnLPeriod,
  ): Promise<{
    grossSalesCents: number;
    discountsCents: number;
    refundsCents: number;
    deliveryFeesCents: number;
    tipsCents: number;
    ordersCount: number;
  }> {
    const summaries = await (this.prisma as any).daily_sales_summary.findMany({
      where: {
        tenant_id: tenantId,
        business_date: { gte: period.start, lte: period.end },
      },
    });

    let grossSalesCents = 0;
    let discountsCents = 0;
    let refundsCents = 0;
    let deliveryFeesCents = 0;
    let tipsCents = 0;
    let ordersCount = 0;

    for (const s of summaries) {
      grossSalesCents += s.gross_sales_cents;
      discountsCents += s.discount_cents;
      refundsCents += s.refunds_cents;
      deliveryFeesCents += s.delivery_fee_cents;
      tipsCents += s.tips_cents;
      ordersCount += s.orders_count;
    }

    return { grossSalesCents, discountsCents, refundsCents, deliveryFeesCents, tipsCents, ordersCount };
  }

  private async getPettyCashExpenses(
    tenantId: string,
    period: PnLPeriod,
  ): Promise<{
    totalCents: number;
    byCategory: { category: string; amountCents: number }[];
  }> {
    const transactions = await (this.prisma as any).petty_cash_transactions.findMany({
      where: {
        tenant_id: tenantId,
        type: 'EXPENSE',
        created_at: { gte: period.start, lte: period.end },
      },
    });

    const categoryMap = new Map<string, number>();
    let totalCents = 0;

    for (const tx of transactions) {
      totalCents += tx.amount;
      categoryMap.set(tx.category, (categoryMap.get(tx.category) ?? 0) + tx.amount);
    }

    return {
      totalCents,
      byCategory: Array.from(categoryMap.entries())
        .map(([category, amountCents]) => ({ category, amountCents }))
        .sort((a, b) => b.amountCents - a.amountCents),
    };
  }

  private async getPurchasesData(
    tenantId: string,
    period: PnLPeriod,
  ): Promise<{ receivedTotalCents: number }> {
    const orders = await (this.prisma as any).purchase_orders.findMany({
      where: {
        tenant_id: tenantId,
        status: 'RECEIVED',
        updated_at: { gte: period.start, lte: period.end },
      },
      select: { total_cents: true },
    });

    return {
      receivedTotalCents: orders.reduce(
        (sum: number, po: any) => sum + po.total_cents,
        0,
      ),
    };
  }

  private async getPayrollData(
    tenantId: string,
    period: PnLPeriod,
  ): Promise<{ totalCents: number }> {
    const records = await (this.prisma as any).payroll_records.findMany({
      where: {
        tenant_id: tenantId,
        business_date_start: { gte: period.start },
        business_date_end: { lte: period.end },
      },
      select: { gross_salary_cents: true },
    });

    return {
      totalCents: records.reduce(
        (sum: number, r: any) => sum + r.gross_salary_cents,
        0,
      ),
    };
  }
}
