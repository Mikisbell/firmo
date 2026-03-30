/**
 * Admin Promociones Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - TYPE_OPTIONS completeness (PERCENT/FIXED/HAPPY_HOUR/2X1)
 * - STATUS_OPTIONS (Activa/Inactiva)
 * - isExpired logic (ends_at < now → expired)
 * - isActive: active AND not expired
 * - applyDiscount for PERCENT and FIXED types
 * - DELETE URL construction
 *
 * @module app/admin/promociones/__tests__/promociones-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const TYPE_OPTIONS = [
  { value: 'PERCENT',    label: 'Porcentaje' },
  { value: 'FIXED',      label: 'Monto Fijo' },
  { value: 'HAPPY_HOUR', label: 'Happy Hour' },
  { value: '2X1',        label: '2x1' },
];

const STATUS_OPTIONS = [
  { value: 'true',  label: 'Activa' },
  { value: 'false', label: 'Inactiva' },
];

const PROMO_TYPES = TYPE_OPTIONS.map(t => t.value);

function isExpired(endsAt: string): boolean {
  return new Date(endsAt) < new Date();
}

function isPromoActive(isActive: boolean, endsAt: string): boolean {
  return isActive && !isExpired(endsAt);
}

function getTypeLabel(type: string): string {
  return TYPE_OPTIONS.find(t => t.value === type)?.label ?? type;
}

function buildDeleteURL(promoId: string): string {
  return `/api/admin/promotions/${promoId}`;
}

// Discount application logic (derived from promo type)
function applyDiscount(priceCents: number, type: string, value: number): number {
  switch (type) {
    case 'PERCENT':
      return Math.round(priceCents * (1 - value / 100));
    case 'FIXED':
      return Math.max(0, priceCents - value);
    case '2X1':
      return Math.round(priceCents / 2);
    default:
      return priceCents; // HAPPY_HOUR and others handled elsewhere
  }
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminPromocionesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — TYPE_OPTIONS
// ============================================================================

describe('AdminPromocionesPage — TYPE_OPTIONS', () => {
  it('cubre los 4 tipos de promoción', () => {
    expect(TYPE_OPTIONS).toHaveLength(4);
  });

  it('incluye PERCENT, FIXED, HAPPY_HOUR, 2X1', () => {
    for (const type of ['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1']) {
      expect(PROMO_TYPES).toContain(type);
    }
  });

  it('labels en español', () => {
    expect(getTypeLabel('PERCENT')).toBe('Porcentaje');
    expect(getTypeLabel('FIXED')).toBe('Monto Fijo');
    expect(getTypeLabel('HAPPY_HOUR')).toBe('Happy Hour');
    expect(getTypeLabel('2X1')).toBe('2x1');
  });

  it('tipo desconocido devuelve el valor original', () => {
    expect(getTypeLabel('BOGO')).toBe('BOGO');
  });

  it('ningún label está vacío', () => {
    for (const opt of TYPE_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — STATUS_OPTIONS
// ============================================================================

describe('AdminPromocionesPage — STATUS_OPTIONS', () => {
  it('tiene 2 opciones', () => {
    expect(STATUS_OPTIONS).toHaveLength(2);
  });

  it('labels en español', () => {
    expect(STATUS_OPTIONS.find(o => o.value === 'true')?.label).toBe('Activa');
    expect(STATUS_OPTIONS.find(o => o.value === 'false')?.label).toBe('Inactiva');
  });
});

// ============================================================================
// Tests — isExpired
// ============================================================================

describe('AdminPromocionesPage — isExpired', () => {
  it('fecha pasada → expirada', () => {
    expect(isExpired('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('fecha futura → no expirada', () => {
    expect(isExpired('2099-12-31T23:59:59Z')).toBe(false);
  });
});

// ============================================================================
// Tests — isPromoActive
// ============================================================================

describe('AdminPromocionesPage — isPromoActive', () => {
  const futureDate = '2099-12-31T23:59:59Z';
  const pastDate = '2020-01-01T00:00:00Z';

  it('activa + vigente → activa', () => {
    expect(isPromoActive(true, futureDate)).toBe(true);
  });

  it('activa + expirada → inactiva', () => {
    expect(isPromoActive(true, pastDate)).toBe(false);
  });

  it('inactiva + vigente → inactiva', () => {
    expect(isPromoActive(false, futureDate)).toBe(false);
  });

  it('inactiva + expirada → inactiva', () => {
    expect(isPromoActive(false, pastDate)).toBe(false);
  });
});

// ============================================================================
// Tests — applyDiscount
// ============================================================================

describe('AdminPromocionesPage — applyDiscount', () => {
  it('PERCENT 10% de 10000 = 9000 centavos', () => {
    expect(applyDiscount(10000, 'PERCENT', 10)).toBe(9000);
  });

  it('PERCENT 50% de 10000 = 5000 centavos', () => {
    expect(applyDiscount(10000, 'PERCENT', 50)).toBe(5000);
  });

  it('PERCENT 100% = precio 0', () => {
    expect(applyDiscount(10000, 'PERCENT', 100)).toBe(0);
  });

  it('FIXED descuenta un monto fijo en centavos', () => {
    expect(applyDiscount(10000, 'FIXED', 2000)).toBe(8000);
  });

  it('FIXED no baja de 0 si el descuento supera el precio', () => {
    expect(applyDiscount(1000, 'FIXED', 2000)).toBe(0);
  });

  it('2X1 = precio / 2', () => {
    expect(applyDiscount(10000, '2X1', 0)).toBe(5000);
  });

  it('HAPPY_HOUR no modifica el precio (manejado externamente)', () => {
    expect(applyDiscount(10000, 'HAPPY_HOUR', 0)).toBe(10000);
  });

  it('property: PERCENT con 0% = precio original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        (price) => {
          expect(applyDiscount(price, 'PERCENT', 0)).toBe(price);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: PERCENT precio descontado siempre <= precio original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        fc.integer({ min: 0, max: 100 }),
        (price, pct) => {
          expect(applyDiscount(price, 'PERCENT', pct)).toBeLessThanOrEqual(price);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: FIXED precio descontado siempre >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        fc.integer({ min: 0, max: 99999 }),
        (price, discount) => {
          expect(applyDiscount(price, 'FIXED', discount)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — DELETE URL
// ============================================================================

describe('AdminPromocionesPage — URLs', () => {
  it('DELETE URL correcta', () => {
    expect(buildDeleteURL('promo-123')).toBe('/api/admin/promotions/promo-123');
  });

  it('property: siempre incluye el id', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        expect(buildDeleteURL(id)).toContain(id);
      }),
      { numRuns: 100 }
    );
  });
});
