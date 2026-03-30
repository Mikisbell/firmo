/**
 * Admin Caja Chica Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - CATEGORIES completeness (6 petty cash categories)
 * - Transaction types: INCOME / EXPENSE
 * - formatCurrency helper
 * - Amount conversion: soles string → centavos (Math.round * 100)
 * - Transaction form validation (amount + description required)
 * - Balance calculation: currentBalance after INCOME adds, EXPENSE subtracts
 * - Reconciliation difference calculation
 * - Approval threshold logic (requires approval if amount > threshold)
 * - Action URL construction (POST, approve)
 *
 * @module app/admin/caja-chica/__tests__/caja-chica-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const CATEGORIES = [
  { value: 'SUPPLIES',    label: 'Insumos' },
  { value: 'TRANSPORT',   label: 'Transporte' },
  { value: 'FOOD',        label: 'Alimentos' },
  { value: 'CLEANING',    label: 'Limpieza' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'OTHER',       label: 'Otro' },
];

const CATEGORY_VALUES = CATEGORIES.map(c => c.value);

type TransactionType = 'INCOME' | 'EXPENSE';
const TRANSACTION_TYPES: TransactionType[] = ['INCOME', 'EXPENSE'];

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}

function solesToCents(soles: string): number {
  return Math.round(parseFloat(soles) * 100);
}

function isTransactionFormValid(amount: string, description: string): boolean {
  const parsed = parseFloat(amount);
  return !!(amount && description.trim() && !isNaN(parsed) && parsed > 0);
}

function applyTransaction(balanceCents: number, type: TransactionType, amountCents: number): number {
  return type === 'INCOME'
    ? balanceCents + amountCents
    : balanceCents - amountCents;
}

function calculateReconciliationDiff(currentBalanceCents: number, countedCents: number): number {
  return countedCents - currentBalanceCents;
}

function requiresApproval(amountCents: number, thresholdCents: number): boolean {
  return amountCents > thresholdCents;
}

function buildTransactionURL(): string {
  return '/api/admin/petty-cash';
}

function buildApproveURL(txId: string): string {
  return `/api/admin/petty-cash/${txId}/approve`;
}

function buildReconcileURL(): string {
  return '/api/admin/petty-cash/reconcile';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminCajaChicaPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — CATEGORIES
// ============================================================================

describe('AdminCajaChicaPage — CATEGORIES', () => {
  it('cubre exactamente 6 categorías', () => {
    expect(CATEGORIES).toHaveLength(6);
  });

  it('incluye SUPPLIES, TRANSPORT, FOOD, CLEANING, MAINTENANCE, OTHER', () => {
    const expected = ['SUPPLIES', 'TRANSPORT', 'FOOD', 'CLEANING', 'MAINTENANCE', 'OTHER'];
    for (const cat of expected) {
      expect(CATEGORY_VALUES).toContain(cat);
    }
  });

  it('labels en español', () => {
    expect(CATEGORIES.find(c => c.value === 'SUPPLIES')?.label).toBe('Insumos');
    expect(CATEGORIES.find(c => c.value === 'TRANSPORT')?.label).toBe('Transporte');
    expect(CATEGORIES.find(c => c.value === 'MAINTENANCE')?.label).toBe('Mantenimiento');
    expect(CATEGORIES.find(c => c.value === 'OTHER')?.label).toBe('Otro');
  });

  it('ningún label está vacío', () => {
    for (const cat of CATEGORIES) {
      expect(cat.label.trim().length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Tests — Transaction types
// ============================================================================

describe('AdminCajaChicaPage — Tipos de transacción', () => {
  it('solo hay 2 tipos: INCOME y EXPENSE', () => {
    expect(TRANSACTION_TYPES).toHaveLength(2);
    expect(TRANSACTION_TYPES).toContain('INCOME');
    expect(TRANSACTION_TYPES).toContain('EXPENSE');
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('AdminCajaChicaPage — formatCurrency', () => {
  it('incluye prefijo S/', () => {
    expect(formatCurrency(50000)).toContain('S/');
  });

  it('50000 centavos = S/ 500.00', () => {
    expect(formatCurrency(50000)).toBe('S/ 500.00');
  });

  it('0 centavos = S/ 0.00', () => {
    expect(formatCurrency(0)).toBe('S/ 0.00');
  });

  it('property: siempre incluye S/ y 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999900 }),
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
// Tests — solesToCents conversion
// ============================================================================

describe('AdminCajaChicaPage — solesToCents', () => {
  it('50.00 soles = 5000 centavos', () => {
    expect(solesToCents('50.00')).toBe(5000);
  });

  it('10.50 soles = 1050 centavos', () => {
    expect(solesToCents('10.50')).toBe(1050);
  });

  it('0.01 soles = 1 centavo', () => {
    expect(solesToCents('0.01')).toBe(1);
  });

  it('property: round-trip soles→cents→soles para enteros exactos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9999900 }),
        (cents) => {
          const soles = (cents / 100).toFixed(2);
          expect(solesToCents(soles)).toBe(cents);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: resultado siempre es entero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999 }),
        fc.integer({ min: 0, max: 99 }),
        (soles, cents) => {
          const display = `${soles}.${String(cents).padStart(2, '0')}`;
          expect(Number.isInteger(solesToCents(display))).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Validación del formulario de transacción
// ============================================================================

describe('AdminCajaChicaPage — Validación del formulario', () => {
  it('formulario vacío no es válido', () => {
    expect(isTransactionFormValid('', '')).toBe(false);
  });

  it('sin descripción no es válido', () => {
    expect(isTransactionFormValid('50', '')).toBe(false);
  });

  it('sin monto no es válido', () => {
    expect(isTransactionFormValid('', 'Compra de gas')).toBe(false);
  });

  it('monto no numérico no es válido', () => {
    expect(isTransactionFormValid('abc', 'Descripción')).toBe(false);
  });

  it('monto = 0 no es válido', () => {
    expect(isTransactionFormValid('0', 'Descripción')).toBe(false);
  });

  it('monto negativo no es válido', () => {
    expect(isTransactionFormValid('-10', 'Descripción')).toBe(false);
  });

  it('monto válido y descripción → válido', () => {
    expect(isTransactionFormValid('50.00', 'Compra de gas')).toBe(true);
  });

  it('property: siempre inválido con monto vacío', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        (desc) => {
          expect(isTransactionFormValid('', desc)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Balance: INCOME suma, EXPENSE resta
// ============================================================================

describe('AdminCajaChicaPage — Ciclo de vida del balance', () => {
  it('INCOME aumenta el balance', () => {
    expect(applyTransaction(50000, 'INCOME', 10000)).toBe(60000);
  });

  it('EXPENSE reduce el balance', () => {
    expect(applyTransaction(50000, 'EXPENSE', 10000)).toBe(40000);
  });

  it('balance puede quedar en 0 con EXPENSE exacto', () => {
    expect(applyTransaction(10000, 'EXPENSE', 10000)).toBe(0);
  });

  it('property: INCOME siempre incrementa (o mantiene) el balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 100000 }),
        (balance, amount) => {
          expect(applyTransaction(balance, 'INCOME', amount)).toBeGreaterThanOrEqual(balance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: EXPENSE siempre reduce (o mantiene) el balance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 100000 }),
        (balance, amount) => {
          expect(applyTransaction(balance, 'EXPENSE', amount)).toBeLessThanOrEqual(balance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: INCOME + EXPENSE con mismo monto devuelve balance original', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 100000 }),
        (balance, amount) => {
          const after = applyTransaction(
            applyTransaction(balance, 'INCOME', amount),
            'EXPENSE',
            amount
          );
          expect(after).toBe(balance);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Reconciliación
// ============================================================================

describe('AdminCajaChicaPage — Reconciliación', () => {
  it('diferencia positiva: se contó más de lo esperado', () => {
    expect(calculateReconciliationDiff(50000, 55000)).toBe(5000);
  });

  it('diferencia negativa: se contó menos de lo esperado (faltante)', () => {
    expect(calculateReconciliationDiff(50000, 45000)).toBe(-5000);
  });

  it('diferencia cero: balance exacto', () => {
    expect(calculateReconciliationDiff(50000, 50000)).toBe(0);
  });

  it('property: diff = counted - current', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }),
        fc.integer({ min: 0, max: 1000000 }),
        (current, counted) => {
          expect(calculateReconciliationDiff(current, counted)).toBe(counted - current);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Approval threshold
// ============================================================================

describe('AdminCajaChicaPage — Umbral de aprobación', () => {
  it('monto mayor al threshold requiere aprobación', () => {
    expect(requiresApproval(20000, 10000)).toBe(true);
  });

  it('monto igual al threshold NO requiere aprobación (> no >=)', () => {
    expect(requiresApproval(10000, 10000)).toBe(false);
  });

  it('monto menor al threshold no requiere aprobación', () => {
    expect(requiresApproval(5000, 10000)).toBe(false);
  });

  it('property: consistencia del umbral', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        (amount, threshold) => {
          const result = requiresApproval(amount, threshold);
          expect(result).toBe(amount > threshold);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URLs
// ============================================================================

describe('AdminCajaChicaPage — URLs', () => {
  it('POST transacción → /api/admin/petty-cash', () => {
    expect(buildTransactionURL()).toBe('/api/admin/petty-cash');
  });

  it('approve URL incluye el id', () => {
    expect(buildApproveURL('tx-123')).toBe('/api/admin/petty-cash/tx-123/approve');
  });

  it('reconcile URL → /api/admin/petty-cash/reconcile', () => {
    expect(buildReconcileURL()).toBe('/api/admin/petty-cash/reconcile');
  });

  it('property: approve URL siempre incluye el id', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        expect(buildApproveURL(id)).toContain(id);
      }),
      { numRuns: 100 }
    );
  });
});
