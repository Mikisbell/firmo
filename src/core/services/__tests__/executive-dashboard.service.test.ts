import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutiveDashboardService } from '../executive-dashboard.service';
import type { PeriodRange } from '@/src/core/types/executive-dashboard';
import { ok, err, DomainError } from '@/src/core/result';

// vi.hoisted ensures these are available when vi.mock factories run (both are hoisted)
const {
  mockGetDailyKPIs,
  mockGeneratePnL,
  mockGetProfitabilityReport,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockGetDailyKPIs: vi.fn(),
  mockGeneratePnL: vi.fn(),
  mockGetProfitabilityReport: vi.fn(),
  mockCacheGet: vi.fn().mockResolvedValue(null),
  mockCacheSet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/src/core/cache/cache-service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
  },
  generateCacheKey: vi.fn((...args: string[]) => args.join(':')),
}));

vi.mock('../profitability.service', () => ({
  profitabilityService: {
    getProfitabilityReport: mockGetProfitabilityReport,
  },
}));

vi.mock('../dashboard.service', () => ({
  DashboardService: class MockDashboardService {
    getDailyKPIs = mockGetDailyKPIs;
  },
}));

vi.mock('../pnl-report.service', () => ({
  PnLReportService: class MockPnLReportService {
    generatePnL = mockGeneratePnL;
  },
}));

const TENANT_ID = 'tenant-test-123';
const TODAY_PERIOD: PeriodRange = {
  preset: 'today',
  start: '2026-03-01',
  end: '2026-03-01',
};


const KPIS_DATA = {
  ordersCount: 42,
  grossSalesCents: 350000,
  avgTicketCents: 8333,
  topProducts: [
    { name: 'Pollo a la Brasa', qty: 15, revenueCents: 150000 },
  ],
  paymentBreakdown: {
    CASH: { count: 20, totalCents: 200000 },
    YAPE: { count: 15, totalCents: 100000 },
    CARD: { count: 7, totalCents: 50000 },
  },
  hourlySales: Array.from({ length: 24 }, (_, i) =>
    i >= 12 && i <= 21 ? 25000 : 0,
  ),
};

function mockKPIs() {
  return ok(KPIS_DATA);
}

const PNL_DATA = {
  period: { start: '2026-03-01', end: '2026-03-01' },
  revenue: {
    grossSalesCents: 350000,
    discountsCents: 10000,
    refundsCents: 5000,
    deliveryFeesCents: 8000,
    tipsCents: 15000,
    netSalesCents: 343000,
    ordersCount: 42,
  },
  cogs: { totalCogsCents: 120000, purchasesCents: 120000 },
  grossProfit: { grossProfitCents: 223000, grossMarginPercent: 65.0 },
  operatingExpenses: {
    totalExpensesCents: 80000,
    payrollCents: 60000,
    pettyCashExpensesCents: 20000,
    byCategory: [
      { category: 'SUPPLIES', amountCents: 10000 },
      { category: 'TRANSPORT', amountCents: 10000 },
    ],
  },
  netIncome: { netIncomeCents: 143000, netMarginPercent: 41.7 },
};

function mockPnL() {
  return ok(PNL_DATA);
}

function mockProfitability() {
  return {
    products: [
      {
        productId: 'prod-1',
        productName: 'Pollo a la Brasa',
        category: 'Pollos',
        categoryId: 'cat-1',
        priceCents: 3500,
        cogsCents: 1200,
        profitCents: 2300,
        marginPercent: 65.7,
        unitsSold: 15,
        totalRevenueCents: 52500,
        totalProfitCents: 34500,
      },
      {
        productId: 'prod-2',
        productName: 'Papas Fritas',
        category: 'Guarniciones',
        categoryId: 'cat-2',
        priceCents: 1200,
        cogsCents: 300,
        profitCents: 900,
        marginPercent: 75.0,
        unitsSold: 30,
        totalRevenueCents: 36000,
        totalProfitCents: 27000,
      },
    ],
    summary: {
      totalRevenueCents: 88500,
      totalCogsCents: 1500,
      totalProfitCents: 61500,
      averageMargin: 70.3,
    },
    period: {
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-01'),
    },
  };
}

function setupDefaultMocks() {
  mockGetDailyKPIs.mockResolvedValue(mockKPIs());
  mockGeneratePnL.mockResolvedValue(mockPnL());
  mockGetProfitabilityReport.mockResolvedValue(mockProfitability());
}

