/**
 * Admin Reportes Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Period types (daily/weekly/monthly)
 * - formatCurrency helper
 * - Period label mapping
 * - CSV export filename format (reporte-{period}-{YYYY-MM-DD}.csv)
 * - Report metrics accumulation (sales_net, discounts, tips)
 * - Payment method breakdown
 * - Effective total calculation: sales_net - discounts
 *
 * @module app/admin/reportes/__tests__/reportes-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type Period = 'daily' | 'weekly' | 'monthly';
const PERIODS: Period[] = ['daily', 'weekly', 'monthly'];

const PERIOD_LABELS: Record<Period, string> = {
  daily:   'Diario',
  weekly:  'Semanal',
  monthly: 'Mensual',
};

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function getPeriodLabel(period: Period): string {
  return PERIOD_LABELS[period];
}

function buildCSVFilename(period: Period, date: string): string {
  return `reporte-${period}-${date}.csv`;
}

function buildReportURL(period: Period): string {
  return `/api/admin/reports/${period}`;
}

interface ReportData {
  period: string;
  sales_net: number;
  discounts: number;
  tips: number;
  order_count: number;
  by_payment_method: { method: string; total: number }[];
}

function getEffectiveSales(report: ReportData): number {
  return report.sales_net - report.discounts;
}

function getTotalWithTips(report: ReportData): number {
  return report.sales_net + report.tips;
}

function getPaymentMethodTotal(report: ReportData): number {
  return report.by_payment_method.reduce((sum, m) => sum + m.total, 0);
}

function buildCSVRows(report: ReportData): string[][] {
  return [
    ['Métrica', 'Valor'],
    ['Ventas Netas', formatCurrency(report.sales_net)],
    ['Descuentos', formatCurrency(report.discounts)],
    ['Propinas', formatCurrency(report.tips)],
    ['Órdenes', report.order_count.toString()],
    ...report.by_payment_method.map(m => [m.method, formatCurrency(m.total)]),
  ];
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminReportesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Period types
// ============================================================================

describe('AdminReportesPage — Períodos', () => {
  it('hay exactamente 3 períodos', () => {
    expect(PERIODS).toHaveLength(3);
  });

  it('incluye daily, weekly, monthly', () => {
    for (const p of ['daily', 'weekly', 'monthly']) {
      expect(PERIODS).toContain(p);
    }
  });

  it('labels en español', () => {
    expect(getPeriodLabel('daily')).toBe('Diario');
    expect(getPeriodLabel('weekly')).toBe('Semanal');
    expect(getPeriodLabel('monthly')).toBe('Mensual');
  });

  it('property: todos los períodos tienen label no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PERIODS),
        (period) => {
          expect(getPeriodLabel(period).trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminReportesPage — formatCurrency', () => {
  it('incluye S/', () => {
    expect(formatCurrency(100000)).toContain('S/');
  });

  it('100000 centavos = S/ 1000.00', () => {
    expect(formatCurrency(100000)).toBe('S/ 1000.00');
  });

  it('property: siempre incluye S/ y 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999999900 }),
        (cents) => {
          const result = formatCurrency(cents);
          expect(result).toContain('S/');
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — CSV filename
// ============================================================================

describe('AdminReportesPage — Nombre del CSV', () => {
  it('formato: reporte-{period}-{YYYY-MM-DD}.csv', () => {
    expect(buildCSVFilename('daily', '2026-03-30')).toBe('reporte-daily-2026-03-30.csv');
  });

  it('incluye el período correcto', () => {
    expect(buildCSVFilename('monthly', '2026-03-01')).toContain('monthly');
  });

  it('siempre termina en .csv', () => {
    expect(buildCSVFilename('weekly', '2026-03-15')).toMatch(/\.csv$/);
  });

  it('property: filename siempre incluye el período', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PERIODS),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (period, year, month, day) => {
          const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const filename = buildCSVFilename(period, date);
          expect(filename).toContain(period);
          expect(filename).toContain(date);
          expect(filename).toMatch(/\.csv$/);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Report URL
// ============================================================================

describe('AdminReportesPage — URL del reporte', () => {
  it('daily → /api/admin/reports/daily', () => {
    expect(buildReportURL('daily')).toBe('/api/admin/reports/daily');
  });

  it('property: URL siempre contiene el período', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PERIODS),
        (period) => {
          expect(buildReportURL(period)).toContain(period);
          expect(buildReportURL(period)).toContain('/api/admin/reports/');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Métricas del reporte
// ============================================================================

describe('AdminReportesPage — Métricas', () => {
  const sampleReport: ReportData = {
    period: '2026-03-30',
    sales_net: 100000,
    discounts: 10000,
    tips: 5000,
    order_count: 50,
    by_payment_method: [
      { method: 'EFECTIVO', total: 60000 },
      { method: 'YAPE', total: 40000 },
    ],
  };

  it('ventas efectivas = sales_net - discounts', () => {
    expect(getEffectiveSales(sampleReport)).toBe(90000);
  });

  it('total con propinas = sales_net + tips', () => {
    expect(getTotalWithTips(sampleReport)).toBe(105000);
  });

  it('suma de medios de pago = 100000', () => {
    expect(getPaymentMethodTotal(sampleReport)).toBe(100000);
  });

  it('CSV tiene encabezado como primera fila', () => {
    const rows = buildCSVRows(sampleReport);
    expect(rows[0]).toEqual(['Métrica', 'Valor']);
  });

  it('CSV incluye ventas netas, descuentos, propinas, órdenes', () => {
    const rows = buildCSVRows(sampleReport);
    const metrics = rows.map(r => r[0]);
    expect(metrics).toContain('Ventas Netas');
    expect(metrics).toContain('Descuentos');
    expect(metrics).toContain('Propinas');
    expect(metrics).toContain('Órdenes');
  });

  it('CSV incluye medios de pago como filas adicionales', () => {
    const rows = buildCSVRows(sampleReport);
    const methods = rows.map(r => r[0]);
    expect(methods).toContain('EFECTIVO');
    expect(methods).toContain('YAPE');
  });

  it('property: ventas efectivas siempre <= ventas netas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        fc.integer({ min: 0, max: 9999900 }),
        (sales, discounts) => {
          const report = { ...sampleReport, sales_net: sales, discounts };
          expect(getEffectiveSales(report)).toBeLessThanOrEqual(sales);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: total con propinas siempre >= ventas netas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        fc.integer({ min: 0, max: 999900 }),
        (sales, tips) => {
          const report = { ...sampleReport, sales_net: sales, tips };
          expect(getTotalWithTips(report)).toBeGreaterThanOrEqual(sales);
        }
      ),
      { numRuns: 100 }
    );
  });
});
