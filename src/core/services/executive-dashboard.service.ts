import type { PrismaClient } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { PnLReportService } from './pnl-report.service';
import { profitabilityService } from './profitability.service';
import { cache, generateCacheKey } from '@/src/core/cache/cache-service';
import type {
  ExecutiveDashboardData,
  PeriodRange,
  TopProfitableProduct,
  PaymentMethodSummary,
  OperationalAlert,
  DataSourceStatus,
  DataSourceState,
} from '@/src/core/types/executive-dashboard';
import { unsafeCOGS, unsafeProfit, unsafeMargin } from '@/src/core/types/profitability';
import { unsafeCentavos } from '@/src/core/types/shared';

const CACHE_TTL = 60; // seconds
const CACHE_PREFIX = 'exec-dash';
const TOP_PRODUCTS_LIMIT = 5;

export class ExecutiveDashboardService {
  private dashboardService: DashboardService;
  private pnlService: PnLReportService;

  constructor(private prisma: PrismaClient) {
    this.dashboardService = new DashboardService(prisma);
    this.pnlService = new PnLReportService(prisma);
  }

  async getData(
    tenantId: string,
    period: PeriodRange,
  ): Promise<ExecutiveDashboardData> {
    const cacheKey = generateCacheKey(
      CACHE_PREFIX,
      tenantId,
      period.preset,
      period.start,
      period.end,
    );
    const cacheTag = `${CACHE_PREFIX}:${tenantId}`;

    const cached = await cache.get<ExecutiveDashboardData>(cacheKey);
    if (cached !== null) return cached;

    const data = await this.fetchFresh(tenantId, period);

    await cache.set(cacheKey, data, { ttl: CACHE_TTL, tags: [cacheTag] });

    return data;
  }

  private async fetchFresh(
    tenantId: string,
    period: PeriodRange,
  ): Promise<ExecutiveDashboardData> {
    const startDate = new Date(period.start);
    const endDate = new Date(`${period.end}T23:59:59.999Z`);

    // Phase 1: fetch current period data from all 3 services in parallel
    const [kpisResult, pnlResult, profitResult] = await Promise.allSettled([
      this.dashboardService.getDailyKPIs(tenantId, new Date()),
      this.pnlService.generatePnL(tenantId, { start: startDate, end: endDate }),
      profitabilityService.getProfitabilityReport({
        tenantId,
        startDate,
        endDate,
      }),
    ]);

    const sources = this.buildSourceStatus(kpisResult, pnlResult, profitResult);

    // Extract data with fallbacks
    const kpis =
      kpisResult.status === 'fulfilled' && kpisResult.value.success
        ? kpisResult.value.data
        : null;

    const pnl =
      pnlResult.status === 'fulfilled' && pnlResult.value.success
        ? pnlResult.value.data
        : null;

    const profitability =
      profitResult.status === 'fulfilled' ? profitResult.value : null;

    // Phase 2: fetch comparison (prior period) — non-blocking
    const comparison = await this.fetchComparison(tenantId, period);

    // Build response
    const topProducts = this.extractTopProducts(profitability);
    const paymentBreakdown = this.extractPaymentBreakdown(kpis);
    const alerts = this.buildAlerts(pnl, kpis);

    return {
      period,
      netSalesCents: pnl?.revenue.netSalesCents ?? 0,
      grossProfitCents: pnl?.grossProfit.grossProfitCents ?? 0,
      grossMarginPercent: pnl?.grossProfit.grossMarginPercent ?? 0,
      operatingExpensesCents: pnl?.operatingExpenses.totalExpensesCents ?? 0,
      netIncomeCents: pnl?.netIncome.netIncomeCents ?? 0,
      netMarginPercent: pnl?.netIncome.netMarginPercent ?? 0,
      ordersCount: pnl?.revenue.ordersCount ?? kpis?.ordersCount ?? 0,
      avgTicketCents: kpis?.avgTicketCents ?? 0,
      comparison,
      hourlySales: kpis?.hourlySales ?? new Array(24).fill(0),
      paymentBreakdown,
      topProducts,
      alerts,
      sources,
      generatedAt: new Date().toISOString(),
    };
  }

