/**
 * Caracterización: defensa server-side de ORDER_ITEM_VOIDED contra estados terminales.
 *
 * HALLAZGO (auditoría fresca 2026-06-29): `validateItemVoided` NO validaba el ESTADO del
 * item. El front respeta `canTransition` (no ofrece VOID en DONE/VOIDED — estados
 * terminales en item-status-machine), PERO el ingest no debe confiar en el cliente: un
 * evento offline/manipulado podía anular un item DONE — que YA dedujo inventario
 * (ORDER_ITEM_STATUS_CHANGED -> DONE en project-event) — y borrar su proyección SIN
 * reversar el stock => descuadre de inventario.
 *
 * FIX: `validateItemVoided` lee el status VIVO de `order_item_projections` (única fuente,
 * ADR-010) y rechaza anular items en estado terminal (DONE/VOIDED) con ITEM_NOT_VOIDABLE.
 * Cierra el hueco en la RAÍZ (validación server-side), no con un parche en el handler.
 */
import { describe, it, expect, vi } from 'vitest';
import { validateEvent } from '../business-rules';
import type { ParkEvent } from '@/src/core/domain/events';
import type { Prisma } from '@prisma/client';

const TID = '11111111-1111-1111-1111-111111111111';
const OID = '22222222-2222-2222-2222-222222222222';
const LID = 'line-1';

function voidEvent(role = 'MANAGER'): ParkEvent {
  return {
    event_id: '33333333-3333-3333-3333-333333333333',
    tenant_id: TID,
    event_type: 'ORDER_ITEM_VOIDED',
    actor_role_snapshot: role,
    payload: { order_id: OID, line_id: LID, reason: 'plato devuelto por el cliente' },
  } as unknown as ParkEvent;
}

function mockTx(itemStatus: string | null): Prisma.TransactionClient {
  return {
    orders: {
      findUnique: vi.fn().mockResolvedValue({
        id: OID,
        items: [{ line_id: LID, product_id: 'prod-1', qty: 1 }],
        order_status: 'OPEN',
      }),
    },
    order_item_projections: {
      findMany: vi.fn().mockResolvedValue(
        itemStatus
          ? [{ order_id: OID, line_id: LID, status: itemStatus, station: 'PARRILLA', updated_at: new Date() }]
          : [],
      ),
    },
    employees: { findUnique: vi.fn() },
  } as unknown as Prisma.TransactionClient;
}

describe('ORDER_ITEM_VOIDED — defensa server-side de estado terminal', () => {
  it('RECHAZA anular un item DONE (ya dedujo inventario) -> ITEM_NOT_VOIDABLE', async () => {
    const r = await validateEvent(mockTx('DONE'), voidEvent());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('ITEM_NOT_VOIDABLE');
  });

  it('RECHAZA anular un item ya VOIDED -> ITEM_NOT_VOIDABLE', async () => {
    const r = await validateEvent(mockTx('VOIDED'), voidEvent());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.error).toBe('ITEM_NOT_VOIDABLE');
  });

  it('PERMITE anular un item COOKING (aún no deducido)', async () => {
    const r = await validateEvent(mockTx('COOKING'), voidEvent());
    expect(r.valid).toBe(true);
  });

  it('PERMITE anular un item sin fila en la proyección (PENDING, no deducido)', async () => {
    const r = await validateEvent(mockTx(null), voidEvent());
    expect(r.valid).toBe(true);
  });
});
