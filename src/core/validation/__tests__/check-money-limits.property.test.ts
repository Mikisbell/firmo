/**
 * Property-Based Tests: POLÍTICA de descuento (approval matrix, ADR-013) + MVP de dinero,
 * validada server-side en el ingest (frontera de confianza).
 *
 * Los casos puntuales viven en check-money-limits.test.ts. Acá van INVARIANTES de alto nivel
 * (no replican la lógica del SUT — la acotan) + los BORDES EXACTOS de los umbrales, que los
 * casos 10%/30%/60% no cubrían. Umbrales anclados en LIMITS (ADR-013), no en números mágicos.
 *
 * Invariantes:
 * 1. MVP: discount > subtotal SIEMPRE se rechaza (jamás total negativo).
 * 2. discount < 0 SIEMPRE se rechaza (DISCOUNT_NEGATIVE).
 * 3. El approver MANAGER nunca restringe: todo lo que pasa sin approver, pasa con MANAGER.
 * 4. Monotonía: si un descuento D es válido, todo D' < D (mismo subtotal) también lo es.
 * 5. Determinismo: mismo input -> mismo veredicto.
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { validateEvent } from '../business-rules';
import { LIMITS } from '@/src/core/constants/limits';
import type { ParkEvent } from '@/src/core/domain/events';
import type { Prisma } from '@prisma/client';

const TID = '11111111-1111-1111-1111-111111111111';
const OID = '22222222-2222-2222-2222-222222222222';
const CID = 'check-1';

function ev(payload: Record<string, unknown>): ParkEvent {
  return {
    event_id: '33333333-3333-3333-3333-333333333333',
    tenant_id: TID,
    event_type: 'CHECK_DISCOUNT_SET',
    aggregate_id: OID,
    actor_role_snapshot: 'CASHIER',
    payload: { order_id: OID, check_id: CID, ...payload },
  } as unknown as ParkEvent;
}

function mockTx(subtotalCents: number, approverRole?: string): Prisma.TransactionClient {
  return {
    orders: {
      findUnique: vi.fn().mockResolvedValue({
        checks: [{ check_id: CID, subtotal_cents: subtotalCents, total_cents: subtotalCents }],
      }),
    },
    employees: {
      findUnique: vi.fn().mockResolvedValue(approverRole ? { role: approverRole, is_active: true } : null),
    },
  } as unknown as Prisma.TransactionClient;
}

const MAX_SUBTOTAL = 100_000_00; // techo de LIMITS.MAX_ORDER_TOTAL_CENTS

describe('CHECK_DISCOUNT_SET — invariantes de política (property, ADR-013)', () => {
  it('Invariante 1 — MVP: discount > subtotal SIEMPRE se rechaza (150 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: MAX_SUBTOTAL }),
        fc.integer({ min: 1, max: 10_000_00 }), // exceso estrictamente positivo
        async (subtotal, exceso) => {
          const r = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: subtotal + exceso, approved_by: 'mgr-1' }));
          expect(r.valid).toBe(false);
          if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');
        }
      ),
      { numRuns: 150 }
    );
  });

  it('Invariante 2 — discount < 0 SIEMPRE se rechaza (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: MAX_SUBTOTAL }),
        fc.integer({ min: -10_000_00, max: -1 }),
        async (subtotal, negDiscount) => {
          const r = await validateEvent(mockTx(subtotal), ev({ discount_cents: negDiscount }));
          expect(r.valid).toBe(false);
          if (!r.valid) expect(r.error).toBe('DISCOUNT_NEGATIVE');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Invariante 3 — el approver MANAGER nunca restringe: auto ⊆ manager-approved (150 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: MAX_SUBTOTAL }),
        fc.integer({ min: 0, max: 100 }),
        async (subtotal, pct) => {
          const discount = Math.floor((subtotal * pct) / 100);
          const sinApprover = await validateEvent(mockTx(subtotal), ev({ discount_cents: discount }));
          if (sinApprover.valid) {
            const conManager = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: discount, approved_by: 'mgr-1' }));
            expect(conManager.valid).toBe(true);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('Invariante 4 — monotonía: si D es válido (MANAGER), D-1 también (150 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: MAX_SUBTOTAL }),
        fc.integer({ min: 1, max: MAX_SUBTOTAL }),
        async (subtotal, dRaw) => {
          const D = Math.min(dRaw, subtotal);
          const rD = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: D, approved_by: 'mgr-1' }));
          if (rD.valid && D >= 1) {
            const rLess = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: D - 1, approved_by: 'mgr-1' }));
            expect(rLess.valid).toBe(true);
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it('Invariante 5 — determinismo: mismo input, mismo veredicto (100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: MAX_SUBTOTAL }),
        fc.integer({ min: -1000, max: MAX_SUBTOTAL }),
        async (subtotal, discount) => {
          const r1 = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: discount, approved_by: 'mgr-1' }));
          const r2 = await validateEvent(mockTx(subtotal, 'MANAGER'), ev({ discount_cents: discount, approved_by: 'mgr-1' }));
          expect(r1.valid).toBe(r2.valid);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Bordes exactos de los umbrales — anclados en LIMITS (ADR-013). subtotal 10000 divide limpio
// por 100, así (subtotal * pct)/100 es entero (centavos, sin float).
const SUB = 10000;
const AUTO = LIMITS.DISCOUNT_AUTO_APPROVE_MAX_PERCENT; // 15
const MGR = LIMITS.DISCOUNT_MANAGER_MAX_PERCENT; // 50

describe('CHECK_DISCOUNT_SET — bordes exactos de los umbrales (ADR-013)', () => {
  it(`borde AUTO exacto (${AUTO}%) -> pasa sin aprobación`, async () => {
    const r = await validateEvent(mockTx(SUB), ev({ discount_cents: (SUB * AUTO) / 100 }));
    expect(r.valid).toBe(true);
  });

  it(`justo sobre AUTO (${AUTO}% + 1 centavo) -> REQUIERE MANAGER`, async () => {
    const r = await validateEvent(mockTx(SUB), ev({ discount_cents: (SUB * AUTO) / 100 + 1 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_REQUIRES_MANAGER_APPROVAL');
  });

  it(`borde MANAGER exacto (${MGR}%) SIN approver -> REQUIERE MANAGER`, async () => {
    const r = await validateEvent(mockTx(SUB), ev({ discount_cents: (SUB * MGR) / 100 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_REQUIRES_MANAGER_APPROVAL');
  });

  it(`borde MANAGER exacto (${MGR}%) CON MANAGER -> OK`, async () => {
    const r = await validateEvent(mockTx(SUB, 'MANAGER'), ev({ discount_cents: (SUB * MGR) / 100, approved_by: 'mgr-1' }));
    expect(r.valid).toBe(true);
  });

  it(`justo sobre MANAGER (${MGR}% + 1 centavo) CON MANAGER -> DISCOUNT_EXCEEDS_MAX`, async () => {
    const r = await validateEvent(mockTx(SUB, 'MANAGER'), ev({ discount_cents: (SUB * MGR) / 100 + 1, approved_by: 'mgr-1' }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_MAX');
  });

  it('borde 100% (discount == subtotal) CON MANAGER -> DISCOUNT_EXCEEDS_MAX', async () => {
    const r = await validateEvent(mockTx(SUB, 'MANAGER'), ev({ discount_cents: SUB, approved_by: 'mgr-1' }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_MAX');
  });
});
