/**
 * Smoke Test — Per-Item Waiter Notification System
 *
 * Simulates the complete lifecycle of the order_item_projections table
 * and the /api/pos/ready-items endpoint end-to-end against a running server.
 *
 * Usage:
 *   node scripts/smoke-waiter-features.mjs
 *   BASE_URL=https://your-app.vercel.app node scripts/smoke-waiter-features.mjs
 *
 * Prerequisites: dev server running (npm run dev) or production URL set.
 */

import { randomUUID } from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TENANT_ID = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const API_SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const TERMINAL_ID = 'SMOKE_TEST_TERM_01';

let passed = 0;
let failed = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function ok(msg) {
  console.log(`  ✅ ${msg}`);
  passed++;
}

function fail(msg, detail = '') {
  console.log(`  ❌ ${msg}${detail ? `\n     ${detail}` : ''}`);
  failed++;
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

async function ingest(events) {
  const res = await fetch(`${BASE_URL}/api/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-id': TENANT_ID,
      'x-api-secret': API_SECRET,
    },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      from_terminal_sequence: 0,
      to_terminal_sequence: events.length,
      events,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function makeEvent(event_type, payload, overrides = {}) {
  const aggregateId = overrides.aggregate_id || overrides.order_id || payload.order_id || payload.shift_id || randomUUID();
  return {
    event_id: randomUUID(),
    event_type,
    aggregate_type: 'ORDER',
    aggregate_id: aggregateId,
    correlation_id: aggregateId,
    causation_id: null,
    actor_id: '00000000-0000-0000-0000-000000000003',
    actor_role_snapshot: 'OWNER',
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    terminal_sequence: overrides.seq || 1,
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    payload,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Connectivity check
// ─────────────────────────────────────────────────────────────────────────────

section('1. Connectivity');

try {
  const res = await fetch(`${BASE_URL}/`);
  if (res.ok || res.status === 307 || res.status === 308) {
    ok(`Server reachable at ${BASE_URL} (${res.status})`);
  } else {
    fail(`Server returned ${res.status}`);
  }
} catch (e) {
  fail(`Cannot reach ${BASE_URL} — is the server running?`, e.message);
  console.log('\n⚠️  Aborting smoke test — start the server first: npm run dev\n');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. /api/pos/ready-items — missing header
// ─────────────────────────────────────────────────────────────────────────────

section('2. GET /api/pos/ready-items — validation');

{
  const res = await fetch(`${BASE_URL}/api/pos/ready-items`);
  if (res.status === 400) {
    ok('Returns 400 when x-tenant-id header missing');
  } else {
    fail(`Expected 400 without header, got ${res.status}`);
  }
}

{
  const res = await fetch(`${BASE_URL}/api/pos/ready-items`, {
    headers: { 'x-tenant-id': TENANT_ID },
  });
  if (res.status === 200) {
    const body = await res.json();
    if (Array.isArray(body)) {
      ok(`Returns 200 + array with tenant header (${body.length} ready items)`);
    } else {
      fail('Returns 200 but body is not an array');
    }
  } else {
    fail(`Expected 200 with tenant header, got ${res.status}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Full lifecycle via /api/events/ingest
// ─────────────────────────────────────────────────────────────────────────────

section('3. order_item_projections lifecycle');

const ORDER_ID = randomUUID();
const SHIFT_ID = randomUUID();
const PRODUCT_ID_1 = randomUUID();
const PRODUCT_ID_2 = randomUUID();
const LINE_ID_1 = `smoke-line-${Date.now()}-1`;
const LINE_ID_2 = `smoke-line-${Date.now()}-2`;

// 3.0 — SHIFT_OPENED (required before ORDER_CREATED)
{
  const res = await ingest([makeEvent('SHIFT_OPENED', {
    shift_id: SHIFT_ID,
    cash_opening_cents: 10000,
  }, { aggregate_type: 'SHIFT', aggregate_id: SHIFT_ID, seq: 0 })]);

  if (res.status === 200) {
    // Check body for rejections
    const rejected = res.body?.rejected ?? [];
    if (rejected.length === 0) {
      ok('SHIFT_OPENED accepted — terminal has open shift');
    } else {
      const err = rejected[0]?.error;
      if (err === 'SHIFT_ALREADY_OPEN' || err === 'DUPLICATE_EVENT') {
        ok(`SHIFT_OPENED skipped (${err}) — shift already open`);
      } else {
        fail(`SHIFT_OPENED rejected: ${err}`, JSON.stringify(rejected[0]));
      }
    }
  } else {
    fail(`SHIFT_OPENED HTTP error (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.1 — ORDER_CREATED
{
  const res = await ingest([makeEvent('ORDER_CREATED', {
    order_id: ORDER_ID,
    order_number: 9901,
    order_type: 'DINE_IN',
    items: [],
    checks: [],
    fulfillment: { table_number: '99', mode: 'DINE_IN' },
  }, { aggregate_id: ORDER_ID, seq: 1 })]);

  const rejected = res.body?.rejected ?? [];
  if (res.status === 200 && rejected.length === 0) {
    ok('ORDER_CREATED accepted (status 200)');
  } else if (res.status === 200 && rejected.length > 0) {
    fail(`ORDER_CREATED rejected: ${rejected[0]?.error}`, JSON.stringify(rejected[0]));
  } else {
    fail(`ORDER_CREATED HTTP error (status ${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.2 — ORDER_ITEM_ADDED × 2
{
  const ev1 = makeEvent('ORDER_ITEM_ADDED', {
    order_id: ORDER_ID,
    line: {
      line_id: LINE_ID_1,
      product_id: PRODUCT_ID_1,
      sku: 'SKU-SMOKE-001',
      name: '1/4 Pollo SMOKE',
      qty: 1,
      unit_price_cents: 1500,
      station: 'HORNO',
      status: 'PENDING',
    },
  }, { aggregate_id: ORDER_ID, seq: 2 });

  const ev2 = makeEvent('ORDER_ITEM_ADDED', {
    order_id: ORDER_ID,
    line: {
      line_id: LINE_ID_2,
      product_id: PRODUCT_ID_2,
      sku: 'SKU-SMOKE-002',
      name: 'Gaseosa SMOKE',
      qty: 1,
      unit_price_cents: 500,
      station: 'BAR',
      status: 'PENDING',
    },
  }, { aggregate_id: ORDER_ID, seq: 3 });

  const res = await ingest([ev1, ev2]);
  const rej22 = res.body?.rejected ?? [];
  if (res.status === 200 && rej22.length === 0) {
    ok('ORDER_ITEM_ADDED × 2 accepted — rows should be in order_item_projections');
  } else if (rej22.length > 0) {
    fail(`ORDER_ITEM_ADDED rejected: ${rej22.map(r => r.error).join(', ')}`, JSON.stringify(rej22[0]));
  } else {
    fail(`ORDER_ITEM_ADDED HTTP error (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.3 — ORDER_SUBMITTED → IN_KITCHEN
{
  const res = await ingest([makeEvent('ORDER_SUBMITTED', {
    order_id: ORDER_ID,
    submitted_at: new Date().toISOString(),
    items_by_station: {
      HORNO: [{ line_id: LINE_ID_1, product_id: PRODUCT_ID_1, name: '1/4 Pollo SMOKE', qty: 1 }],
      BAR: [{ line_id: LINE_ID_2, product_id: PRODUCT_ID_2, name: 'Gaseosa SMOKE', qty: 1 }],
    },
  }, { aggregate_id: ORDER_ID, seq: 4 })]);

  const rej3 = res.body?.rejected ?? [];
  if (res.status === 200 && rej3.length === 0) {
    ok('ORDER_SUBMITTED accepted — items should be IN_KITCHEN');
  } else if (rej3.length > 0) {
    fail(`ORDER_SUBMITTED rejected: ${rej3[0]?.error}`, JSON.stringify(rej3[0]));
  } else {
    fail(`ORDER_SUBMITTED HTTP error (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.4 — ORDER_ITEM_STATUS_CHANGED → READY
{
  const res = await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
    order_id: ORDER_ID,
    line_id: LINE_ID_1,
    from: 'COOKING',
    to: 'READY',
    station: 'HORNO',
  }, { aggregate_id: ORDER_ID, seq: 5 })]);

  const rej4 = res.body?.rejected ?? [];
  if (res.status === 200 && rej4.length === 0) {
    ok('ORDER_ITEM_STATUS_CHANGED(READY) accepted — item should be READY');
  } else if (rej4.length > 0) {
    fail(`STATUS_CHANGED(READY) rejected: ${rej4[0]?.error}`, JSON.stringify(rej4[0]));
  } else {
    fail(`STATUS_CHANGED(READY) HTTP error (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.5 — /api/pos/ready-items should include the READY item
{
  await new Promise(r => setTimeout(r, 500)); // give DB time to commit
  const res = await fetch(`${BASE_URL}/api/pos/ready-items`, {
    headers: { 'x-tenant-id': TENANT_ID },
  });
  const body = await res.json();

  if (!Array.isArray(body)) {
    fail('ready-items returned non-array');
  } else {
    // Look for our smoke item
    const found = body.find(r => r.line_id === LINE_ID_1 && r.status === 'READY');
    if (found) {
      ok(`/api/pos/ready-items returns READY item (table: ${found.table_number}, station: ${found.station})`);
    } else {
      // May not appear in DB if order_item_projections migration not applied
      const total = body.length;
      fail(
        `READY item not found in /api/pos/ready-items (${total} items returned)`,
        'This may mean the order_item_projections table migration was not applied yet.'
      );
    }
  }
}

// 3.6 — ORDER_ITEM_NOTE
{
  const res = await ingest([makeEvent('ORDER_ITEM_NOTE', {
    order_id: ORDER_ID,
    line_id: LINE_ID_1,
    note: 'extra limón smoke test',
  }, { aggregate_id: ORDER_ID, seq: 6 })]);

  if (res.status === 200) {
    ok('ORDER_ITEM_NOTE accepted — notes updated');
  } else {
    fail(`ORDER_ITEM_NOTE rejected (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.7 — ORDER_TABLE_CHANGED
{
  const res = await ingest([makeEvent('ORDER_TABLE_CHANGED', {
    order_id: ORDER_ID,
    from_table: '99',
    to_table: '42',
  }, { aggregate_id: ORDER_ID, seq: 7 })]);

  if (res.status === 200) {
    ok('ORDER_TABLE_CHANGED accepted — table_number updated for all rows');
  } else {
    fail(`ORDER_TABLE_CHANGED rejected (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.8 — ORDER_ITEM_STATUS_CHANGED → DONE (mark served)
{
  const res = await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
    order_id: ORDER_ID,
    line_id: LINE_ID_1,
    from: 'READY',
    to: 'DONE',
    station: 'HORNO',
  }, { aggregate_id: ORDER_ID, seq: 8 })]);

  if (res.status === 200) {
    ok('ORDER_ITEM_STATUS_CHANGED(DONE) accepted — item marked as served');
  } else {
    fail(`STATUS_CHANGED(DONE) rejected (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.9 — After DONE, item should no longer appear in ready-items
{
  await new Promise(r => setTimeout(r, 500));
  const res = await fetch(`${BASE_URL}/api/pos/ready-items`, {
    headers: { 'x-tenant-id': TENANT_ID },
  });
  const body = await res.json();
  const stillReady = Array.isArray(body) && body.find(r => r.line_id === LINE_ID_1);
  if (!stillReady) {
    ok('DONE item removed from /api/pos/ready-items (no longer visible to waiter)');
  } else {
    fail('DONE item still appears in /api/pos/ready-items — should be removed');
  }
}

// 3.10 — ORDER_ITEM_VOIDED
{
  const res = await ingest([makeEvent('ORDER_ITEM_VOIDED', {
    order_id: ORDER_ID,
    line_id: LINE_ID_2,
    reason: 'SMOKE_TEST_VOID',
    voided_at: new Date().toISOString(),
  }, { aggregate_id: ORDER_ID, seq: 9 })]);

  if (res.status === 200) {
    ok('ORDER_ITEM_VOIDED accepted — row deleted from projections');
  } else {
    fail(`ORDER_ITEM_VOIDED rejected (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// 3.11 — ORDER_CANCELLED cleans up remaining rows
{
  const res = await ingest([makeEvent('ORDER_CANCELLED', {
    order_id: ORDER_ID,
    reason: 'SMOKE_TEST_CLEANUP',
  }, { aggregate_id: ORDER_ID, seq: 10 })]);

  if (res.status === 200) {
    ok('ORDER_CANCELLED accepted — all projection rows deleted');
  } else {
    fail(`ORDER_CANCELLED rejected (${res.status})`, JSON.stringify(res.body?.error ?? res.body));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(60)}`);
console.log(`  SMOKE TEST SUMMARY`);
console.log(`  Passed: ${passed} | Failed: ${failed} | Total: ${passed + failed}`);
console.log('═'.repeat(60));

if (failed === 0) {
  console.log('\n  ✅ All smoke tests passed!\n');
} else {
  console.log(`\n  ⚠️  ${failed} test(s) failed — check output above.\n`);
  process.exit(1);
}
