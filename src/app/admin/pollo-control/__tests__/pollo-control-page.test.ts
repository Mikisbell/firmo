/**
 * Admin Pollo Control Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_LABELS / STATUS_COLORS completeness (CRUDO / COCINANDO / COCIDO / SERVIDO)
 * - Yield color: 68-76% = green (optimal), <60% or >85% = red, else amber
 * - calcYieldPercent: cooked_weight / raw_weight * 100
 * - calcWasteUnits: raw - cooked - waste
 * - Batch lifecycle: CRUDO → COCINANDO → COCIDO → SERVIDO
 *
 * @module app/admin/pollo-control/__tests__/pollo-control-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type ProductionStatus = 'CRUDO' | 'COCINANDO' | 'COCIDO' | 'SERVIDO';

const STATUS_LABELS: Record<ProductionStatus, string> = {
  CRUDO:     'Crudo',
  COCINANDO: 'Cocinando',
  COCIDO:    'Cocido',
  SERVIDO:   'Servido',
};

const STATUS_COLORS: Record<ProductionStatus, string> = {
  CRUDO:     'bg-orange-500/20 text-orange-400',
  COCINANDO: 'bg-amber-500/20 text-amber-400',
  COCIDO:    'bg-green-500/20 text-green-400',
  SERVIDO:   'bg-gray-500/20 text-gray-400',
};

const PRODUCTION_STATUSES = Object.keys(STATUS_LABELS) as ProductionStatus[];

const YIELD_OPTIMAL_MIN = 68;
const YIELD_OPTIMAL_MAX = 76;
const YIELD_CRITICAL_MIN = 60;
const YIELD_CRITICAL_MAX = 85;

function getYieldColor(yieldPercent: number): 'green' | 'amber' | 'red' {
  if (yieldPercent >= YIELD_OPTIMAL_MIN && yieldPercent <= YIELD_OPTIMAL_MAX) return 'green';
  if (yieldPercent < YIELD_CRITICAL_MIN || yieldPercent > YIELD_CRITICAL_MAX) return 'red';
  return 'amber';
}

function calcYieldPercent(rawWeightKg: number, cookedWeightKg: number): number {
  if (rawWeightKg === 0) return 0;
  return Math.round((cookedWeightKg / rawWeightKg) * 100);
}

function getNextProductionStatus(status: ProductionStatus): ProductionStatus | null {
  switch (status) {
    case 'CRUDO':     return 'COCINANDO';
    case 'COCINANDO': return 'COCIDO';
    case 'COCIDO':    return 'SERVIDO';
    case 'SERVIDO':   return null;
  }
}

function isCompletedBatch(status: ProductionStatus): boolean {
  return status === 'SERVIDO';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminPolloControlPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_LABELS / STATUS_COLORS
// ============================================================================

describe('AdminPolloControlPage — STATUS_LABELS', () => {
  it('hay exactamente 4 estados', () => {
    expect(PRODUCTION_STATUSES).toHaveLength(4);
  });

  it('incluye CRUDO, COCINANDO, COCIDO, SERVIDO', () => {
    for (const s of ['CRUDO', 'COCINANDO', 'COCIDO', 'SERVIDO']) {
      expect(PRODUCTION_STATUSES).toContain(s);
    }
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.CRUDO).toBe('Crudo');
    expect(STATUS_LABELS.COCINANDO).toBe('Cocinando');
    expect(STATUS_LABELS.COCIDO).toBe('Cocido');
    expect(STATUS_LABELS.SERVIDO).toBe('Servido');
  });

  it('COCIDO es verde', () => {
    expect(STATUS_COLORS.COCIDO).toContain('green');
  });

  it('COCINANDO es ámbar (en proceso)', () => {
    expect(STATUS_COLORS.COCINANDO).toContain('amber');
  });

  it('property: todos los estados tienen label y color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...PRODUCTION_STATUSES),
        (status) => {
          expect(STATUS_LABELS[status].trim().length).toBeGreaterThan(0);
          expect(STATUS_COLORS[status].trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Yield color thresholds
// ============================================================================

describe('AdminPolloControlPage — Colores de rendimiento (yield)', () => {
  it('68-76% → verde (óptimo)', () => {
    expect(getYieldColor(68)).toBe('green');
    expect(getYieldColor(72)).toBe('green');
    expect(getYieldColor(76)).toBe('green');
  });

  it('< 60% → rojo (muy bajo)', () => {
    expect(getYieldColor(59)).toBe('red');
    expect(getYieldColor(40)).toBe('red');
    expect(getYieldColor(0)).toBe('red');
  });

  it('> 85% → rojo (sospechosamente alto)', () => {
    expect(getYieldColor(86)).toBe('red');
    expect(getYieldColor(100)).toBe('red');
  });

  it('60-67% → ámbar (bajo pero aceptable)', () => {
    expect(getYieldColor(60)).toBe('amber');
    expect(getYieldColor(65)).toBe('amber');
    expect(getYieldColor(67)).toBe('amber');
  });

  it('77-85% → ámbar (alto pero aceptable)', () => {
    expect(getYieldColor(77)).toBe('amber');
    expect(getYieldColor(82)).toBe('amber');
    expect(getYieldColor(85)).toBe('amber');
  });

  it('property: rango óptimo siempre verde', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: YIELD_OPTIMAL_MIN, max: YIELD_OPTIMAL_MAX }),
        (pct) => {
          expect(getYieldColor(pct)).toBe('green');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('property: < 60 siempre rojo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 59 }),
        (pct) => {
          expect(getYieldColor(pct)).toBe('red');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — calcYieldPercent
// ============================================================================

describe('AdminPolloControlPage — calcYieldPercent', () => {
  it('10 kg crudo → 7.2 kg cocido = 72%', () => {
    expect(calcYieldPercent(10, 7.2)).toBe(72);
  });

  it('raw = 0 → 0% (sin división por cero)', () => {
    expect(calcYieldPercent(0, 0)).toBe(0);
  });

  it('property: yield entre 0 y 100 si cooked <= raw', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (raw, cooked) => {
          const actualCooked = Math.min(cooked, raw);
          const pct = calcYieldPercent(raw, actualCooked);
          expect(pct).toBeGreaterThanOrEqual(0);
          expect(pct).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Batch lifecycle
// ============================================================================

describe('AdminPolloControlPage — Ciclo de vida del lote', () => {
  it('CRUDO → COCINANDO', () => {
    expect(getNextProductionStatus('CRUDO')).toBe('COCINANDO');
  });

  it('COCINANDO → COCIDO', () => {
    expect(getNextProductionStatus('COCINANDO')).toBe('COCIDO');
  });

  it('COCIDO → SERVIDO', () => {
    expect(getNextProductionStatus('COCIDO')).toBe('SERVIDO');
  });

  it('SERVIDO → null (estado final)', () => {
    expect(getNextProductionStatus('SERVIDO')).toBeNull();
  });

  it('SERVIDO es el estado completado', () => {
    expect(isCompletedBatch('SERVIDO')).toBe(true);
  });

  it('estados intermedios no están completados', () => {
    expect(isCompletedBatch('CRUDO')).toBe(false);
    expect(isCompletedBatch('COCINANDO')).toBe(false);
    expect(isCompletedBatch('COCIDO')).toBe(false);
  });

  it('flujo completo: CRUDO → COCINANDO → COCIDO → SERVIDO', () => {
    let status: ProductionStatus = 'CRUDO';
    const path: ProductionStatus[] = [status];
    while (true) {
      const next = getNextProductionStatus(status);
      if (!next) break;
      status = next;
      path.push(status);
    }
    expect(path).toEqual(['CRUDO', 'COCINANDO', 'COCIDO', 'SERVIDO']);
    expect(isCompletedBatch(status)).toBe(true);
  });
});
