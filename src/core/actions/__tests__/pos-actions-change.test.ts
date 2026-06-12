/**
 * Tests for POSActions.markCheckPaid — change_cents (vuelto) propagation
 *
 * Verifies that CHECK_MARKED_PAID events carry the correct change_cents:
 * - CASH with vuelto → positive change_cents
 * - Digital / exact amount → 0
 * - Defensive clamping (negative → 0, non-integer → rounded)
 * - Payload validates against the EventSchema discriminated union
 *
 * @module core/actions/__tests__/pos-actions-change.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// Mocks (Dexie + SyncClient are browser-only)
// ============================================================================

const addedEvents: any[] = [];

vi.mock('@/src/core/db/schema', () => ({
  db: {
    events: {
      add: vi.fn(async (event: any) => {
        addedEvents.push(event);
        return event.event_id;
      }),
      orderBy: vi.fn(() => ({
        last: vi.fn(async () => undefined), // empty log → sequence starts at 1
      })),
    },
  },
}));

vi.mock('@/src/core/sync/client', () => ({
  getSyncClient: () => ({ start: vi.fn() }),
}));

import { POSActions } from '../pos.actions';
import { EventSchema } from '@/src/core/domain/events';

// ============================================================================
// Helpers
// ============================================================================

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERM_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ACTOR_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const ORDER_ID = 'd4e5f6a7-b8c9-0123-def1-234567890123';
const CHECK_ID = 'c1';

function lastEvent() {
  return addedEvents[addedEvents.length - 1];
}

describe('POSActions.markCheckPaid — change_cents', () => {
  beforeEach(() => {
    addedEvents.length = 0;
    vi.clearAllMocks();
  });

  it('caso CASH con vuelto: persiste change_cents > 0 en CHECK_MARKED_PAID', async () => {
    // Cliente paga S/ 50.00 por una cuenta de S/ 45.00 → vuelto S/ 5.00
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID, 500);

    const event = lastEvent();
    expect(event.event_type).toBe('CHECK_MARKED_PAID');
    expect(event.payload.change_cents).toBe(500);
    expect(event.payload.order_id).toBe(ORDER_ID);
    expect(event.payload.check_id).toBe(CHECK_ID);
  });

  it('caso digital (Yape/Plin/tarjeta): change_cents = 0', async () => {
    // Pagos digitales son exactos — el caller pasa 0
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID, 0);

    expect(lastEvent().payload.change_cents).toBe(0);
  });

  it('caso monto exacto: change_cents = 0 (default cuando se omite)', async () => {
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID);

    expect(lastEvent().payload.change_cents).toBe(0);
  });

  it('clampa valores negativos a 0 (defensa contra shortfall propagado)', async () => {
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID, -300);

    expect(lastEvent().payload.change_cents).toBe(0);
  });

  it('redondea valores no enteros (dinero siempre en centavos integer)', async () => {
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID, 499.6);

    expect(lastEvent().payload.change_cents).toBe(500);
    expect(Number.isInteger(lastEvent().payload.change_cents)).toBe(true);
  });

  it('el evento emitido valida contra EventSchema (discriminated union)', async () => {
    await POSActions.markCheckPaid(TENANT_ID, TERM_ID, ACTOR_ID, ORDER_ID, CHECK_ID, 1250);

    const parsed = EventSchema.safeParse(lastEvent());
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.event_type === 'CHECK_MARKED_PAID') {
      expect(parsed.data.payload.change_cents).toBe(1250);
    }
  });
});
