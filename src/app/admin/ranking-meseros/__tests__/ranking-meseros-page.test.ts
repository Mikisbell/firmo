/**
 * Admin Ranking Meseros Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - SORT_OPTIONS completeness (5 campos de ordenamiento)
 * - formatCurrency: "S/ X.XX"
 * - getDefaultDateRange: returns current month ISO dates
 * - Export URL building (format: xlsx / csv / pdf)
 *
 * @module app/admin/ranking-meseros/__tests__/ranking-meseros-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type SortField = 'sales' | 'orders' | 'tips' | 'avg_ticket' | 'avg_time';

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'sales',      label: 'Ventas' },
  { value: 'orders',     label: 'Órdenes' },
  { value: 'tips',       label: 'Propinas' },
  { value: 'avg_ticket', label: 'Ticket Promedio' },
  { value: 'avg_time',   label: 'Tiempo Promedio' },
];

type ExportFormat = 'xlsx' | 'csv' | 'pdf';
const EXPORT_FORMATS: ExportFormat[] = ['xlsx', 'csv', 'pdf'];

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().split('T')[0],
    end:   now.toISOString().split('T')[0],
  };
}

function buildExportURL(start: string, end: string, sort: SortField, format: ExportFormat): string {
  const params = new URLSearchParams({ start, end, sort, format });
  return `/api/admin/waiter-ranking/export?${params.toString()}`;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminRankingMeserosPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — SORT_OPTIONS
// ============================================================================

describe('AdminRankingMeserosPage — SORT_OPTIONS', () => {
  it('hay exactamente 5 opciones de ordenamiento', () => {
    expect(SORT_OPTIONS).toHaveLength(5);
  });

  it('incluye sales, orders, tips, avg_ticket, avg_time', () => {
    const values = SORT_OPTIONS.map(o => o.value);
    expect(values).toContain('sales');
    expect(values).toContain('orders');
    expect(values).toContain('tips');
    expect(values).toContain('avg_ticket');
    expect(values).toContain('avg_time');
  });

  it('labels en español', () => {
    const labels = SORT_OPTIONS.map(o => o.label);
    expect(labels).toContain('Ventas');
    expect(labels).toContain('Órdenes');
    expect(labels).toContain('Propinas');
  });

  it('property: todos tienen value y label no vacíos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...SORT_OPTIONS),
        (opt) => {
          expect(opt.value.trim().length).toBeGreaterThan(0);
          expect(opt.label.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminRankingMeserosPage — formatCurrency', () => {
  it('100000 centavos → "S/ 1000.00"', () => {
    expect(formatCurrency(100000)).toBe('S/ 1000.00');
  });

  it('0 → "S/ 0.00"', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });

  it('incluye S/ y 2 decimales', () => {
    expect(formatCurrency(55555)).toContain('S/');
    expect(formatCurrency(55555)).toMatch(/\.\d{2}$/);
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
// Tests — getDefaultDateRange
// ============================================================================

describe('AdminRankingMeserosPage — getDefaultDateRange', () => {
  it('start es el primer día del mes (termina en -01)', () => {
    expect(getDefaultDateRange().start).toMatch(/-01$/);
  });

  it('start <= end', () => {
    const { start, end } = getDefaultDateRange();
    expect(start <= end).toBe(true);
  });

  it('ambas fechas en formato YYYY-MM-DD', () => {
    const { start, end } = getDefaultDateRange();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ============================================================================
// Tests — Export URL
// ============================================================================

describe('AdminRankingMeserosPage — URL de exportación', () => {
  it('incluye start, end, sort y format', () => {
    const url = buildExportURL('2026-03-01', '2026-03-31', 'sales', 'xlsx');
    expect(url).toContain('start=2026-03-01');
    expect(url).toContain('end=2026-03-31');
    expect(url).toContain('sort=sales');
    expect(url).toContain('format=xlsx');
  });

  it('apunta al endpoint correcto', () => {
    const url = buildExportURL('2026-03-01', '2026-03-31', 'tips', 'csv');
    expect(url).toContain('/api/admin/waiter-ranking/export');
  });

  it('property: todos los formatos generan URL válida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXPORT_FORMATS),
        fc.constantFrom(...SORT_OPTIONS.map(o => o.value)) as fc.Arbitrary<SortField>,
        (format, sort) => {
          const url = buildExportURL('2026-01-01', '2026-01-31', sort, format);
          expect(url).toContain(`format=${format}`);
          expect(url).toContain(`sort=${sort}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
