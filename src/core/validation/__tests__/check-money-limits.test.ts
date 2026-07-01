/**
 * Caracterización: defensa server-side de límites de dinero en CHECK_DISCOUNT_SET / CHECK_TIP_SET.
 *
 * HALLAZGO (auditoría 2026-06-30): el ingest NO validaba descuento ni propina — ambos eventos
 * caían al `default: return { valid: true }` en validateEvent. La validación existía SOLO en
 * client-validation.ts (cliente), bypasseable con un evento offline/manipulado. Un descuento
 * mayor al subtotal producía un total NEGATIVO; una propina sin tope, un cobro desproporcionado.
 *
 * FIX: validateCheckDiscount rechaza discount > subtotal (DISCOUNT_EXCEEDS_SUBTOTAL); validateCheckTip
 * rechaza propina > máximo absoluto / % del subtotal (TIP_TOO_HIGH). Mismo patrón que ADR-012 (VOID):
 * el ingest es la frontera de confianza, no confía en el cliente.
 */
import { describe, it, expect, vi } from 'vitest';
import { validateEvent } from '../business-rules';
import type { ParkEvent } from '@/src/core/domain/events';
import type { Prisma } from '@prisma/client';

const TID = '11111111-1111-1111-1111-111111111111';
const OID = '22222222-2222-2222-2222-222222222222';
const CID = 'check-1';

function ev(type: string, payload: Record<string, unknown>, role = 'MANAGER'): ParkEvent {
  return {
    event_id: '33333333-3333-3333-3333-333333333333',
    tenant_id: TID,
    event_type: type,
    aggregate_id: OID,
    actor_role_snapshot: role,
    payload,
  } as unknown as ParkEvent;
}

function mockTx(subtotalCents: number): Prisma.TransactionClient {
  return {
    orders: {
      findUnique: vi.fn().mockResolvedValue({
        checks: [{ check_id: CID, subtotal_cents: subtotalCents, total_cents: subtotalCents }],
      }),
    },
    employees: { findUnique: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe('CHECK_DISCOUNT_SET — defensa server-side (descuento no excede subtotal)', () => {
  it('RECHAZA descuento > subtotal -> DISCOUNT_EXCEEDS_SUBTOTAL (evita total negativo)', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 6000 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_EXCEEDS_SUBTOTAL');
  });

  it('RECHAZA descuento negativo -> DISCOUNT_NEGATIVE', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: -100 }));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('DISCOUNT_NEGATIVE');
  });

  it('PERMITE descuento <= subtotal', async () => {
    const r = await validateEvent(mockTx(5000), ev('CHECK_DISCOUNT_SET', { order_id: OID, check_id: CID, discount_cents: 3000 }));
    expect(r.valid).toBe(true);
  });
});

describe('CHECK_TIP_SET — defensa server-side (propina con límites)', () => {
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
