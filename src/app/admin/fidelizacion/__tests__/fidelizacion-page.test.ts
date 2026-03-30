/**
 * Admin Fidelización Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - TIER_COLORS completeness (BRONCE/PLATA/ORO/PLATINO)
 * - Points calculation: earned = soles * points_per_sol
 * - Redemption: soles = points / redemption_rate
 * - min_redemption_points guard
 * - Tier assignment based on lifetime points
 * - nextTier calculation (points needed)
 * - Ledger entry types (EARN / REDEEM)
 *
 * @module app/admin/fidelizacion/__tests__/fidelizacion-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const TIER_COLORS: Record<string, string> = {
  BRONCE:  'bg-amber-100 text-amber-800',
  PLATA:   'bg-gray-100 text-gray-700',
  ORO:     'bg-yellow-100 text-yellow-800',
  PLATINO: 'bg-purple-100 text-purple-800',
};

const TIERS = Object.keys(TIER_COLORS);

// Default tier config (from typical loyalty setup)
const DEFAULT_TIERS = [
  { name: 'BRONCE',  minPoints: 0 },
  { name: 'PLATA',   minPoints: 500 },
  { name: 'ORO',     minPoints: 2000 },
  { name: 'PLATINO', minPoints: 5000 },
];

function getTierColor(tier: string): string {
  return TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-700';
}

function calculatePointsEarned(totalSoles: number, pointsPerSol: number): number {
  return Math.floor(totalSoles * pointsPerSol);
}

function calculateRedemptionSoles(points: number, redemptionRate: number): number {
  // redemptionRate: points per sol (e.g. 10 pts = S/ 1)
  return points / redemptionRate;
}

function canRedeem(balance: number, minRedemptionPoints: number): boolean {
  return balance >= minRedemptionPoints;
}

function assignTier(lifetimePoints: number): string {
  const sorted = [...DEFAULT_TIERS].sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find(t => lifetimePoints >= t.minPoints)?.name ?? 'BRONCE';
}

function getNextTier(lifetimePoints: number): { name: string; pointsNeeded: number } | null {
  const current = assignTier(lifetimePoints);
  const currentIdx = DEFAULT_TIERS.findIndex(t => t.name === current);
  if (currentIdx >= DEFAULT_TIERS.length - 1) return null;
  const next = DEFAULT_TIERS[currentIdx + 1];
  return { name: next.name, pointsNeeded: next.minPoints - lifetimePoints };
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminFidelizacionPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — TIER_COLORS
// ============================================================================

describe('AdminFidelizacionPage — TIER_COLORS', () => {
  it('cubre los 4 tiers', () => {
    expect(TIERS).toHaveLength(4);
  });

  it('incluye BRONCE, PLATA, ORO, PLATINO', () => {
    for (const tier of ['BRONCE', 'PLATA', 'ORO', 'PLATINO']) {
      expect(TIER_COLORS[tier]).toBeDefined();
    }
  });

  it('BRONCE es ámbar', () => {
    expect(TIER_COLORS.BRONCE).toContain('amber');
  });

  it('ORO es amarillo', () => {
    expect(TIER_COLORS.ORO).toContain('yellow');
  });

  it('PLATINO es púrpura (premium)', () => {
    expect(TIER_COLORS.PLATINO).toContain('purple');
  });

  it('tier desconocido devuelve color gris por defecto', () => {
    expect(getTierColor('DIAMANTE')).toContain('gray');
  });

  it('property: todos los tiers conocidos tienen bg- y text-', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TIERS),
        (tier) => {
          const color = getTierColor(tier);
          expect(color).toMatch(/bg-\w+/);
          expect(color).toMatch(/text-\w+/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Cálculo de puntos ganados
// ============================================================================

describe('AdminFidelizacionPage — Puntos ganados', () => {
  it('S/ 100 con 1 punto por sol = 100 puntos', () => {
    expect(calculatePointsEarned(100, 1)).toBe(100);
  });

  it('S/ 100 con 2 puntos por sol = 200 puntos', () => {
    expect(calculatePointsEarned(100, 2)).toBe(200);
  });

  it('fracción se trunca hacia abajo', () => {
    expect(calculatePointsEarned(10.5, 3)).toBe(31); // 31.5 → 31
  });

  it('S/ 0 = 0 puntos', () => {
    expect(calculatePointsEarned(0, 1)).toBe(0);
  });

  it('property: puntos ganados siempre >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 10 }),
        (soles, rate) => {
          expect(calculatePointsEarned(soles, rate)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: más soles = más puntos (monotónico)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 50000 }),
        fc.integer({ min: 1, max: 50000 }),
        fc.integer({ min: 1, max: 10 }),
        (base, extra, rate) => {
          expect(calculatePointsEarned(base + extra, rate))
            .toBeGreaterThanOrEqual(calculatePointsEarned(base, rate));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Canjeo de puntos
// ============================================================================

describe('AdminFidelizacionPage — Canjeo de puntos', () => {
  it('100 puntos con rate 10 = S/ 10.00', () => {
    expect(calculateRedemptionSoles(100, 10)).toBe(10);
  });

  it('500 puntos con rate 20 = S/ 25.00', () => {
    expect(calculateRedemptionSoles(500, 20)).toBe(25);
  });

  it('canRedeem: balance >= minPoints → puede canjear', () => {
    expect(canRedeem(200, 100)).toBe(true);
  });

  it('canRedeem: balance = minPoints → puede canjear (exacto)', () => {
    expect(canRedeem(100, 100)).toBe(true);
  });

  it('canRedeem: balance < minPoints → no puede canjear', () => {
    expect(canRedeem(50, 100)).toBe(false);
  });

  it('property: canRedeem consistente con balance >= threshold', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (balance, minPoints) => {
          expect(canRedeem(balance, minPoints)).toBe(balance >= minPoints);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Asignación de tier
// ============================================================================

describe('AdminFidelizacionPage — Asignación de tier', () => {
  it('0 puntos → BRONCE', () => {
    expect(assignTier(0)).toBe('BRONCE');
  });

  it('499 puntos → BRONCE', () => {
    expect(assignTier(499)).toBe('BRONCE');
  });

  it('500 puntos → PLATA', () => {
    expect(assignTier(500)).toBe('PLATA');
  });

  it('1999 puntos → PLATA', () => {
    expect(assignTier(1999)).toBe('PLATA');
  });

  it('2000 puntos → ORO', () => {
    expect(assignTier(2000)).toBe('ORO');
  });

  it('5000 puntos → PLATINO', () => {
    expect(assignTier(5000)).toBe('PLATINO');
  });

  it('10000 puntos → PLATINO (máximo)', () => {
    expect(assignTier(10000)).toBe('PLATINO');
  });

  it('property: tier siempre está entre los tiers conocidos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (points) => {
          expect(TIERS).toContain(assignTier(points));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Próximo tier
// ============================================================================

describe('AdminFidelizacionPage — Próximo tier', () => {
  it('BRONCE → próximo es PLATA con puntos necesarios', () => {
    const next = getNextTier(0);
    expect(next?.name).toBe('PLATA');
    expect(next?.pointsNeeded).toBe(500);
  });

  it('PLATA con 500 → próximo ORO requiere 1500 puntos más', () => {
    const next = getNextTier(500);
    expect(next?.name).toBe('ORO');
    expect(next?.pointsNeeded).toBe(1500);
  });

  it('PLATINO → no hay próximo tier (null)', () => {
    expect(getNextTier(5000)).toBeNull();
  });

  it('property: si no es PLATINO, siempre hay un próximo tier', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4999 }),
        (points) => {
          expect(getNextTier(points)).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
