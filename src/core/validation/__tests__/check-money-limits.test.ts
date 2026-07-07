/**
 * Caracterización: POLÍTICA de descuento (approval matrix, ADR-013) + límites de propina,
 * validados server-side en el ingest.
 *
 * HALLAZGO (auditoría 2026-06-30): el ingest no validaba descuento ni propina (caían al
 * default de validateEvent), y CHECK_DISCOUNT_SET ni siquiera estaba en la matriz de permisos
 * (los descuentos se perdían al sync). El descuento NO es un permiso binario por rol: el rol
 * de caja lo emite, pero la POLÍTICA por umbral de % decide la autorización (PBAC, patrón
 * Toast/Square/Lightspeed). El ingest es la frontera de confianza (no confía en el cliente).
 */
import { describe, it, expect, vi } from 'vitest';
import { validateEvent } from '../business-rules';
import type { ParkEvent } from '@/src/core/domain/events';
import type { Prisma } from '@prisma/client';

const TID = '11111111-1111-1111-1111-111111111111';
const OID = '22222222-2222-2222-2222-222222222222';
const CID = 'check-1';

function ev(type: string, payload: Record<string, unknown>, role = 'CASHIER'): ParkEvent {
  return {
    event_id: '33333333-3333-3333-3333-333333333333',
    tenant_id: TID,
    event_type: type,
    aggregate_id: OID,
    actor_role_snapshot: role,
    payload,
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

describe('CHECK_DISCOUNT_SET — POLÍTICA de descuento por umbral (approval matrix)', () => {
  it('AUTONOMÍA: descuento <= 15% pasa sin aprobación (rol de caja)', async () => {
    // 500 / 5000 = 10%
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 500 }));
    expect(r.valid).toBe(true);
  });

  it('REQUIERE MANAGER: descuento 15-50% SIN approved_by -> DISCOUNT_REQUIRES_MANAGER_APPROVAL', async () => {
    // 1500 / 5000 = 30%
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 1500 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_REQUIRES_MANAGER_APPROVAL');
  });

  it('APROBADO: descuento 15-50% CON approved_by de MANAGER -> OK', async () => {
    const r = await validateEvent(mockTx(5000, 'MANAGER'), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 1500, approved_by: 'mgr-1' }));
    expect(r.valid).toBe(true);
  });

  it('RECHAZA aprobador NO-manager (WAITER) en descuento 15-50% -> DISCOUNT_REQUIRES_MANAGER_APPROVAL', async () => {
    const r = await validateEvent(mockTx(5000, 'WAITER'), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 1500, approved_by: 'w-1' }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_REQUIRES_MANAGER_APPROVAL');
  });

  it('RECHAZA descuento > 50% (tope de manager) -> DISCOUNT_EXCEEDS_MAX', async () => {
    // 3000 / 5000 = 60%
    const r = await validateEvent(mockTx(5000, 'MANAGER'), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 3000, approved_by: 'mgr-1' }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_MAX');
  });

  it('RECHAZA descuento > subtotal -> DISCOUNT_EXCEEDS_SUBTOTAL (MVP: total negativo)', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 6000 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');
  });

  it('RECHAZA descuento negativo -> DISCOUNT_NEGATIVE', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: -100 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_NEGATIVE');
  });
});

describe('CHECK_TIP_SET — límites de propina server-side', () => {
  it('RECHAZA propina > máximo absoluto -> TIP_TOO_HIGH', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_TIP_SET', { order_id: OID, check_id: CID, tip_cents: 999_999_999 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('TIP_TOO_HIGH');
  });

  it('RECHAZA propina negativa -> TIP_NEGATIVE', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_TIP_SET', { order_id: OID, check_id: CID, tip_cents: -50 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('TIP_NEGATIVE');
  });

  it('PERMITE propina razonable (S/5 sobre S/100)', async () => {
    const r = await validateEvent(mockTx(10000), ev('CHECK_TIP_SET', { order_id: OID, check_id: CID, tip_cents: 500 }));
    expect(r.valid).toBe(true);
  });
});

// ── HUECOS ADVERSARIALES (auditoría del propio fix, 2026-07-01) ──────────────
describe('CHECK_DISCOUNT_SET — huecos adversariales', () => {
  // Check inexistente: el evento apunta a un check_id que NO está en la orden.
  function mockTxNoCheck(): Prisma.TransactionClient {
    return {
      orders: { findUnique: vi.fn().mockResolvedValue({ checks: [{ check_id: 'OTRO-check', subtotal_cents: 5000 }] }) },
      employees: { findUnique: vi.fn() },
    } as unknown as Prisma.TransactionClient;
  }

  it('RECHAZA descuento sobre un check INEXISTENTE -> CHECK_NOT_FOUND (no dinero fantasma)', async () => {
    const r = await validateEvent(mockTxNoCheck(), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 3000 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('CHECK_NOT_FOUND');
  });

  it('RECHAZA descuento > 0 sobre un check con subtotal 0 -> DISCOUNT_EXCEEDS_SUBTOTAL', async () => {
    const r = await validateEvent(mockTx(0), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 500 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');
  });
});

describe('CHECK_TIP_SET — huecos adversariales', () => {
  function mockTxNoCheck(): Prisma.TransactionClient {
    return {
      orders: { findUnique: vi.fn().mockResolvedValue({ checks: [{ check_id: 'OTRO-check', subtotal_cents: 5000 }] }) },
      employees: { findUnique: vi.fn() },
    } as unknown as Prisma.TransactionClient;
  }

  it('RECHAZA propina sobre un check INEXISTENTE -> CHECK_NOT_FOUND', async () => {
    const r = await validateEvent(mockTxNoCheck(), ev('CHECK_TIP_SET', { order_id: OID, check_id: CID, tip_cents: 500 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('CHECK_NOT_FOUND');
  });
});
