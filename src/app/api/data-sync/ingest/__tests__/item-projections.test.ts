/**
 * Ingest — order_item_projections lifecycle tests
 *
 * Validates that the ingest route correctly projects each event type
 * into the order_item_projections table via $executeRaw.
 *
 * Events tested:
 * - ORDER_ITEM_ADDED     → INSERT row (status=PENDING)
 * - ORDER_SUBMITTED      → UPDATE status=IN_KITCHEN, submitted_at
 * - ORDER_ITEM_STATUS_CHANGED (READY)  → UPDATE status, ready_at
 * - ORDER_ITEM_STATUS_CHANGED (DONE)   → UPDATE status, served_at
 * - ORDER_ITEM_VOIDED    → DELETE row
 * - ORDER_ITEM_NOTE      → UPDATE notes
 * - ORDER_TABLE_CHANGED  → UPDATE table_number for all rows
 * - ORDER_CANCELLED      → DELETE all rows for order
 *
 * @module app/api/events/ingest/__tests__/item-projections.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fc from 'fast-check';
import { signTestToken } from '@/src/test-utils/helpers/auth';

// ---------------------------------------------------------------------------
// Mocks — full prisma tx object
// ---------------------------------------------------------------------------

const mockExecuteRaw = vi.fn().mockResolvedValue(1);
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockFindFirst = vi.fn();

const tx = {
  $executeRaw: mockExecuteRaw,
  orders: { findUnique: mockFindUnique, update: mockUpdate, upsert: mockUpsert, updateMany: vi.fn() },
  processed_events: { findFirst: mockFindFirst, create: vi.fn() },
  events: { create: vi.fn() },
  event_outbox: { create: vi.fn() },
  payments: { upsert: vi.fn() },
  invoices: { upsert: vi.fn() },
  refunds: { upsert: vi.fn() },
  shifts: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  locations: { findFirst: vi.fn() },
  tenant_settings: { findFirst: vi.fn() },
};

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
    processed_events: { findFirst: mockFindFirst },
  },
}));

vi.mock('@/src/core/inventory/deduction.service', () => ({
  deductInventoryForOrder: vi.fn().mockResolvedValue({ success: true, deductions: [], alerts: [], productIdToReevaluate: null }),
}));

vi.mock('@/src/core/conflict/conflict-resolver', () => ({
  detectAndResolveConflict: vi.fn().mockResolvedValue({ resolution: 'ACCEPT' }),
}));

vi.mock('@/src/core/notifications/event-listener', () => ({
  registerNotificationHandlers: vi.fn(),
}));

vi.mock('@/src/core/events/out-of-order-queue', () => ({
  outOfOrderQueue: { enqueue: vi.fn(), processAll: vi.fn() },
  startCleanupJob: vi.fn(),
}));

vi.mock('@/src/core/rate-limiting/rate-limiter', () => ({
  rateLimiter: { checkLimit: vi.fn().mockResolvedValue({ allowed: true }) },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  startSpan: vi.fn().mockReturnValue('span'),
  endSpan: vi.fn(),
}));

vi.mock('@/src/core/observability/tracing', () => ({
  startSpan: vi.fn().mockReturnValue('span'),
  endSpan: vi.fn(),
}));

vi.mock('@/src/core/domain/event-migrator', () => ({
  eventMigrator: { migrate: (e: any) => e },
}));

vi.mock('@/src/core/domain/migrations', () => ({}));

vi.mock('@/src/core/validation', () => ({
  validateEvent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Auth: JWT (Bearer). El claim `tid` debe coincidir con TENANT_ID porque el
// ingest fuerza el tenant_id de cada evento desde el token, no desde el body.
const TENANT_ID  = '00000000-0000-0000-0000-000000000001';
const TERMINAL_ID = 'TERM-001';
const ORDER_ID   = '00000000-0000-0000-0000-000000000020';
const LINE_ID    = 'line-abc-001';
const ACTOR_ID   = '00000000-0000-0000-0000-000000000099';

function baseEvent(event_type: string, payload: Record<string, unknown>) {
  return {
    event_id: crypto.randomUUID(),
    event_type,
    aggregate_type: 'ORDER',
    aggregate_id: ORDER_ID,
    correlation_id: ORDER_ID,
    causation_id: null,
    actor_id: ACTOR_ID,
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    terminal_sequence: 1,
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

function mockOrderExists(fulfillment: unknown = { table_number: '5' }) {
  mockFindUnique.mockResolvedValue({
    id: ORDER_ID,
    tenant_id: TENANT_ID,
    items: [],
    subtotal_cents: 0,
    total_cents: 0,
    fulfillment,
    location_id: null,
  });
  mockUpdate.mockResolvedValue({});
}

// Simulate a POST to the ingest route with a single event
async function ingestEvent(event: ReturnType<typeof baseEvent>) {
  const { POST } = await import('../route');
  // Mark event as not-yet-processed
  mockFindFirst.mockResolvedValue(null);

  const body = JSON.stringify({
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    from_terminal_sequence: 0,
    to_terminal_sequence: 1,
    events: [event],
  });
  const token = await signTestToken({ tenantId: TENANT_ID, actorId: ACTOR_ID });
  const req = new NextRequest('http://localhost/api/events/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authorization': `Bearer ${token}`,
    },
    body,
  });
  return POST(req);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Ingest — order_item_projections projections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockUpdate.mockResolvedValue({});
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);
  });

  // ── ORDER_ITEM_ADDED ──────────────────────────────────────────────────────

  it('ORDER_ITEM_ADDED: inserts projection row via $executeRaw', async () => {
    mockOrderExists();
    const event = baseEvent('ORDER_ITEM_ADDED', {
      order_id: ORDER_ID,
      line: {
        line_id: LINE_ID,
        product_id: 'prod-001',
        sku: 'sku-001',
        name: '1/4 Pollo',
        qty: 1,
        unit_price_cents: 1500,
        station: 'HORNO',
        status: 'PENDING',
      },
    });
    await ingestEvent(event);

    const insertCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('INSERT INTO order_item_projections');
    });
    expect(insertCall).toBeDefined();
  });

  it('ORDER_ITEM_ADDED: includes table_number from order fulfillment', async () => {
    mockOrderExists({ table_number: 'M7' });
    const event = baseEvent('ORDER_ITEM_ADDED', {
      order_id: ORDER_ID,
      line: { line_id: LINE_ID, product_id: 'prod-002', sku: 'sku-002', name: 'Bisteck', qty: 1, unit_price_cents: 2500, station: 'PARRILLA', status: 'PENDING' },
    });
    await ingestEvent(event);

    const insertCall = mockExecuteRaw.mock.calls.find(call => String(call[0]).includes('INSERT INTO order_item_projections'));
    expect(insertCall).toBeDefined();
    // table_number 'M7' should appear in the values
    const values = insertCall!.slice(1);
    expect(values).toContain('M7');
  });

  it('ORDER_ITEM_ADDED: gracefully skips projection when order not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const event = baseEvent('ORDER_ITEM_ADDED', {
      order_id: ORDER_ID,
      line: { line_id: LINE_ID, product_id: 'prod-003', sku: 'sku-003', name: 'Test', qty: 1, unit_price_cents: 100, station: 'COCINA', status: 'PENDING' },
    });
    // Should not throw
    await expect(ingestEvent(event)).resolves.toBeDefined();
    // No INSERT should be called
    const insertCall = mockExecuteRaw.mock.calls.find(call => String(call[0]).includes('INSERT INTO order_item_projections'));
    expect(insertCall).toBeUndefined();
  });

  // ── ORDER_SUBMITTED ───────────────────────────────────────────────────────

  it('ORDER_SUBMITTED: updates status to IN_KITCHEN for each item', async () => {
    mockOrderExists();
    const event = baseEvent('ORDER_SUBMITTED', {
      order_id: ORDER_ID,
      submitted_at: new Date().toISOString(),
      items_by_station: {
        HORNO:   [{ line_id: 'line-1', product_id: 'prod-1', name: 'Pollo', qty: 1 }],
        PARRILLA:[{ line_id: 'line-2', product_id: 'prod-2', name: 'Bisteck', qty: 1 }],
      },
    });
    await ingestEvent(event);

    const updateCalls = mockExecuteRaw.mock.calls.filter(call => {
      const sql = String(call[0]);
      return sql.includes('UPDATE order_item_projections') && sql.includes('IN_KITCHEN');
    });
    expect(updateCalls).toHaveLength(2); // one per item
  });

  // ── ORDER_ITEM_STATUS_CHANGED ─────────────────────────────────────────────

  it('ORDER_ITEM_STATUS_CHANGED(READY): updates status and ready_at', async () => {
    mockOrderExists();
    const event = baseEvent('ORDER_ITEM_STATUS_CHANGED', {
      order_id: ORDER_ID,
      line_id: LINE_ID,
      from: 'COOKING',
      to: 'READY',
      station: 'HORNO',
    });
    await ingestEvent(event);

    const updateCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('UPDATE order_item_projections') && sql.includes('ready_at');
    });
    expect(updateCall).toBeDefined();
    // The new status 'READY' should be in the values
    expect(updateCall!.slice(1)).toContain('READY');
  });

  it('ORDER_ITEM_STATUS_CHANGED(DONE): updates status and served_at', async () => {
    mockOrderExists();
    const event = baseEvent('ORDER_ITEM_STATUS_CHANGED', {
      order_id: ORDER_ID,
      line_id: LINE_ID,
      from: 'READY',
      to: 'DONE',
      station: 'HORNO',
    });
    await ingestEvent(event);

    const updateCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('UPDATE order_item_projections') && sql.includes('served_at');
    });
    expect(updateCall).toBeDefined();
    expect(updateCall!.slice(1)).toContain('DONE');
  });

  // ── ORDER_ITEM_VOIDED ─────────────────────────────────────────────────────

  it('ORDER_ITEM_VOIDED: deletes projection row', async () => {
    const event = baseEvent('ORDER_ITEM_VOIDED', { order_id: ORDER_ID, line_id: LINE_ID, reason: 'UNDO', voided_at: new Date().toISOString() });
    await ingestEvent(event);

    const deleteCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('DELETE FROM order_item_projections') && sql.includes('line_id');
    });
    expect(deleteCall).toBeDefined();
    expect(deleteCall!.slice(1)).toContain(LINE_ID);
  });

  // ── ORDER_ITEM_NOTE ───────────────────────────────────────────────────────

  it('ORDER_ITEM_NOTE: updates notes field', async () => {
    const note = 'sin cebolla';
    const event = baseEvent('ORDER_ITEM_NOTE', { order_id: ORDER_ID, line_id: LINE_ID, note });
    await ingestEvent(event);

    const updateCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('UPDATE order_item_projections') && sql.includes('notes');
    });
    expect(updateCall).toBeDefined();
    expect(updateCall!.slice(1)).toContain(note);
  });

  // ── ORDER_TABLE_CHANGED ───────────────────────────────────────────────────

  it('ORDER_TABLE_CHANGED: updates table_number for all rows of the order', async () => {
    const event = baseEvent('ORDER_TABLE_CHANGED', { order_id: ORDER_ID, from_table: '5', to_table: '8' });
    await ingestEvent(event);

    const updateCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('UPDATE order_item_projections') && sql.includes('table_number');
    });
    expect(updateCall).toBeDefined();
    expect(updateCall!.slice(1)).toContain('8');
  });

  // ── ORDER_CANCELLED ───────────────────────────────────────────────────────

  it('ORDER_CANCELLED: deletes all projection rows for the order', async () => {
    const event = baseEvent('ORDER_CANCELLED', { order_id: ORDER_ID, reason: 'WAITER_CANCEL' });
    await ingestEvent(event);

    const deleteCall = mockExecuteRaw.mock.calls.find(call => {
      const sql = String(call[0]);
      return sql.includes('DELETE FROM order_item_projections') && !sql.includes('line_id');
    });
    expect(deleteCall).toBeDefined();
    expect(deleteCall!.slice(1)).toContain(ORDER_ID);
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Ingest projections — property tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRaw.mockResolvedValue(1);
    mockUpdate.mockResolvedValue({});
    mockUpsert.mockResolvedValue({});
    mockFindFirst.mockResolvedValue(null);
  });

  it('invariant: any note string is stored verbatim (no truncation in event)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
        async (note) => {
          mockExecuteRaw.mockClear();
          mockFindFirst.mockResolvedValue(null);
          const event = baseEvent('ORDER_ITEM_NOTE', { order_id: ORDER_ID, line_id: LINE_ID, note });
          await ingestEvent(event);

          const updateCall = mockExecuteRaw.mock.calls.find(call =>
            String(call[0]).includes('UPDATE order_item_projections') && String(call[0]).includes('notes'),
          );
          expect(updateCall).toBeDefined();
          expect(updateCall!.slice(1)).toContain(note);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('invariant: ORDER_SUBMITTED always calls $executeRaw once per item', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          HORNO:    fc.array(fc.record({ line_id: fc.uuid(), product_id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 20 }), qty: fc.integer({ min: 1, max: 5 }) }), { minLength: 0, maxLength: 5 }),
          PARRILLA: fc.array(fc.record({ line_id: fc.uuid(), product_id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 20 }), qty: fc.integer({ min: 1, max: 5 }) }), { minLength: 0, maxLength: 5 }),
          BAR:      fc.array(fc.record({ line_id: fc.uuid(), product_id: fc.uuid(), name: fc.string({ minLength: 1, maxLength: 20 }), qty: fc.integer({ min: 1, max: 5 }) }), { minLength: 0, maxLength: 3 }),
        }),
        async (itemsByStation) => {
          mockExecuteRaw.mockClear();
          mockFindFirst.mockResolvedValue(null);
          const totalItems = Object.values(itemsByStation).reduce((sum, arr) => sum + arr.length, 0);
          const event = baseEvent('ORDER_SUBMITTED', {
            order_id: ORDER_ID,
            submitted_at: new Date().toISOString(),
            items_by_station: itemsByStation,
          });
          await ingestEvent(event);

          const inKitchenCalls = mockExecuteRaw.mock.calls.filter(call =>
            String(call[0]).includes('IN_KITCHEN'),
          );
          expect(inKitchenCalls).toHaveLength(totalItems);
        },
      ),
      { numRuns: 50 },
    );
  });
});
