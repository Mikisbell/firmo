/**
 * Z-Report Service Tests
 *
 * @module core/services/__tests__/z-report.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZReportService } from '../z-report.service';

// ============================================================================
// Mock Prisma
// ============================================================================

function createMockPrisma() {
  return {
    shifts: {
      findFirst: vi.fn(),
    },
    payments: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    invoices: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    orders: {
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    z_reports: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
}

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: ZReportService;

const TENANT = 'tenant-1';
const SHIFT_ID = 'shift-1';
const TERMINAL = 'term-1';

const mockClosedShift = {
  id: SHIFT_ID,
  tenant_id: TENANT,
  terminal_id: TERMINAL,
  status: 'CLOSED',
  opened_at: new Date('2026-02-20T08:00:00Z'),
  closed_at: new Date('2026-02-20T18:00:00Z'),
  opened_by: 'emp-1',
  closed_by: 'emp-1',
  cash_opening_cents: 20_000,
  cash_expected_cents: 65_000,
  cash_counted_cents: 64_500,
  diff_cents: -500,
};

beforeEach(() => {
  mockPrisma = createMockPrisma();
  service = new ZReportService(mockPrisma as any);
  // Reset crypto.randomUUID mock
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('report-uuid-1');
});

// ============================================================================
// generateReport
// ============================================================================

describe('generateReport', () => {
  it('debe generar reporte Z para turno cerrado', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(mockClosedShift);
    mockPrisma.z_reports.findFirst.mockResolvedValue(null); // No existing report

    mockPrisma.payments.findMany.mockResolvedValue([
      { payment_method: 'CASH', amount_cents: 30_000, tip_cents: 500 },
      { payment_method: 'CASH', amount_cents: 15_000, tip_cents: 0 },
      { payment_method: 'YAPE', amount_cents: 12_000, tip_cents: 0 },
    ]);

    mockPrisma.invoices.findMany.mockResolvedValue([
      { invoice_type: 'BOLETA', subtotal_cents: 40_678, igv_cents: 7_322, total_cents: 48_000, tax_category: 'GRAVADO' },
      { invoice_type: 'FACTURA', subtotal_cents: 7_627, igv_cents: 1_373, total_cents: 9_000, tax_category: 'GRAVADO' },
    ]);

    mockPrisma.invoices.count
      .mockResolvedValueOnce(0) // voided
      .mockResolvedValueOnce(0); // credit notes

    mockPrisma.orders.count.mockResolvedValue(8);
    mockPrisma.orders.aggregate
      .mockResolvedValueOnce({ _sum: { discount_cents: 2_000 } }) // discounts
      .mockResolvedValueOnce({ _sum: { total_cents: 0 } }); // voids

    mockPrisma.payments.aggregate.mockResolvedValue({
      _sum: { amount_cents: 0 },
      _count: 0,
    });

    mockPrisma.z_reports.create.mockImplementation(({ data }: any) => ({
      ...data,
      generated_at: new Date(),
    }));

    const result = await service.generateReport(TENANT, SHIFT_ID, 'Z', 'emp-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reportType).toBe('Z');
      expect(result.data.grossSalesCents).toBe(57_000);
      expect(result.data.tipsCents).toBe(500);
      expect(result.data.paymentsBreakdown.CASH.count).toBe(2);
      expect(result.data.paymentsBreakdown.CASH.totalCents).toBe(45_000);
      expect(result.data.paymentsBreakdown.YAPE.totalCents).toBe(12_000);
      expect(result.data.boletasCount).toBe(1);
      expect(result.data.facturasCount).toBe(1);
      expect(result.data.gravadoBaseCents).toBe(48_305);
      expect(result.data.gravadoIgvCents).toBe(8_695);
    }
  });

  it('debe retornar reporte Z existente sin regenerar', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(mockClosedShift);
    const existingReport = {
      id: 'existing-report',
      tenant_id: TENANT,
      shift_id: SHIFT_ID,
      terminal_id: TERMINAL,
      report_type: 'Z',
      report_number: 42,
      gross_sales_cents: 50_000,
      net_sales_cents: 48_000,
      discount_cents: 2_000,
      voids_cents: 0,
      refunds_cents: 0,
      tips_cents: 0,
      gravado_base_cents: 40_678,
      gravado_igv_cents: 7_322,
      exonerado_cents: 0,
      inafecto_cents: 0,
      boletas_count: 5,
      boletas_total_cents: 40_000,
      facturas_count: 1,
      facturas_total_cents: 10_000,
      voided_invoices_count: 0,
      credit_notes_count: 0,
      payments_breakdown: { CASH: { count: 4, totalCents: 35_000 } },
      cash_opening_cents: 20_000,
      cash_expected_cents: 55_000,
      cash_counted_cents: 54_500,
      cash_diff_cents: -500,
      orders_count: 6,
      generated_by: 'emp-1',
      generated_at: new Date(),
    };
    mockPrisma.z_reports.findFirst.mockResolvedValue(existingReport);

    const result = await service.generateReport(TENANT, SHIFT_ID, 'Z', 'emp-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('existing-report');
      expect(result.data.reportNumber).toBe(42);
    }
    // Should NOT have called payments.findMany since report already exists
    expect(mockPrisma.payments.findMany).not.toHaveBeenCalled();
  });

  it('debe rechazar reporte Z para turno abierto', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue({
      ...mockClosedShift,
      status: 'OPEN',
    });

    const result = await service.generateReport(TENANT, SHIFT_ID, 'Z', 'emp-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('cerrados');
    }
  });

  it('debe rechazar turno no encontrado', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(null);

    const result = await service.generateReport(TENANT, 'nonexistent', 'Z', 'emp-1');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('debe estimar IGV si no hay facturas emitidas', async () => {
    mockPrisma.shifts.findFirst.mockResolvedValue(mockClosedShift);
    mockPrisma.z_reports.findFirst.mockResolvedValue(null);

    mockPrisma.payments.findMany.mockResolvedValue([
      { payment_method: 'CASH', amount_cents: 11_800, tip_cents: 0 },
    ]);

    mockPrisma.invoices.findMany.mockResolvedValue([]); // No invoices
    mockPrisma.invoices.count.mockResolvedValue(0);
    mockPrisma.orders.count.mockResolvedValue(2);
    mockPrisma.orders.aggregate.mockResolvedValue({ _sum: { discount_cents: 0, total_cents: 0 } });
    mockPrisma.payments.aggregate.mockResolvedValue({ _sum: { amount_cents: 0 }, _count: 0 });

    mockPrisma.z_reports.create.mockImplementation(({ data }: any) => ({
      ...data,
      generated_at: new Date(),
    }));

    const result = await service.generateReport(TENANT, SHIFT_ID, 'Z', 'emp-1');

    expect(result.success).toBe(true);
    if (result.success) {
      // IGV estimated: 11800 / 1.18 = 10000 base, 1800 igv
      expect(result.data.gravadoBaseCents).toBe(10_000);
      expect(result.data.gravadoIgvCents).toBe(1_800);
    }
  });
});

// ============================================================================
// getReport / getReportsByTerminal / getReportByShift
// ============================================================================

describe('getReport', () => {
  it('debe retornar reporte por ID', async () => {
    mockPrisma.z_reports.findFirst.mockResolvedValue({
      id: 'report-1',
      tenant_id: TENANT,
      shift_id: SHIFT_ID,
      terminal_id: TERMINAL,
      report_type: 'Z',
      report_number: 1,
      gross_sales_cents: 50_000,
      net_sales_cents: 48_000,
      discount_cents: 2_000,
      voids_cents: 0,
      refunds_cents: 0,
      tips_cents: 0,
      gravado_base_cents: 40_678,
      gravado_igv_cents: 7_322,
      exonerado_cents: 0,
      inafecto_cents: 0,
      boletas_count: 5,
      boletas_total_cents: 40_000,
      facturas_count: 0,
      facturas_total_cents: 0,
      voided_invoices_count: 0,
      credit_notes_count: 0,
      payments_breakdown: {},
      cash_opening_cents: 20_000,
      cash_expected_cents: 55_000,
      cash_counted_cents: 54_500,
      cash_diff_cents: -500,
      orders_count: 5,
      generated_by: 'emp-1',
      generated_at: new Date(),
    });

    const result = await service.getReport(TENANT, 'report-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('report-1');
    }
  });

  it('debe retornar error si no existe', async () => {
    mockPrisma.z_reports.findFirst.mockResolvedValue(null);

    const result = await service.getReport(TENANT, 'nonexistent');

    expect(result.success).toBe(false);
  });
});

describe('getReportsByTerminal', () => {
  it('debe retornar reportes ordenados', async () => {
    mockPrisma.z_reports.findMany.mockResolvedValue([
      { id: 'r2', report_number: 2, generated_at: new Date(), tenant_id: TENANT, shift_id: 's2', terminal_id: TERMINAL, report_type: 'Z', gross_sales_cents: 0, net_sales_cents: 0, discount_cents: 0, voids_cents: 0, refunds_cents: 0, tips_cents: 0, gravado_base_cents: 0, gravado_igv_cents: 0, exonerado_cents: 0, inafecto_cents: 0, boletas_count: 0, boletas_total_cents: 0, facturas_count: 0, facturas_total_cents: 0, voided_invoices_count: 0, credit_notes_count: 0, payments_breakdown: {}, cash_opening_cents: 0, cash_expected_cents: 0, cash_counted_cents: 0, cash_diff_cents: 0, orders_count: 0, generated_by: 'e1' },
      { id: 'r1', report_number: 1, generated_at: new Date(), tenant_id: TENANT, shift_id: 's1', terminal_id: TERMINAL, report_type: 'Z', gross_sales_cents: 0, net_sales_cents: 0, discount_cents: 0, voids_cents: 0, refunds_cents: 0, tips_cents: 0, gravado_base_cents: 0, gravado_igv_cents: 0, exonerado_cents: 0, inafecto_cents: 0, boletas_count: 0, boletas_total_cents: 0, facturas_count: 0, facturas_total_cents: 0, voided_invoices_count: 0, credit_notes_count: 0, payments_breakdown: {}, cash_opening_cents: 0, cash_expected_cents: 0, cash_counted_cents: 0, cash_diff_cents: 0, orders_count: 0, generated_by: 'e1' },
    ]);

    const result = await service.getReportsByTerminal(TENANT, TERMINAL);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    expect(mockPrisma.z_reports.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT, terminal_id: TERMINAL },
        orderBy: { report_number: 'desc' },
        take: 20,
      }),
    );
  });
});