  private async fetchComparison(
    tenantId: string,
    currentPeriod: PeriodRange,
  ): Promise<ExecutiveDashboardData['comparison']> {
    try {
      const priorPeriod = this.calculatePriorPeriod(currentPeriod);
      const priorStart = new Date(priorPeriod.start);
      const priorEnd = new Date(`${priorPeriod.end}T23:59:59.999Z`);

      const result = await this.pnlService.generatePnL(tenantId, {
        start: priorStart,
        end: priorEnd,
      });

      if (!result.success) return null;

      const prior = result.data;

      // Current values (already available from Phase 1, but we need a reference)
      // Re-fetch is avoided by using the pnl data from Phase 1
      // For simplicity, we use the cache which should be warm
      const cacheKey = generateCacheKey(
        CACHE_PREFIX,
        tenantId,
        currentPeriod.preset,
        currentPeriod.start,
        currentPeriod.end,
      );
      const currentCached = await cache.get<ExecutiveDashboardData>(cacheKey);

      // If cache miss (shouldn't happen since Phase 1 just ran), skip comparison
      if (!currentCached) return null;

      return {
        netSalesDelta: this.calcDelta(
          currentCached.netSalesCents,
          prior.revenue.netSalesCents,
        ),
        grossProfitDelta: this.calcDelta(
          currentCached.grossProfitCents,
          prior.grossProfit.grossProfitCents,
        ),
        netIncomeDelta: this.calcDelta(
          currentCached.netIncomeCents,
          prior.netIncome.netIncomeCents,
        ),
        ordersCountDelta: this.calcDelta(
          currentCached.ordersCount,
          prior.revenue.ordersCount,
        ),
      };
    } catch {
      return null;
    }
  }

  private calculatePriorPeriod(current: PeriodRange): { start: string; end: string } {
    const start = new Date(current.start);
    const end = new Date(current.end);
    const durationMs = end.getTime() - start.getTime();

    const priorEnd = new Date(start.getTime() - 1); // day before current start
    const priorStart = new Date(priorEnd.getTime() - durationMs);

    return {
      start: priorStart.toISOString().slice(0, 10),
      end: priorEnd.toISOString().slice(0, 10),
    };
  }

  private calcDelta(current: number, prior: number): number | null {
    if (prior === 0) return current === 0 ? 0 : null;
    return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10; // 1 decimal
  }

  private extractTopProducts(
    profitability: Awaited<ReturnType<typeof profitabilityService.getProfitabilityReport>> | null,
  ): TopProfitableProduct[] {
    if (!profitability?.products?.length) return [];

    return profitability.products
      .slice(0, TOP_PRODUCTS_LIMIT)
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        category: p.category,
        priceCents: unsafeCentavos(Number(p.priceCents)),
        cogsCents: unsafeCOGS(Number(p.cogsCents)),
        profitCents: unsafeProfit(Number(p.profitCents)),
        marginPercent: unsafeMargin(Number(p.marginPercent)),
        unitsSold: p.unitsSold,
        totalProfitCents: unsafeProfit(Number(p.totalProfitCents)),
      }));
  }

  private extractPaymentBreakdown(
    kpis: { paymentBreakdown: Record<string, { count: number; totalCents: number }> } | null,
  ): PaymentMethodSummary[] {
    if (!kpis?.paymentBreakdown) return [];

    return Object.entries(kpis.paymentBreakdown).map(([method, data]) => ({
      method,
      count: data.count,
      totalCents: data.totalCents,
    }));
  }

  private buildAlerts(
    pnl: { grossProfit: { grossMarginPercent: number }; netIncome: { netMarginPercent: number } } | null,
    kpis: { ordersCount: number } | null,
  ): OperationalAlert[] {
    const alerts: OperationalAlert[] = [];
    const now = new Date().toISOString();

    if (pnl) {
      if (pnl.grossProfit.grossMarginPercent < 40) {
        alerts.push({
          id: 'low-gross-margin',
          severity: 'warning',
          message: `Margen bruto bajo: ${pnl.grossProfit.grossMarginPercent.toFixed(1)}% (objetivo: >40%)`,
          timestamp: now,
        });
      }
      if (pnl.netIncome.netMarginPercent < 10) {
        alerts.push({
          id: 'low-net-margin',
          severity: 'critical',
          message: `Margen neto bajo: ${pnl.netIncome.netMarginPercent.toFixed(1)}% (objetivo: >10%)`,
          timestamp: now,
        });
      }
    }

    if (kpis && kpis.ordersCount === 0) {
      alerts.push({
        id: 'no-orders',
        severity: 'info',
        message: 'Sin órdenes en el período seleccionado',
        timestamp: now,
      });
    }

    return alerts;
  }

  private buildSourceStatus(
    kpis: PromiseSettledResult<unknown>,
    pnl: PromiseSettledResult<unknown>,
    profit: PromiseSettledResult<unknown>,
  ): DataSourceStatus {
    const toState = (result: PromiseSettledResult<unknown>): DataSourceState => {
      if (result.status === 'rejected') return 'error';
      // For Result-wrapped services, check success
      const value = result.value as { success?: boolean } | undefined;
      if (value && 'success' in value && !value.success) return 'error';
      return 'ok';
    };

    return {
      dailyKpis: toState(kpis),
      pnl: toState(pnl),
      profitability: toState(profit),
    };
  }
}
