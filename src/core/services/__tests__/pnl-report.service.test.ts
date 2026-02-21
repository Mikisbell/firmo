/**
 * P&L Report Service Tests
 *
 * @module core/services/__tests__/pnl-report.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PnLReportService } from '../pnl-report.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    daily_sales_summary: { findMany: vi.fn() },
    petty_cash_transactions: { findMany: vi.fn() },
    purchase_orders: { findMany: vi.fn() },
    payroll_records: { findMany: vi.fn() },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: PnLReportService;

const TENANT = 'tenant-1';
const period = { start: new Date('2026-02-01'), end: new Date('2026-02-28') };

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new PnLReportService(mockPrisma as any);
});

// ============================================================================
// Helpers
// ============================================================================

function mockDefaults() {
  mockPrisma.daily_sales_summary.findMany.mockResolvedValue([
    {
      gross_sales_cents: 500000,
      discount_cents: 25000,
      refunds_cents: 10000,
      delivery_fee_cents: 15000,
      tips_cents: 20000,
      orders_count: 200,
    },
  ]);
  mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([
    { amount: 5000, category: 'SUPPLIES' },
    { amount: 3000, category: 'TRANSPORT' },
    { amount: 2000, category: 'SUPPLIES' },
  ]);
  mockPrisma.purchase_orders.findMany.mockResolvedValue([
    { total_cents: 120000 },
    { total_cents: 80000 },
  ]);
  mockPrisma.payroll_records.findMany.mockResolvedValue([
    { gross_salary_cents: 150000 },
    { gross_salary_cents: 130000 },
  ]);
}

// ============================================================================
// generatePnL
// ============================================================================

describe('generatePnL', () => {
  it('debe generar reporte completo', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period.start).toBe('2026-02-01');
      expect(result.data.period.end).toBe('2026-02-28');
    }
  });

  it('debe calcular revenue correctamente', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      const rev = result.data.revenue;
      expect(rev.grossSalesCents).toBe(500000);
      expect(rev.discountsCents).toBe(25000);
      expect(rev.refundsCents).toBe(10000);
      expect(rev.deliveryFeesCents).toBe(15000);
      expect(rev.tipsCents).toBe(20000);
      // netSales = 500000 - 25000 - 10000 + 15000 = 480000
      expect(rev.netSalesCents).toBe(480000);
      expect(rev.ordersCount).toBe(200);
    }
  });

  it('debe calcular COGS desde compras recibidas', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      // 120000 + 80000 = 200000
      expect(result.data.cogs.totalCogsCents).toBe(200000);
      expect(result.data.cogs.purchasesCents).toBe(200000);
    }
  });

  it('debe calcular utilidad bruta correctamente', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      // netSales=480000, cogs=200000, gross=280000
      expect(result.data.grossProfit.grossProfitCents).toBe(280000);
      // margin = 280000/480000 * 100 = 58.33%
      expect(result.data.grossProfit.grossMarginPercent).toBeCloseTo(58.33, 1);
    }
  });

  it('debe calcular gastos operativos correctamente', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      const ops = result.data.operatingExpenses;
      // payroll = 150000 + 130000 = 280000
      expect(ops.payrollCents).toBe(280000);
      // petty cash = 5000 + 3000 + 2000 = 10000
      expect(ops.pettyCashExpensesCents).toBe(10000);
      expect(ops.totalExpensesCents).toBe(290000);
    }
  });

  it('debe desglosar gastos por categoría', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      const cats = result.data.operatingExpenses.byCategory;
      expect(cats).toHaveLength(2);
      // SUPPLIES: 5000 + 2000 = 7000 (primero por ser mayor)
      expect(cats[0].category).toBe('SUPPLIES');
      expect(cats[0].amountCents).toBe(7000);
      expect(cats[1].category).toBe('TRANSPORT');
      expect(cats[1].amountCents).toBe(3000);
    }
  });

  it('debe calcular utilidad neta correctamente', async () => {
    mockDefaults();
    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      // gross=280000, expenses=290000, net=-10000
      expect(result.data.netIncome.netIncomeCents).toBe(-10000);
      // margin = -10000/480000 * 100 = -2.08%
      expect(result.data.netIncome.netMarginPercent).toBeCloseTo(-2.08, 1);
    }
  });

  it('debe manejar período sin datos', async () => {
    mockPrisma.daily_sales_summary.findMany.mockResolvedValue([]);
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    mockPrisma.payroll_records.findMany.mockResolvedValue([]);

    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue.grossSalesCents).toBe(0);
      expect(result.data.revenue.netSalesCents).toBe(0);
      expect(result.data.cogs.totalCogsCents).toBe(0);
      expect(result.data.grossProfit.grossProfitCents).toBe(0);
      expect(result.data.grossProfit.grossMarginPercent).toBe(0);
      expect(result.data.netIncome.netIncomeCents).toBe(0);
      expect(result.data.netIncome.netMarginPercent).toBe(0);
    }
  });

  it('debe rechazar período inválido (start > end)', async () => {
    const result = await service.generatePnL(TENANT, {
      start: new Date('2026-03-01'),
      end: new Date('2026-02-01'),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('anterior');
    }
  });

  it('debe sumar múltiples días de ventas', async () => {
    mockPrisma.daily_sales_summary.findMany.mockResolvedValue([
      {
        gross_sales_cents: 100000,
        discount_cents: 5000,
        refunds_cents: 2000,
        delivery_fee_cents: 3000,
        tips_cents: 5000,
        orders_count: 50,
      },
      {
        gross_sales_cents: 120000,
        discount_cents: 6000,
        refunds_cents: 1000,
        delivery_fee_cents: 4000,
        tips_cents: 6000,
        orders_count: 60,
      },
    ]);
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    mockPrisma.payroll_records.findMany.mockResolvedValue([]);

    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue.grossSalesCents).toBe(220000);
      expect(result.data.revenue.discountsCents).toBe(11000);
      expect(result.data.revenue.ordersCount).toBe(110);
    }
  });

  it('debe calcular margen bruto 100% cuando no hay COGS', async () => {
    mockPrisma.daily_sales_summary.findMany.mockResolvedValue([
      {
        gross_sales_cents: 100000,
        discount_cents: 0,
        refunds_cents: 0,
        delivery_fee_cents: 0,
        tips_cents: 0,
        orders_count: 50,
      },
    ]);
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([]);
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    mockPrisma.payroll_records.findMany.mockResolvedValue([]);

    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grossProfit.grossMarginPercent).toBe(100);
    }
  });

  it('debe manejar solo gastos sin ventas', async () => {
    mockPrisma.daily_sales_summary.findMany.mockResolvedValue([]);
    mockPrisma.petty_cash_transactions.findMany.mockResolvedValue([
      { amount: 5000, category: 'SUPPLIES' },
    ]);
    mockPrisma.purchase_orders.findMany.mockResolvedValue([]);
    mockPrisma.payroll_records.findMany.mockResolvedValue([
      { gross_salary_cents: 100000 },
    ]);

    const result = await service.generatePnL(TENANT, period);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.netIncome.netIncomeCents).toBe(-105000);
      expect(result.data.netIncome.netMarginPercent).toBe(0); // no revenue → 0%
    }
  });

  it('debe ejecutar todas las consultas en paralelo', async () => {
    mockDefaults();

    await service.generatePnL(TENANT, period);

    // All 4 data sources should be queried
    expect(mockPrisma.daily_sales_summary.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.petty_cash_transactions.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.purchase_orders.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.payroll_records.findMany).toHaveBeenCalledTimes(1);
  });
});
