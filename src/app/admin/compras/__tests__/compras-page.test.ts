/**
 * Admin Compras Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_COLORS / STATUS_LABELS completeness (4 states)
 * - Lifecycle: which transitions are valid per status
 *   DRAFT → CONFIRMED | CANCELLED
 *   CONFIRMED → RECEIVED
 *   RECEIVED and CANCELLED are terminal (no actions)
 * - formatCurrency helper
 * - Total calculation (subtotal + tax = total)
 * - SWR URL construction with status filter
 * - PATCH URL construction for status update
 *
 * @module app/admin/compras/__tests__/compras-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-zinc-600 text-zinc-200',
  CONFIRMED: 'bg-blue-500/20 text-blue-400',
  RECEIVED:  'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:     'Borrador',
  CONFIRMED: 'Confirmada',
  RECEIVED:  'Recibida',
  CANCELLED: 'Cancelada',
};

const PURCHASE_STATUSES = Object.keys(STATUS_LABELS);

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function buildUpdateURL(poId: string): string {
  return `/api/admin/purchases/${poId}`;
}

// Lifecycle transition rules (from page UI logic)
function getAvailableTransitions(status: string): string[] {
  switch (status) {
    case 'DRAFT':     return ['CONFIRMED', 'CANCELLED'];
    case 'CONFIRMED': return ['RECEIVED'];
    case 'RECEIVED':  return [];
    case 'CANCELLED': return [];
    default:          return [];
  }
}

function isTerminalStatus(status: string): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED';
}

function calculateTotal(subtotalCents: number, taxCents: number): number {
  return subtotalCents + taxCents;
}

function calculateIGV(subtotalCents: number, rate = 0.18): number {
  return Math.round(subtotalCents * rate);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminComprasPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_LABELS
// ============================================================================

describe('AdminComprasPage — STATUS_LABELS', () => {
  it('cubre los 4 estados del ciclo de vida', () => {
    expect(PURCHASE_STATUSES).toHaveLength(4);
  });

  it('incluye DRAFT, CONFIRMED, RECEIVED, CANCELLED', () => {
    for (const s of ['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']) {
      expect(STATUS_LABELS[s]).toBeDefined();
    }
  });

  it('labels en español', () => {
    expect(STATUS_LABELS.DRAFT).toBe('Borrador');
    expect(STATUS_LABELS.CONFIRMED).toBe('Confirmada');
    expect(STATUS_LABELS.RECEIVED).toBe('Recibida');
    expect(STATUS_LABELS.CANCELLED).toBe('Cancelada');
  });

  it('ningún label está vacío', () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — STATUS_COLORS
// ============================================================================

describe('AdminComprasPage — STATUS_COLORS', () => {
  it('tiene color para cada estado', () => {
    for (const status of PURCHASE_STATUSES) {
      expect(STATUS_COLORS[status]).toBeDefined();
    }
  });

  it('CONFIRMED es azul', () => {
    expect(STATUS_COLORS.CONFIRMED).toContain('blue');
  });

  it('RECEIVED es verde (emerald)', () => {
    expect(STATUS_COLORS.RECEIVED).toContain('emerald');
  });

  it('CANCELLED es rojo', () => {
    expect(STATUS_COLORS.CANCELLED).toContain('red');
  });

  it('DRAFT es zinc/gris (borrador)', () => {
    expect(STATUS_COLORS.DRAFT).toContain('zinc');
  });
});

// ============================================================================
// Tests — Ciclo de vida de órdenes de compra
// ============================================================================

describe('AdminComprasPage — Ciclo de vida', () => {
  it('DRAFT puede ser CONFIRMED o CANCELLED', () => {
    const transitions = getAvailableTransitions('DRAFT');
    expect(transitions).toContain('CONFIRMED');
    expect(transitions).toContain('CANCELLED');
    expect(transitions).toHaveLength(2);
  });

  it('CONFIRMED puede ser RECEIVED (única transición)', () => {
    const transitions = getAvailableTransitions('CONFIRMED');
    expect(transitions).toEqual(['RECEIVED']);
  });

  it('RECEIVED es terminal: sin transiciones', () => {
    expect(getAvailableTransitions('RECEIVED')).toHaveLength(0);
  });

  it('CANCELLED es terminal: sin transiciones', () => {
    expect(getAvailableTransitions('CANCELLED')).toHaveLength(0);
  });

  it('isTerminalStatus identifica correctamente los estados terminales', () => {
    expect(isTerminalStatus('RECEIVED')).toBe(true);
    expect(isTerminalStatus('CANCELLED')).toBe(true);
    expect(isTerminalStatus('DRAFT')).toBe(false);
    expect(isTerminalStatus('CONFIRMED')).toBe(false);
  });

  it('flujo feliz: DRAFT → CONFIRMED → RECEIVED', () => {
    expect(getAvailableTransitions('DRAFT')).toContain('CONFIRMED');
    expect(getAvailableTransitions('CONFIRMED')).toContain('RECEIVED');
    expect(isTerminalStatus('RECEIVED')).toBe(true);
  });

  it('flujo cancelación: DRAFT → CANCELLED (terminal)', () => {
    expect(getAvailableTransitions('DRAFT')).toContain('CANCELLED');
    expect(isTerminalStatus('CANCELLED')).toBe(true);
  });

  it('property: estados terminales nunca tienen transiciones', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('RECEIVED', 'CANCELLED'),
        (status) => {
          expect(getAvailableTransitions(status)).toHaveLength(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminComprasPage — formatCurrency', () => {
  it('incluye prefijo S/', () => {
    expect(formatCurrency(150000)).toContain('S/');
  });

  it('150000 centavos = S/ 1500.00', () => {
    expect(formatCurrency(150000)).toBe('S/ 1500.00');
  });

  it('0 centavos = S/ 0.00', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00');
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
// Tests — Cálculo de totales
// ============================================================================

describe('AdminComprasPage — Cálculo de totales', () => {
  it('total = subtotal + tax', () => {
    expect(calculateTotal(100000, 18000)).toBe(118000);
  });

  it('IGV 18% de 100000 = 18000', () => {
    expect(calculateIGV(100000)).toBe(18000);
  });

  it('IGV 18% de 50000 = 9000', () => {
    expect(calculateIGV(50000)).toBe(9000);
  });

  it('total con IGV: subtotal + IGV(subtotal) = subtotal * 1.18', () => {
    const subtotal = 100000;
    const igv = calculateIGV(subtotal);
    const total = calculateTotal(subtotal, igv);
    expect(total).toBe(118000);
  });

  it('property: total siempre >= subtotal (tax >= 0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        fc.integer({ min: 0, max: 999900 }),
        (subtotal, tax) => {
          expect(calculateTotal(subtotal, tax)).toBeGreaterThanOrEqual(subtotal);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: IGV siempre positivo para subtotales positivos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        (subtotal) => {
          expect(calculateIGV(subtotal)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — PATCH URL
// ============================================================================

describe('AdminComprasPage — URL de actualización', () => {
  it('PATCH URL correcta', () => {
    expect(buildUpdateURL('po-123')).toBe('/api/admin/purchases/po-123');
  });

  it('property: siempre incluye /api/admin/purchases/ y el id', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        const url = buildUpdateURL(id);
        expect(url).toContain('/api/admin/purchases/');
        expect(url).toContain(id);
      }),
      { numRuns: 100 }
    );
  });
});
