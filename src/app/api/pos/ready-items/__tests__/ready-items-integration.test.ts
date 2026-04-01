/**
 * Integration Tests — /api/pos/ready-items + ingest lifecycle
 *
 * Validates the full data flow from ingest events to the ready-items endpoint
 * using a shared mock store that simulates the order_item_projections table.
 *
 * These tests complement the unit tests (which mock Prisma) by verifying
 * that the ingest route projection logic produces the correct state that
 * the ready-items endpoint then returns.
 *
 * @module app/api/pos/ready-items/__tests__/ready-items-integration.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Simulated order_item_projections store (mirrors DB behavior)
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectionRow {
  id: string;
  tenant_id: string;
  order_id: string;
  line_id: string;
  table_number: string | null;
  name: string;
  qty: number;
  station: string;
  status: string;
  notes: string | null;
  submitted_at: Date | null;
  ready_at: Date | null;
  served_at: Date | null;
}

// In-memory projection store — behaves like order_item_projections table
const projectionStore: ProjectionRow[] = [];

function storeInsert(row: Omit<ProjectionRow, 'id'>) {
  const exists = projectionStore.find(r => r.order_id === row.order_id && r.line_id === row.line_id);
  if (!exists) projectionStore.push({ ...row, id: crypto.randomUUID() });
}

function storeUpdate(order_id: string, line_id: string, updates: Partial<ProjectionRow>) {
  const idx = projectionStore.findIndex(r => r.order_id === order_id && r.line_id === line_id);
  if (idx >= 0) Object.assign(projectionStore[idx], updates);
}

function storeDelete(order_id: string, line_id?: string) {
  const predicate = line_id
    ? (r: ProjectionRow) => r.order_id === order_id && r.line_id === line_id
    : (r: ProjectionRow) => r.order_id === order_id;
  const toRemove = projectionStore.filter(predicate);
  toRemove.forEach(r => projectionStore.splice(projectionStore.indexOf(r), 1));
}

function storeReady(tenant_id: string): ProjectionRow[] {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return projectionStore.filter(
    r => r.tenant_id === tenant_id && r.status === 'READY' && r.ready_at && r.ready_at >= cutoff,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — ingest route
// ─────────────────────────────────────────────────────────────────────────────

process.env.PARK_API_SECRET = 'test-secret-integration';

const mockFindFirst = vi.fn().mockResolvedValue(null);

// Build a tx mock whose $executeRaw applies SQL operations to projectionStore
const tx = {
  $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = String(strings);

    if (sql.includes('INSERT INTO order_item_projections')) {
      // INSERT: values are tenant_id, order_id, line_id, table_number, waiter_id,
      //         name, qty, station, status(literal), created_at, updated_at
      storeInsert({
        tenant_id: values[0] as string,
        order_id: values[1] as string,
        line_id: values[2] as string,
        table_number: values[3] as string | null,
        name: values[5] as string,
        qty: values[6] as number,
        station: values[7] as string,
        status: 'PENDING',
        notes: null,
        submitted_at: null,
        ready_at: null,
        served_at: null,
      });
    } else if (sql.includes('UPDATE order_item_projections') && sql.includes('IN_KITCHEN')) {
      // ORDER_SUBMITTED update: order_id at values[2], line_id at values[3]
      storeUpdate(values[2] as string, values[3] as string, {
        status: 'IN_KITCHEN',
        submitted_at: values[0] as Date,
      });
    } else if (sql.includes('UPDATE order_item_projections') && sql.includes('ready_at')) {
      // ORDER_ITEM_STATUS_CHANGED: status=values[0], ready_at=values[1], served_at=values[2],
      //   order_id=values[4], line_id=values[5]
      const updates: Partial<ProjectionRow> = { status: values[0] as string };
      if (values[1]) updates.ready_at = values[1] as Date;
      if (values[2]) updates.served_at = values[2] as Date;
      storeUpdate(values[4] as string, values[5] as string, updates);
    } else if (sql.includes('UPDATE order_item_projections') && sql.includes('notes')) {
      storeUpdate(values[2] as string, values[3] as string, { notes: values[0] as string });
    } else if (sql.includes('UPDATE order_item_projections') && sql.includes('table_number')) {
      // SET table_number=${values[0]}, updated_at=${values[1]} WHERE order_id=${values[2]}::uuid
      const rows = projectionStore.filter(r => r.order_id === (values[2] as string));
      rows.forEach(r => { r.table_number = values[0] as string; });
    } else if (sql.includes('DELETE FROM order_item_projections') && sql.includes('line_id')) {
      storeDelete(values[0] as string, values[1] as string);
    } else if (sql.includes('DELETE FROM order_item_projections')) {
      storeDelete(values[0] as string);
    }
    return 1;
  }),
  orders: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'ORDER_INTEGRATION_01',
      tenant_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      items: [],
      subtotal_cents: 0,
      total_cents: 0,
      fulfillment: { table_number: '12' },
      location_id: null,
      revision: 0,
    }),
    update: vi.fn().mockResolvedValue({}),
    upsert: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn(),
  },
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

vi.mock('@/src/core/inventory/deduction.service', () => ({
  deductInventoryForOrder: vi.fn().mockResolvedValue({ success: true, deductions: [], alerts: [] }),
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
  startSpan: vi.fn().mockReturnValue({ setAttribute: vi.fn() }),
  endSpan: vi.fn(),
}));
vi.mock('@/src/core/observability/tracing', () => ({
  startSpan: vi.fn().mockReturnValue({ setAttribute: vi.fn() }),
  endSpan: vi.fn(),
}));
vi.mock('@/src/core/domain/event-migrator', () => ({
  eventMigrator: { migrate: (e: any) => e },
}));
vi.mock('@/src/core/domain/migrations', () => ({}));
vi.mock('@/src/core/validation', () => ({
  validateEvent: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(tx),
    processed_events: { findFirst: mockFindFirst },
    $queryRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const tenantId = values.find(v => typeof v === 'string');
      return storeReady(tenantId as string);
    }),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const ORDER_ID = 'bbbbbbb0-0000-0000-0000-000000000099';
const LINE_1 = 'integ-line-001';
const LINE_2 = 'integ-line-002';
const SEQ = { n: 0 };

function nextSeq() { return ++SEQ.n; }

function makeEvent(event_type: string, payload: Record<string, unknown>) {
  return {
    event_id: crypto.randomUUID(),
    event_type,
    aggregate_type: 'ORDER',
    aggregate_id: ORDER_ID,
    correlation_id: ORDER_ID,
    causation_id: null,
    actor_id: '00000000-0000-0000-0000-000000000003',
    tenant_id: TENANT_ID,
    terminal_id: 'TERM-INTEG',
    terminal_sequence: nextSeq(),
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

async function postIngest(events: ReturnType<typeof makeEvent>[]) {
  const { POST } = await import('@/src/app/api/events/ingest/route');
  mockFindFirst.mockResolvedValue(null);

  const body = JSON.stringify({
    tenant_id: TENANT_ID,
    terminal_id: 'TERM-INTEG',
    from_terminal_sequence: 0,
    to_terminal_sequence: events.length,
    events,
  });
  const req = new Request('http://localhost/api/events/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
      'x-api-secret': 'test-secret-integration',
    },
    body,
  });
  return POST(req as any);
}

async function getReadyItems() {
  const { GET } = await import('../route');
  const req = new NextRequest('http://localhost/api/pos/ready-items', {
    method: 'GET',
    headers: { 'x-tenant-id': TENANT_ID },
  });
  const res = await GET(req);
  return res.json() as Promise<any[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration — ingest → order_item_projections → ready-items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    projectionStore.length = 0;
    SEQ.n = 0;
    tx.$executeRaw.mockClear();
  });

  it('full lifecycle: CREATE → SUBMIT → READY → check ready-items', async () => {
    // 1. Create order
    await postIngest([makeEvent('ORDER_CREATED', {
      order_id: ORDER_ID,
      order_number: 1001,
      order_type: 'DINE_IN',
      items: [],
      checks: [],
      fulfillment: { table_number: '12', mode: 'DINE_IN' },
    })]);

    // 2. Add items
    await postIngest([
      makeEvent('ORDER_ITEM_ADDED', {
        order_id: ORDER_ID,
        line: { line_id: LINE_1, product_id: 'p1', sku: 's1', name: 'Pollo', qty: 1, unit_price_cents: 1500, station: 'HORNO', status: 'PENDING' },
      }),
      makeEvent('ORDER_ITEM_ADDED', {
        order_id: ORDER_ID,
        line: { line_id: LINE_2, product_id: 'p2', sku: 's2', name: 'Cola', qty: 1, unit_price_cents: 500, station: 'BAR', status: 'PENDING' },
      }),
    ]);

    expect(projectionStore).toHaveLength(2);
    expect(projectionStore.every(r => r.status === 'PENDING')).toBe(true);

    // 3. Submit to kitchen
    await postIngest([makeEvent('ORDER_SUBMITTED', {
      order_id: ORDER_ID,
      submitted_at: new Date().toISOString(),
      items_by_station: {
        HORNO: [{ line_id: LINE_1, product_id: 'p1', name: 'Pollo', qty: 1 }],
        BAR: [{ line_id: LINE_2, product_id: 'p2', name: 'Cola', qty: 1 }],
      },
    })]);

    const inKitchenRows = projectionStore.filter(r => r.status === 'IN_KITCHEN');
    expect(inKitchenRows).toHaveLength(2);

    // 4. Mark LINE_1 as READY
    await postIngest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
      order_id: ORDER_ID,
      line_id: LINE_1,
      from: 'COOKING',
      to: 'READY',
      station: 'HORNO',
    })]);

    const readyRow = projectionStore.find(r => r.line_id === LINE_1);
    expect(readyRow?.status).toBe('READY');
    expect(readyRow?.ready_at).toBeTruthy();

    // 5. Verify ready-items endpoint returns it
    const readyItems = await getReadyItems();
    expect(Array.isArray(readyItems)).toBe(true);
    const foundItem = readyItems.find((r: any) => r.line_id === LINE_1);
    expect(foundItem).toBeDefined();
    expect(foundItem.station).toBe('HORNO');
    expect(foundItem.name).toBe('Pollo');
  });

  it('note update is reflected in projection store', async () => {
    storeInsert({
      tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1,
      table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO',
      status: 'IN_KITCHEN', notes: null, submitted_at: new Date(),
      ready_at: null, served_at: null,
    });

    await postIngest([makeEvent('ORDER_ITEM_NOTE', {
      order_id: ORDER_ID,
      line_id: LINE_1,
      note: 'sin sal',
    })]);

    const row = projectionStore.find(r => r.line_id === LINE_1);
    expect(row?.notes).toBe('sin sal');
  });

  it('table transfer updates all rows for the order', async () => {
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1, table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_2, table_number: '12', name: 'Cola', qty: 1, station: 'BAR', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });

    await postIngest([makeEvent('ORDER_TABLE_CHANGED', {
      order_id: ORDER_ID,
      from_table: '12',
      to_table: '99',
    })]);

    const all = projectionStore.filter(r => r.order_id === ORDER_ID);
    expect(all.every(r => r.table_number === '99')).toBe(true);
  });

  it('voided item is removed from projection, other items remain', async () => {
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1, table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_2, table_number: '12', name: 'Cola', qty: 1, station: 'BAR', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });

    await postIngest([makeEvent('ORDER_ITEM_VOIDED', {
      order_id: ORDER_ID,
      line_id: LINE_1,
      reason: 'CUSTOMER_CHANGE',
      voided_at: new Date().toISOString(),
    })]);

    expect(projectionStore.find(r => r.line_id === LINE_1)).toBeUndefined();
    expect(projectionStore.find(r => r.line_id === LINE_2)).toBeDefined();
  });

  it('ORDER_CANCELLED removes all rows for the order', async () => {
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1, table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_2, table_number: '12', name: 'Cola', qty: 1, station: 'BAR', status: 'PENDING', notes: null, submitted_at: null, ready_at: null, served_at: null });

    await postIngest([makeEvent('ORDER_CANCELLED', {
      order_id: ORDER_ID,
      reason: 'WAITER_CANCEL',
    })]);

    const remaining = projectionStore.filter(r => r.order_id === ORDER_ID);
    expect(remaining).toHaveLength(0);
  });

  it('DONE item does not appear in ready-items', async () => {
    const now = new Date();
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1, table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO', status: 'DONE', notes: null, submitted_at: now, ready_at: now, served_at: now });

    const readyItems = await getReadyItems();
    const found = readyItems.find((r: any) => r.line_id === LINE_1);
    expect(found).toBeUndefined();
  });

  it('READY item older than 2h does not appear in ready-items', async () => {
    const oldDate = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3h ago
    storeInsert({ tenant_id: TENANT_ID, order_id: ORDER_ID, line_id: LINE_1, table_number: '12', name: 'Pollo', qty: 1, station: 'HORNO', status: 'READY', notes: null, submitted_at: oldDate, ready_at: oldDate, served_at: null });

    const readyItems = await getReadyItems();
    const found = readyItems.find((r: any) => r.line_id === LINE_1);
    expect(found).toBeUndefined();
  });
});
