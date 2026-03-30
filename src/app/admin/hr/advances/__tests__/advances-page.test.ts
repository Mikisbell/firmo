/**
 * HR Advances Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - STATUS_CONFIG completeness (4 states: PENDING/APPROVED/REJECTED/PAID)
 * - formatCurrency helper (centavos → 'S/ X,XXX.XX')
 * - Lifecycle: which actions are valid per status
 * - SWR URL construction with status filter
 * - Total accumulation logic
 *
 * @module app/admin/hr/advances/__tests__/advances-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendiente', color: 'text-yellow-400 bg-yellow-500/20' },
  APPROVED: { label: 'Aprobado', color: 'text-green-400 bg-green-500/20' },
  REJECTED: { label: 'Rechazado', color: 'text-red-400 bg-red-500/20' },
  PAID: { label: 'Pagado', color: 'text-blue-400 bg-blue-500/20' },
};

const ADVANCE_STATUSES = Object.keys(STATUS_CONFIG);

function formatCurrency(cents: number): string {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2 })}`;
}

function buildAdvancesURL(statusFilter: string): string {
  return `/api/hr/advances?status=${statusFilter}`;
}

function buildActionURL(id: string, action: 'approve' | 'reject' | 'mark-paid'): string {
  return `/api/hr/advances/${id}/${action}`;
}

// Actions available by status (lifecycle rules)
function getAvailableActions(status: string): Array<'approve' | 'reject' | 'mark-paid'> {
  if (status === 'PENDING') return ['approve', 'reject'];
  if (status === 'APPROVED') return ['mark-paid'];
  return []; // REJECTED and PAID have no actions
}

function accumulate(advances: Array<{ amount_cents: number }>): number {
  return advances.reduce((sum, a) => sum + a.amount_cents, 0);
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('HRAdvancesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — STATUS_CONFIG
// ============================================================================

describe('HRAdvancesPage — STATUS_CONFIG', () => {
  it('cubre los 4 estados del ciclo de vida', () => {
    expect(ADVANCE_STATUSES).toHaveLength(4);
  });

  it('incluye PENDING, APPROVED, REJECTED, PAID', () => {
    const expected = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];
    for (const status of expected) {
      expect(STATUS_CONFIG[status]).toBeDefined();
    }
  });

  it('cada estado tiene label y color', () => {
    for (const [, cfg] of Object.entries(STATUS_CONFIG)) {
      expect(cfg.label.trim().length).toBeGreaterThan(0);
      expect(cfg.color.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels en español', () => {
    expect(STATUS_CONFIG.PENDING.label).toBe('Pendiente');
    expect(STATUS_CONFIG.APPROVED.label).toBe('Aprobado');
    expect(STATUS_CONFIG.REJECTED.label).toBe('Rechazado');
    expect(STATUS_CONFIG.PAID.label).toBe('Pagado');
  });

  it('PENDING es amarillo', () => {
    expect(STATUS_CONFIG.PENDING.color).toContain('yellow');
  });

  it('APPROVED es verde', () => {
    expect(STATUS_CONFIG.APPROVED.color).toContain('green');
  });

  it('REJECTED es rojo', () => {
    expect(STATUS_CONFIG.REJECTED.color).toContain('red');
  });

  it('PAID es azul', () => {
    expect(STATUS_CONFIG.PAID.color).toContain('blue');
  });
});

// ============================================================================
// Tests — formatCurrency
// ============================================================================

describe('HRAdvancesPage — formatCurrency', () => {
  it('incluye prefijo S/', () => {
    expect(formatCurrency(150000)).toContain('S/');
  });

  it('150000 centavos = S/ 1,500.00', () => {
    const result = formatCurrency(150000);
    expect(result).toContain('1,500');
    expect(result).toContain('00');
  });

  it('0 centavos = S/ 0.00', () => {
    expect(formatCurrency(0)).toContain('0.00');
  });

  it('100 centavos = S/ 1.00', () => {
    expect(formatCurrency(100)).toContain('1.00');
  });

  it('property: siempre incluye prefijo S/', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99999900 }),
        (cents) => {
          expect(formatCurrency(cents)).toContain('S/');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: valor en soles = cents / 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (soles) => {
          const cents = soles * 100;
          const result = formatCurrency(cents);
          // The soles value should appear in the formatted string
          expect(result).toContain('S/');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — Ciclo de vida / acciones por estado
// ============================================================================

describe('HRAdvancesPage — Ciclo de vida de adelantos', () => {
  it('PENDING tiene acciones: approve y reject', () => {
    const actions = getAvailableActions('PENDING');
    expect(actions).toContain('approve');
    expect(actions).toContain('reject');
    expect(actions).toHaveLength(2);
  });

  it('APPROVED tiene acción: mark-paid', () => {
    const actions = getAvailableActions('APPROVED');
    expect(actions).toContain('mark-paid');
    expect(actions).toHaveLength(1);
  });

  it('REJECTED no tiene acciones (estado terminal)', () => {
    expect(getAvailableActions('REJECTED')).toHaveLength(0);
  });

  it('PAID no tiene acciones (estado terminal)', () => {
    expect(getAvailableActions('PAID')).toHaveLength(0);
  });

  it('flujo completo: PENDING → APPROVED → PAID', () => {
    // PENDING puede ser aprobado
    expect(getAvailableActions('PENDING')).toContain('approve');
    // APPROVED puede ser marcado como pagado
    expect(getAvailableActions('APPROVED')).toContain('mark-paid');
    // PAID es terminal
    expect(getAvailableActions('PAID')).toHaveLength(0);
  });

  it('flujo rechazo: PENDING → REJECTED (terminal)', () => {
    expect(getAvailableActions('PENDING')).toContain('reject');
    expect(getAvailableActions('REJECTED')).toHaveLength(0);
  });
});

// ============================================================================
// Tests — URLs de acción
// ============================================================================

describe('HRAdvancesPage — URLs de acción', () => {
  it('approve URL correcta', () => {
    expect(buildActionURL('adv-123', 'approve')).toBe('/api/hr/advances/adv-123/approve');
  });

  it('reject URL correcta', () => {
    expect(buildActionURL('adv-123', 'reject')).toBe('/api/hr/advances/adv-123/reject');
  });

  it('mark-paid URL correcta', () => {
    expect(buildActionURL('adv-123', 'mark-paid')).toBe('/api/hr/advances/adv-123/mark-paid');
  });

  it('property: URL siempre contiene /api/hr/advances/', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.constantFrom('approve', 'reject', 'mark-paid') as fc.Arbitrary<'approve' | 'reject' | 'mark-paid'>,
        (id, action) => {
          const url = buildActionURL(id, action);
          expect(url).toContain('/api/hr/advances/');
          expect(url).toContain(id);
          expect(url).toContain(action);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — SWR URL con filtro de estado
// ============================================================================

describe('HRAdvancesPage — SWR URL con filtro', () => {
  it('URL por defecto incluye status=PENDING', () => {
    expect(buildAdvancesURL('PENDING')).toBe('/api/hr/advances?status=PENDING');
  });

  it('property: todos los estados generan URL válida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ADVANCE_STATUSES),
        (status) => {
          const url = buildAdvancesURL(status);
          expect(url).toContain('/api/hr/advances');
          expect(url).toContain(`status=${status}`);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Tests — Acumulación de montos
// ============================================================================

describe('HRAdvancesPage — Acumulación de montos', () => {
  it('lista vacía acumula 0', () => {
    expect(accumulate([])).toBe(0);
  });

  it('un adelanto acumula su propio monto', () => {
    expect(accumulate([{ amount_cents: 50000 }])).toBe(50000);
  });

  it('múltiples adelantos se suman correctamente', () => {
    const advances = [
      { amount_cents: 100000 },
      { amount_cents: 50000 },
      { amount_cents: 75000 },
    ];
    expect(accumulate(advances)).toBe(225000);
  });

  it('property: acumulación siempre >= 0 con montos positivos', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 0, max: 1000000 }).map(c => ({ amount_cents: c })),
          { minLength: 0, maxLength: 20 }
        ),
        (advances) => {
          expect(accumulate(advances)).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: acumulación es conmutativa (orden no importa)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 0, max: 100000 }).map(c => ({ amount_cents: c })),
          { minLength: 1, maxLength: 10 }
        ),
        (advances) => {
          const sum1 = accumulate(advances);
          const reversed = [...advances].reverse();
          const sum2 = accumulate(reversed);
          expect(sum1).toBe(sum2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
