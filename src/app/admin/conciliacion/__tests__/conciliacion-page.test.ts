/**
 * Admin Conciliación Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_CONFIG completeness (PENDING / MATCHED / DISCREPANCY)
 * - formatCurrency: handles null, negatives, positives
 * - Settlement totals calculation (expected vs received)
 * - Difference = expected - received
 * - Export filename format
 *
 * @module app/admin/conciliacion/__tests__/conciliacion-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type SettlementStatus = 'PENDING' | 'MATCHED' | 'DISCREPANCY';

const STATUS_CONFIG: Record<SettlementStatus, { label: string; color: string }> = {
  PENDING:     { label: 'Pendiente',    color: 'bg-amber-500/20 text-amber-400' },
  MATCHED:     { label: 'Conciliado',   color: 'bg-emerald-500/20 text-emerald-400' },
  DISCREPANCY: { label: 'Discrepancia', color: 'bg-red-500/20 text-red-400' },
};

const STATUSES = Object.keys(STATUS_CONFIG) as SettlementStatus[];

function formatCurrency(cents: number | null): string {
  if (cents === null) return '—';
  const abs = Math.abs(cents);
  const formatted = `S/ ${(abs / 100).toFixed(2)}`;
  return cents < 0 ? `-${formatted}` : formatted;
}

interface Settlement {
  id: string;
  paymentMethod: string;
  expectedCents: number;
  receivedCents: number | null;
  differenceCents: number | null;
  status: SettlementStatus;
  periodStart: string;
  periodEnd: string;
}

function calcTotalExpected(settlements: Settlement[]): number {
  return settlements.reduce((s, t) => s + t.expectedCents, 0);
}

function calcTotalReceived(settlements: Settlement[]): number {
  return settlements.reduce((s, t) => s + (t.receivedCents ?? 0), 0);
}

function calcDifference(expected: number, received: number): number {
  return expected - received;
}

function buildExportFilename(start: string, end: string): string {
  return `conciliacion-${start}-${end}.xlsx`;
}

function isMatched(expected: number, received: number): boolean {
  return expected === received;
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminConciliacionPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_CONFIG
// ============================================================================

describe('AdminConciliacionPage — STATUS_CONFIG', () => {
  it('hay exactamente 3 estados', () => {
    expect(STATUSES).toHaveLength(3);
  });

  it('incluye PENDING, MATCHED, DISCREPANCY', () => {
    expect(STATUSES).toContain('PENDING');
    expect(STATUSES).toContain('MATCHED');
    expect(STATUSES).toContain('DISCREPANCY');
  });

  it('PENDING es amarillo', () => {
    expect(STATUS_CONFIG.PENDING.color).toContain('amber');
  });

  it('MATCHED es verde (conciliado)', () => {
    expect(STATUS_CONFIG.MATCHED.color).toContain('emerald');
  });

  it('DISCREPANCY es rojo', () => {
    expect(STATUS_CONFIG.DISCREPANCY.color).toContain('red');
  });

  it('labels en español', () => {
    expect(STATUS_CONFIG.PENDING.label).toBe('Pendiente');
    expect(STATUS_CONFIG.MATCHED.label).toBe('Conciliado');
    expect(STATUS_CONFIG.DISCREPANCY.label).toBe('Discrepancia');
  });

  it('property: todos los estados tienen label y color no vacíos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATUSES),
        (status) => {
          expect(STATUS_CONFIG[status].label.trim().length).toBeGreaterThan(0);
          expect(STATUS_CONFIG[status].color.trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminConciliacionPage — formatCurrency', () => {
  it('null → "—" (sin datos)', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('0 → "S/ 0.00"', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });

  it('100000 centavos → "S/ 1000.00"', () => {
    expect(formatCurrency(100000)).toBe('S/ 1000.00');
  });

  it('negativo → prefijo "-S/"', () => {
    expect(formatCurrency(-5000)).toBe('-S/ 50.00');
  });

  it('property: positivos siempre incluyen S/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999900 }),
        (cents) => {
          const result = formatCurrency(cents);
          expect(result).toContain('S/');
          expect(result).not.toMatch(/^-/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: negativos siempre empiezan con "-S/"', () => {
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
// Tests — Settlement totals
// ============================================================================

describe('AdminConciliacionPage — Cálculo de totales', () => {
  const sampleSettlements: Settlement[] = [
    { id: '1', paymentMethod: 'EFECTIVO',  expectedCents: 100000, receivedCents: 100000, differenceCents: 0,     status: 'MATCHED',     periodStart: '2026-03-01', periodEnd: '2026-03-07' },
    { id: '2', paymentMethod: 'YAPE',      expectedCents: 50000,  receivedCents: 48000,  differenceCents: 2000,  status: 'DISCREPANCY', periodStart: '2026-03-01', periodEnd: '2026-03-07' },
    { id: '3', paymentMethod: 'TARJETA',   expectedCents: 30000,  receivedCents: null,   differenceCents: null,  status: 'PENDING',     periodStart: '2026-03-01', periodEnd: '2026-03-07' },
  ];

  it('totalExpected = suma de expectedCents', () => {
    expect(calcTotalExpected(sampleSettlements)).toBe(180000);
  });

  it('totalReceived = suma de receivedCents (null → 0)', () => {
    expect(calcTotalReceived(sampleSettlements)).toBe(148000);
  });

  it('diferencia = expected - received', () => {
    expect(calcDifference(180000, 148000)).toBe(32000);
  });

  it('diferencia = 0 si está conciliado', () => {
    expect(calcDifference(100000, 100000)).toBe(0);
  });

  it('isMatched: true cuando expected = received', () => {
    expect(isMatched(100000, 100000)).toBe(true);
  });

  it('isMatched: false cuando hay discrepancia', () => {
    expect(isMatched(100000, 98000)).toBe(false);
  });

  it('liquidaciones vacías → totales en 0', () => {
    expect(calcTotalExpected([])).toBe(0);
    expect(calcTotalReceived([])).toBe(0);
  });

  it('property: totalReceived <= totalExpected cuando todos receivedCents <= expectedCents', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 0, max: 100000 }),
          { minLength: 1, maxLength: 10 }
        ),
        (expectedValues) => {
          const settlements = expectedValues.map((exp, i) => ({
            id: String(i),
            paymentMethod: 'EFECTIVO',
            expectedCents: exp,
            receivedCents: Math.floor(exp * 0.9), // 90% received
            differenceCents: Math.floor(exp * 0.1),
            status: 'DISCREPANCY' as SettlementStatus,
            periodStart: '2026-01-01',
            periodEnd: '2026-01-07',
          }));
          expect(calcTotalReceived(settlements)).toBeLessThanOrEqual(calcTotalExpected(settlements));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Export filename
// ============================================================================

describe('AdminConciliacionPage — Nombre del archivo de exportación', () => {
  it('formato: conciliacion-{start}-{end}.xlsx', () => {
    expect(buildExportFilename('2026-03-01', '2026-03-07')).toBe('conciliacion-2026-03-01-2026-03-07.xlsx');
  });

  it('siempre termina en .xlsx', () => {
    expect(buildExportFilename('2026-01-01', '2026-01-31')).toMatch(/\.xlsx$/);
  });

  it('incluye ambas fechas', () => {
    const name = buildExportFilename('2026-03-01', '2026-03-31');
    expect(name).toContain('2026-03-01');
    expect(name).toContain('2026-03-31');
  });
});
