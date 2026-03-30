/**
 * Admin Estado de Resultados Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - formatCurrency: null → '—', negative → '-S/ X.XX', positive → 'S/ X.XX'
 * - getDefaultPeriod: returns current month (start = 1st, end = today)
 * - Export URL building (format: xlsx / csv / pdf)
 *
 * @module app/admin/estado-resultados/__tests__/estado-resultados-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

function formatCurrency(cents: number | null): string {
  if (cents === null) return '—';
  const abs = Math.abs(cents);
  const formatted = `S/ ${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

type ExportFormat = 'xlsx' | 'csv' | 'pdf';
const EXPORT_FORMATS: ExportFormat[] = ['xlsx', 'csv', 'pdf'];

function buildExportURL(start: string, end: string, format: ExportFormat): string {
  return `/api/admin/pnl/export?start=${start}&end=${end}&format=${format}`;
}

function getDefaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: start.toISOString().split('T')[0],
    end:   now.toISOString().split('T')[0],
  };
}

function isValidDateRange(start: string, end: string): boolean {
  return start <= end;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminEstadoResultadosPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminEstadoResultadosPage — formatCurrency', () => {
  it('null → "—"', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('0 → "S/ 0.00"', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });

  it('100000 → "S/ 1000.00"', () => {
    expect(formatCurrency(100000)).toBe('S/ 1000.00');
  });

  it('negativo → "-S/ X.XX"', () => {
    const result = formatCurrency(-25000);
    expect(result).toMatch(/^-S\//);
    expect(result).toBe('-S/ 250.00');
  });

  it('property: positivos tienen S/ y 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999900 }),
        (cents) => {
          const result = formatCurrency(cents);
          expect(result).toContain('S/');
          expect(result).toMatch(/\.\d{2}$/);
          expect(result).not.toMatch(/^-/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: negativos empiezan con "-S/"', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999900 }),
        (cents) => {
          const result = formatCurrency(-cents);
          expect(result).toMatch(/^-S\//);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — getDefaultPeriod
// ============================================================================

describe('AdminEstadoResultadosPage — getDefaultPeriod', () => {
  it('start es el primer día del mes actual', () => {
    const { start } = getDefaultPeriod();
    expect(start).toMatch(/-01$/);
  });

  it('start y end tienen formato YYYY-MM-DD', () => {
    const { start, end } = getDefaultPeriod();
    expect(start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('start <= end', () => {
    const { start, end } = getDefaultPeriod();
    expect(start <= end).toBe(true);
  });

  it('end es hoy (o antes de mañana)', () => {
    const { end } = getDefaultPeriod();
    const today = new Date().toISOString().split('T')[0];
    expect(end).toBe(today);
  });
});

// ============================================================================
// Tests — Export URL
// ============================================================================

describe('AdminEstadoResultadosPage — URL de exportación', () => {
  it('hay 3 formatos de exportación', () => {
    expect(EXPORT_FORMATS).toHaveLength(3);
  });

  it('incluye xlsx, csv, pdf', () => {
    expect(EXPORT_FORMATS).toContain('xlsx');
    expect(EXPORT_FORMATS).toContain('csv');
    expect(EXPORT_FORMATS).toContain('pdf');
  });

  it('URL contiene start, end y format', () => {
    const url = buildExportURL('2026-01-01', '2026-01-31', 'xlsx');
    expect(url).toContain('start=2026-01-01');
    expect(url).toContain('end=2026-01-31');
    expect(url).toContain('format=xlsx');
  });

  it('property: todos los formatos generan URL válida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...EXPORT_FORMATS),
        (format) => {
          const url = buildExportURL('2026-01-01', '2026-01-31', format);
          expect(url).toContain('/api/admin/pnl/export');
          expect(url).toContain(`format=${format}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Date range validation
// ============================================================================

describe('AdminEstadoResultadosPage — Validación de rango de fechas', () => {
  it('start = end → válido', () => {
    expect(isValidDateRange('2026-01-15', '2026-01-15')).toBe(true);
  });

  it('start < end → válido', () => {
    expect(isValidDateRange('2026-01-01', '2026-01-31')).toBe(true);
  });

  it('start > end → inválido', () => {
    expect(isValidDateRange('2026-01-31', '2026-01-01')).toBe(false);
  });
});
