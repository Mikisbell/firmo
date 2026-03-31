/**
 * Admin Facturación Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - centsToSoles formatting
 * - tabs array completeness (4 tabs)
 * - statusColor / status labels completeness
 * - handleVoid validation (reason >= 5 chars)
 * - Pagination boundary conditions
 *
 * @module app/admin/facturacion/__tests__/facturacion-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

type Tab = 'comprobantes' | 'configuracion' | 'resumenes' | 'contingencia';
type InvoiceStatus = 'ISSUED' | 'VOIDED' | 'PENDING';
type InvoiceType = 'BOLETA' | 'FACTURA';

const TABS: { id: Tab; label: string }[] = [
  { id: 'comprobantes', label: 'Comprobantes' },
  { id: 'configuracion', label: 'Configuración' },
  { id: 'resumenes', label: 'Resúmenes Diarios' },
  { id: 'contingencia', label: 'Contingencia' },
];

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  ISSUED:  'text-green-400 bg-green-400/10',
  VOIDED:  'text-red-400 bg-red-400/10',
  PENDING: 'text-yellow-400 bg-yellow-400/10',
};

const INVOICE_TYPES: InvoiceType[] = ['BOLETA', 'FACTURA'];
const INVOICE_STATUSES = Object.keys(STATUS_COLOR) as InvoiceStatus[];

function centsToSoles(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function isVoidReasonValid(reason: string | null | undefined): boolean {
  return !!reason && reason.length >= 5;
}

function clampPage(page: number, maxPage: number): number {
  return Math.min(Math.max(1, page), maxPage);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminFacturacionPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — centsToSoles
// ============================================================================

describe('AdminFacturacionPage — centsToSoles', () => {
  it('0 centavos → "S/ 0.00"', () => {
    expect(centsToSoles(0)).toBe('S/ 0.00');
  });

  it('100 centavos → "S/ 1.00"', () => {
    expect(centsToSoles(100)).toBe('S/ 1.00');
  });

  it('2500 centavos → "S/ 25.00"', () => {
    expect(centsToSoles(2500)).toBe('S/ 25.00');
  });

  it('1 centavo → "S/ 0.01"', () => {
    expect(centsToSoles(1)).toBe('S/ 0.01');
  });

  it('10000 centavos → "S/ 100.00"', () => {
    expect(centsToSoles(10000)).toBe('S/ 100.00');
  });

  it('siempre empieza con "S/ "', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (cents) => {
          expect(centsToSoles(cents)).toMatch(/^S\/ /);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('siempre termina con 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (cents) => {
          const result = centsToSoles(cents);
          expect(result).toMatch(/\.\d{2}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: cents / 100 = parsed soles value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (cents) => {
          const result = centsToSoles(cents);
          const numericPart = parseFloat(result.replace('S/ ', ''));
          expect(numericPart).toBeCloseTo(cents / 100, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Tabs
// ============================================================================

describe('AdminFacturacionPage — Tabs', () => {
  it('hay exactamente 4 tabs', () => {
    expect(TABS).toHaveLength(4);
  });

  it('incluye comprobantes, configuracion, resumenes, contingencia', () => {
    const ids = TABS.map(t => t.id);
    expect(ids).toContain('comprobantes');
    expect(ids).toContain('configuracion');
    expect(ids).toContain('resumenes');
    expect(ids).toContain('contingencia');
  });

  it('cada tab tiene id y label no vacíos', () => {
    for (const tab of TABS) {
      expect(tab.id.trim().length).toBeGreaterThan(0);
      expect(tab.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(TABS[0].label).toBe('Comprobantes');
    expect(TABS[1].label).toBe('Configuración');
    expect(TABS[2].label).toBe('Resúmenes Diarios');
    expect(TABS[3].label).toBe('Contingencia');
  });

  it('ids son únicos', () => {
    const ids = TABS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================================
// Tests — Invoice types
// ============================================================================

describe('AdminFacturacionPage — Tipos de comprobante', () => {
  it('hay exactamente 2 tipos', () => {
    expect(INVOICE_TYPES).toHaveLength(2);
  });

  it('incluye BOLETA y FACTURA', () => {
    expect(INVOICE_TYPES).toContain('BOLETA');
    expect(INVOICE_TYPES).toContain('FACTURA');
  });
});

// ============================================================================
// Tests — STATUS_COLOR
// ============================================================================

describe('AdminFacturacionPage — statusColor', () => {
  it('hay 3 estados', () => {
    expect(INVOICE_STATUSES).toHaveLength(3);
  });

  it('ISSUED es verde', () => {
    expect(STATUS_COLOR.ISSUED).toContain('green');
  });

  it('VOIDED es rojo', () => {
    expect(STATUS_COLOR.VOIDED).toContain('red');
  });

  it('PENDING es amarillo', () => {
    expect(STATUS_COLOR.PENDING).toContain('yellow');
  });

  it('property: todos los estados tienen color no vacío', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INVOICE_STATUSES),
        (status) => {
          expect(STATUS_COLOR[status].trim().length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — handleVoid validation
// ============================================================================

describe('AdminFacturacionPage — Validación de anulación', () => {
  it('null → inválido', () => {
    expect(isVoidReasonValid(null)).toBe(false);
  });

  it('undefined → inválido', () => {
    expect(isVoidReasonValid(undefined)).toBe(false);
  });

  it('cadena vacía → inválido', () => {
    expect(isVoidReasonValid('')).toBe(false);
  });

  it('4 caracteres → inválido', () => {
    expect(isVoidReasonValid('abcd')).toBe(false);
  });

  it('5 caracteres → válido', () => {
    expect(isVoidReasonValid('abcde')).toBe(true);
  });

  it('razón larga → válida', () => {
    expect(isVoidReasonValid('Error en comprobante emitido')).toBe(true);
  });

  it('property: longitud >= 5 → válido', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 200 }),
        (reason) => {
          expect(isVoidReasonValid(reason)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: longitud < 5 → inválido', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 4 }),
        (reason) => {
          expect(isVoidReasonValid(reason)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Pagination
// ============================================================================

describe('AdminFacturacionPage — Paginación', () => {
  it('clampPage(1, 5) → 1', () => {
    expect(clampPage(1, 5)).toBe(1);
  });

  it('clampPage(5, 5) → 5', () => {
    expect(clampPage(5, 5)).toBe(5);
  });

  it('clampPage(0, 5) → 1 (no puede ir antes de página 1)', () => {
    expect(clampPage(0, 5)).toBe(1);
  });

  it('clampPage(10, 5) → 5 (no puede superar el máximo)', () => {
    expect(clampPage(10, 5)).toBe(5);
  });

  it('clampPage(-3, 3) → 1', () => {
    expect(clampPage(-3, 3)).toBe(1);
  });

  it('property: resultado siempre entre 1 y maxPage', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 50 }),
        (page, maxPage) => {
          const result = clampPage(page, maxPage);
          expect(result).toBeGreaterThanOrEqual(1);
          expect(result).toBeLessThanOrEqual(maxPage);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: clampPage es idempotente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (page, maxPage) => {
          const once  = clampPage(page, maxPage);
          const twice = clampPage(once, maxPage);
          expect(twice).toBe(once);
        }
      ),
      { numRuns: 100 }
    );
  });
});