describe('ExecutiveDashboardService', () => {
  let service: ExecutiveDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheGet.mockResolvedValue(null);
    setupDefaultMocks();
    service = new ExecutiveDashboardService(null as never);
  });

  describe('getData — happy path', () => {
    it('returns complete dashboard data for today', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.period).toEqual(TODAY_PERIOD);
      expect(data.netSalesCents).toBe(343000);
      expect(data.grossProfitCents).toBe(223000);
      expect(data.grossMarginPercent).toBe(65.0);
      expect(data.operatingExpensesCents).toBe(80000);
      expect(data.netIncomeCents).toBe(143000);
      expect(data.netMarginPercent).toBe(41.7);
      expect(data.ordersCount).toBe(42);
      expect(data.avgTicketCents).toBe(8333);
      expect(data.sources.dailyKpis).toBe('ok');
      expect(data.sources.pnl).toBe('ok');
      expect(data.sources.profitability).toBe('ok');
      expect(data.generatedAt).toBeDefined();
    });

    it('returns top 5 profitable products sorted by totalProfitCents', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.topProducts).toHaveLength(2);
      expect(data.topProducts[0].productName).toBe('Pollo a la Brasa');
      expect(data.topProducts[0].totalProfitCents).toBe(34500);
    });

    it('returns payment breakdown from KPIs', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.paymentBreakdown).toHaveLength(3);
      const cash = data.paymentBreakdown.find((p) => p.method === 'CASH');
      expect(cash?.totalCents).toBe(200000);
      expect(cash?.count).toBe(20);
    });

    it('returns hourly sales from KPIs', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.hourlySales).toHaveLength(24);
      expect(data.hourlySales[12]).toBe(25000);
      expect(data.hourlySales[0]).toBe(0);
    });
  });

  describe('getData — cache behavior', () => {
    it('returns cached data when available', async () => {
      const cachedData = { period: TODAY_PERIOD, netSalesCents: 999 } as never;
      mockCacheGet.mockResolvedValue(cachedData);

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data).toBe(cachedData);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('caches fresh data with ttl and tags', async () => {
      await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ period: TODAY_PERIOD }),
        { ttl: 60, tags: [`exec-dash:${TENANT_ID}`] },
      );
    });
  });

  describe('getData — partial failures', () => {
    it('returns data with pnl=error when PnL service fails', async () => {
      mockGeneratePnL.mockResolvedValue(
        err(new DomainError('DB connection lost', 'DB_ERROR')),
      );

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.sources.pnl).toBe('error');
      expect(data.netSalesCents).toBe(0);
      expect(data.grossProfitCents).toBe(0);
      // KPIs still work
      expect(data.sources.dailyKpis).toBe('ok');
      expect(data.avgTicketCents).toBe(8333);
    });

    it('returns data with dailyKpis=error when Dashboard service rejects', async () => {
      mockGetDailyKPIs.mockRejectedValue(new Error('timeout'));

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.sources.dailyKpis).toBe('error');
      expect(data.hourlySales).toEqual(new Array(24).fill(0));
      expect(data.paymentBreakdown).toEqual([]);
      // PnL still works
      expect(data.sources.pnl).toBe('ok');
      expect(data.netSalesCents).toBe(343000);
    });

    it('returns data with profitability=error when Profitability service throws', async () => {
      mockGetProfitabilityReport.mockRejectedValue(new Error('recipe not found'));

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.sources.profitability).toBe('error');
      expect(data.topProducts).toEqual([]);
      // Others still work
      expect(data.sources.dailyKpis).toBe('ok');
      expect(data.sources.pnl).toBe('ok');
    });

    it('returns all zeroes when all services fail', async () => {
      mockGetDailyKPIs.mockRejectedValue(new Error('fail'));
      mockGeneratePnL.mockRejectedValue(new Error('fail'));
      mockGetProfitabilityReport.mockRejectedValue(new Error('fail'));

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(data.netSalesCents).toBe(0);
      expect(data.grossProfitCents).toBe(0);
      expect(data.ordersCount).toBe(0);
      expect(data.topProducts).toEqual([]);
      expect(data.paymentBreakdown).toEqual([]);
      expect(data.sources.dailyKpis).toBe('error');
      expect(data.sources.pnl).toBe('error');
      expect(data.sources.profitability).toBe('error');
    });
  });

  describe('getData — alerts', () => {
    it('generates no alerts when margins are healthy', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      // Gross margin 65% > 40%, net margin 41.7% > 10%
      expect(data.alerts).toEqual([]);
    });

    it('generates warning when gross margin < 40%', async () => {
      mockGeneratePnL.mockResolvedValue(
        ok({
          ...PNL_DATA,
          grossProfit: { grossProfitCents: 50000, grossMarginPercent: 25.0 },
        }),
      );

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      const marginAlert = data.alerts.find((a) => a.id === 'low-gross-margin');
      expect(marginAlert).toBeDefined();
      expect(marginAlert?.severity).toBe('warning');
    });

    it('generates critical alert when net margin < 10%', async () => {
      mockGeneratePnL.mockResolvedValue(
        ok({
          ...PNL_DATA,
          netIncome: { netIncomeCents: 15000, netMarginPercent: 5.0 },
        }),
      );

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      const netAlert = data.alerts.find((a) => a.id === 'low-net-margin');
      expect(netAlert).toBeDefined();
      expect(netAlert?.severity).toBe('critical');
    });

    it('generates info alert when no orders', async () => {
      mockGetDailyKPIs.mockResolvedValue(
        ok({ ...KPIS_DATA, ordersCount: 0 }),
      );

      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      const noOrdersAlert = data.alerts.find((a) => a.id === 'no-orders');
      expect(noOrdersAlert).toBeDefined();
      expect(noOrdersAlert?.severity).toBe('info');
    });
  });

  describe('getData — money integrity', () => {
    it('all monetary values are integers (centavos)', async () => {
      const data = await service.getData(TENANT_ID, TODAY_PERIOD);

      expect(Number.isInteger(data.netSalesCents)).toBe(true);
      expect(Number.isInteger(data.grossProfitCents)).toBe(true);
      expect(Number.isInteger(data.operatingExpensesCents)).toBe(true);
      expect(Number.isInteger(data.netIncomeCents)).toBe(true);
      expect(Number.isInteger(data.ordersCount)).toBe(true);
      expect(Number.isInteger(data.avgTicketCents)).toBe(true);

      for (const p of data.topProducts) {
        expect(Number.isInteger(Number(p.priceCents))).toBe(true);
        expect(Number.isInteger(Number(p.cogsCents))).toBe(true);
        expect(Number.isInteger(Number(p.profitCents))).toBe(true);
        expect(Number.isInteger(Number(p.totalProfitCents))).toBe(true);
      }

      for (const pm of data.paymentBreakdown) {
        expect(Number.isInteger(pm.totalCents)).toBe(true);
        expect(Number.isInteger(pm.count)).toBe(true);
      }
    });
  });
});
