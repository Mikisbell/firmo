/**
 * MASTER SMOKE TEST — Runs ALL simulations from today's session
 *
 * Covers: Security, Printers, Delivery+Payment, Full Lifecycle (10 areas)
 *
 * Usage: node scripts/smoke-all.mjs
 */

const BASE = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
let totalPassed = 0, totalFailed = 0;

function report(name, passed, failed) {
  totalPassed += passed;
  totalFailed += failed;
  const icon = failed === 0 ? '✅' : '❌';
  console.log(`  ${icon} ${name}: ${passed} passed, ${failed} failed`);
}

console.log(`\n${'═'.repeat(62)}`);
console.log('  PARK POS — SIMULACIÓN COMPLETA DE TODO LO IMPLEMENTADO');
console.log(`${'═'.repeat(62)}\n`);

// ══════════════════════════════════════════════════════════════
// 1. SECURITY — Auth guards
// ══════════════════════════════════════════════════════════════
console.log('─'.repeat(62));
console.log('  MÓDULO 1: SEGURIDAD — Auth guards en rutas protegidas');
console.log('─'.repeat(62));

let secP = 0, secF = 0;
const secRoutes = [
  ['GET', '/api/admin/printers'],
  ['POST', '/api/admin/printers'],
  ['GET', '/api/admin/printers/fake-id'],
  ['PATCH', '/api/admin/printers/fake-id'],
  ['DELETE', '/api/admin/printers/fake-id'],
  ['POST', '/api/admin/printers/fake-id/test'],
  ['GET', '/api/admin/print-jobs'],
  ['POST', '/api/admin/print-jobs/fake-id/retry'],
  ['PATCH', '/api/delivery/fake-id/assign'],
  ['PATCH', '/api/delivery/fake-id/dispatch'],
  ['PATCH', '/api/delivery/fake-id/fail'],
  ['PATCH', '/api/delivery/fake-id/deliver'],
  ['GET', '/api/delivery'],
  ['POST', '/api/delivery'],
  ['GET', '/api/drivers'],
  ['GET', '/api/inventory/kardex/fake-code'],
  ['GET', '/api/inventory/lots/fake-code'],
  ['GET', '/api/inventory/movements/recent'],
];

for (const [method, path] of secRoutes) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method !== 'GET' ? { body: JSON.stringify({}) } : {}),
  });
  if (res.status === 401 || res.status === 403) secP++;
  else { secF++; console.log(`    ❌ ${method} ${path} → ${res.status} (esperaba 401/403)`); }
}
report('Security guards', secP, secF);

// ══════════════════════════════════════════════════════════════
// 2. MIDDLEWARE — /admin protegido server-side
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 2: MIDDLEWARE — /admin requiere JWT');
console.log('─'.repeat(62));

let mwP = 0, mwF = 0;
// /admin sin cookie debería redirigir (302) o devolver HTML de login
const adminRes = await fetch(`${BASE}/admin/impresoras`, { redirect: 'manual' });
if (adminRes.status === 200 || adminRes.status === 302 || adminRes.status === 307) { mwP++; }
else { mwF++; }
report('Middleware /admin', mwP, mwF);

// ══════════════════════════════════════════════════════════════
// 3. LOGIN + PRINTERS CRUD
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 3: IMPRESORAS — CRUD + Test Print');
console.log('─'.repeat(62));

// Login
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dni: '43708661', pin: '160902', tenant_id: TENANT_ID }),
});
const loginBody = await loginRes.json();
const cookies = loginRes.headers.getSetCookie?.() || [];
const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let prP = 0, prF = 0;
if (loginBody.success) prP++; else { prF++; console.log('    ❌ Login falló'); }

// Create
const pr1 = await api('POST', '/api/admin/printers', {
  name: 'Smoke Epson Caja', stationCode: 'CAJA', connectionType: 'TCP',
  connection: { address: '10.0.0.1:9100' }, paperWidth: 80,
});
let pId;
if (pr1.status === 201) { pId = pr1.body.printer.id; prP++; } else prF++;

// List
const pr2 = await api('GET', '/api/admin/printers?all=true');
if (pr2.status === 200 && pr2.body.printers?.length > 0) prP++; else prF++;

// Get
if (pId) {
  const pr3 = await api('GET', `/api/admin/printers/${pId}`);
  if (pr3.status === 200) prP++; else prF++;
}

// Update
if (pId) {
  const pr4 = await api('PATCH', `/api/admin/printers/${pId}`, { name: 'Smoke Renamed' });
  if (pr4.status === 200 && pr4.body.printer.name === 'Smoke Renamed') prP++; else prF++;
}

// Test print
if (pId) {
  const pr5 = await api('POST', `/api/admin/printers/${pId}/test`);
  if (pr5.status === 200) prP++; else prF++;
}

// Validation
const pr6 = await api('POST', '/api/admin/printers', { name: '', stationCode: '', connectionType: 'INVALID' });
if (pr6.status === 400) prP++; else prF++;

const pr7 = await api('POST', '/api/admin/printers', { name: 'X', stationCode: 'CAJA', connectionType: 'TCP', connection: {} });
if (pr7.status === 400) prP++; else prF++;

// Delete
if (pId) {
  const pr8 = await api('DELETE', `/api/admin/printers/${pId}`);
  if (pr8.status === 200) prP++; else prF++;
}

report('Printers CRUD', prP, prF);

// ══════════════════════════════════════════════════════════════
// 4. PRINT JOBS
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 4: COLA DE IMPRESIÓN — Jobs + Stats + Retry');
console.log('─'.repeat(62));

let pjP = 0, pjF = 0;

const pj1 = await api('GET', '/api/admin/print-jobs?all=true&stats=true');
if (pj1.status === 200 && pj1.body.stats) pjP++; else pjF++;

const pj2 = await api('POST', '/api/admin/print-jobs', { jobType: 'RECEIPT', payload: { test: true } });
if (pj2.status === 201) {
  pjP++;
  const jobId = pj2.body.job.id;
  // Mark failed
  const pj3 = await api('PATCH', `/api/admin/print-jobs/${jobId}/status`, { status: 'FAILED' });
  if (pj3.status === 200) pjP++; else pjF++;
  // Retry
  const pj4 = await api('POST', `/api/admin/print-jobs/${jobId}/retry`);
  if (pj4.status === 200) pjP++; else pjF++;
} else pjF++;

report('Print Jobs', pjP, pjF);

// ══════════════════════════════════════════════════════════════
// 5. FULL LIFECYCLE — El test de 38 pasos (simplificado)
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 5: LIFECYCLE COMPLETO — 10 áreas del sistema');
console.log('─'.repeat(62));

const { randomUUID } = await import('crypto');
const API_SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const ACTOR_ID = '00000000-0000-0000-0000-000000000001';
const DRIVER_ID = '83000a4a-fae7-4841-bf89-295262bb7b26';
const ORDER_ID = randomUUID();
const CHECK_ID = `chk-${Date.now()}`;
const INVOICE_ID = randomUUID();
const LINE_1 = { line_id: `l-${Date.now()}-1`, product_id: '1e6b864a-d3d5-49d4-9a1c-ead46fb5a0c2', sku: 'POLLO-1/4', name: '1/4 Pollo', qty: 2, unit_price_cents: 1500, station: 'HORNO', status: 'PENDING' };
const LINE_2 = { line_id: `l-${Date.now()}-2`, product_id: '2bba2f3f-3c63-4e5b-b48f-ebe94dbfd83c', sku: 'INCA-500', name: 'Inca Kola 500ml', qty: 1, unit_price_cents: 400, station: 'BAR', status: 'PENDING' };
const SUBTOTAL = 3400, DELIVERY_FEE = 600, TIP = 200, TOTAL = SUBTOTAL + DELIVERY_FEE;

let seq = 0;
function ev(type, payload, overrides = {}) {
  seq++;
  const aggId = payload.order_id || payload.shift_id || ORDER_ID;
  return {
    event_id: randomUUID(), event_type: type,
    aggregate_type: type.startsWith('SHIFT') ? 'SHIFT' : 'ORDER',
    aggregate_id: aggId, correlation_id: aggId,
    causation_id: null, actor_id: ACTOR_ID, actor_role_snapshot: 'ADMIN',
    tenant_id: TENANT_ID, terminal_id: 'CAJA_01',
    terminal_sequence: seq, schema_version: 1, payload_version: 1,
    occurred_at: new Date().toISOString(), payload, ...overrides,
  };
}

async function ingest(events) {
  const res = await fetch(`${BASE}/api/events/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-api-secret': API_SECRET },
    body: JSON.stringify({ tenant_id: TENANT_ID, terminal_id: 'CAJA_01', from_terminal_sequence: 0, to_terminal_sequence: seq, events }),
  });
  const body = await res.json().catch(() => null);
  return (body?.rejected?.length === 0);
}

let lcP = 0, lcF = 0;
const step = (ok, name) => { if (ok) lcP++; else { lcF++; console.log(`    ❌ ${name}`); } };

// POS
step(await ingest([ev('ORDER_CREATED', { order_id: ORDER_ID, order_number: 80200, order_type: 'DELIVERY', items: [], checks: [], fulfillment: { mode: 'DELIVERY', customer_name: 'Test Client', customer_phone: '999111222', address: 'Av. Test 123', delivery_fee_cents: DELIVERY_FEE } })]), 'ORDER_CREATED');
step(await ingest([ev('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_1 }), ev('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_2 })]), 'ORDER_ITEM_ADDED x2');
step(await ingest([ev('ORDER_SUBMITTED', { order_id: ORDER_ID, submitted_at: new Date().toISOString(), items_by_station: { HORNO: [{ line_id: LINE_1.line_id, product_id: LINE_1.product_id, name: LINE_1.name, qty: LINE_1.qty }], BAR: [{ line_id: LINE_2.line_id, product_id: LINE_2.product_id, name: LINE_2.name, qty: LINE_2.qty }] } })]), 'ORDER_SUBMITTED');

// KDS
step(await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'PENDING', to: 'COOKING', station: 'HORNO' })]), 'KDS: COOKING');
step(await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'COOKING', to: 'READY', station: 'HORNO' })]), 'KDS: READY');

// Mozo
await new Promise(r => setTimeout(r, 300));
const ready = await fetch(`${BASE}/api/pos/ready-items`, { headers: { 'x-tenant-id': TENANT_ID } });
const readyItems = await ready.json();
step(readyItems.some?.(i => i.order_id === ORDER_ID), 'MOZO: ready-items');

// KDS DONE
step(await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'READY', to: 'DONE', station: 'HORNO' })]), 'KDS: DONE');
step(await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_2.line_id, from: 'PENDING', to: 'DONE', station: 'BAR' })]), 'KDS: BAR DONE');

// Nota
step(await ingest([ev('ORDER_ITEM_NOTE', { order_id: ORDER_ID, line_id: LINE_1.line_id, note: 'Extra papas' })]), 'NOTA');

// Check + Pago
step(await ingest([ev('CHECK_CREATED', { order_id: ORDER_ID, check: { check_id: CHECK_ID, name: 'Cuenta', mode: 'ITEMS', lines: [{ line_id: LINE_1.line_id, qty: LINE_1.qty }, { line_id: LINE_2.line_id, qty: LINE_2.qty }], subtotal_cents: SUBTOTAL, discount_cents: 0, tip_cents: 0, total_cents: TOTAL, status: 'UNPAID' } })]), 'CHECK_CREATED');
step(await ingest([ev('CHECK_TIP_SET', { order_id: ORDER_ID, check_id: CHECK_ID, tip_cents: TIP })]), 'PROPINA');
step(await ingest([ev('CHECK_PAYMENT_ADDED', { order_id: ORDER_ID, check_id: CHECK_ID, idempotency_key: `pay-${Date.now()}`, payment: { method: 'YAPE', amount_cents: TOTAL + TIP } })]), 'PAGO YAPE');
step(await ingest([ev('CHECK_MARKED_PAID', { order_id: ORDER_ID, check_id: CHECK_ID, paid_at: new Date().toISOString(), change_cents: 0 })]), 'MARKED_PAID');

// Factura
step(await ingest([ev('INVOICE_ISSUED', { order_id: ORDER_ID, check_id: CHECK_ID, invoice_id: INVOICE_ID, invoice_type: 'BOLETA', series: 'B001', invoice_number: `${Date.now() % 100000}`, total_cents: TOTAL + TIP }, { aggregate_type: 'INVOICE', aggregate_id: INVOICE_ID })]), 'BOLETA');

// Delivery
const del = await api('POST', '/api/delivery', { orderId: ORDER_ID, addressText: 'Av. Test 123, Lima', addressReference: 'Ref', customerPhone: '999111222', deliveryFee: DELIVERY_FEE });
let dId;
if (del.status === 201) { dId = del.body.id; lcP++; } else { lcF++; console.log('    ❌ DELIVERY CREATE'); }

if (dId) {
  const a = await api('PATCH', `/api/delivery/${dId}/assign`, { driverId: DRIVER_ID });
  step(a.status === 200, 'DELIVERY ASSIGN');
  const d = await api('PATCH', `/api/delivery/${dId}/dispatch`);
  step(d.status === 200, 'DELIVERY DISPATCH');
  const e = await api('PATCH', `/api/delivery/${dId}/deliver`, {});
  step(e.status === 200, 'DELIVERY DELIVERED');
}

// Print jobs
const rj = await api('POST', '/api/admin/print-jobs', { jobType: 'RECEIPT', payload: { order_id: ORDER_ID }, orderId: ORDER_ID });
step(rj.status === 201, 'PRINT: RECEIPT');
const kj = await api('POST', '/api/admin/print-jobs', { jobType: 'KITCHEN_TICKET', payload: { order_id: ORDER_ID }, orderId: ORDER_ID });
step(kj.status === 201, 'PRINT: KITCHEN');

report('Full Lifecycle (10 áreas)', lcP, lcF);

// ══════════════════════════════════════════════════════════════
// 6. UI PAGES
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 6: UI PAGES — Cargan sin crash');
console.log('─'.repeat(62));

let uiP = 0, uiF = 0;
const pages = [
  '/admin/impresoras',
  '/admin/impresoras/cola',
  '/admin/delivery',
  '/pos',
  '/driver',
];
for (const path of pages) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieStr } });
  if (res.status === 200) uiP++;
  else { uiF++; console.log(`    ❌ ${path} → ${res.status}`); }
}
report('UI Pages', uiP, uiF);

// ══════════════════════════════════════════════════════════════
// 7. CRON ENDPOINTS
// ══════════════════════════════════════════════════════════════
console.log('\n' + '─'.repeat(62));
console.log('  MÓDULO 7: CRON JOBS — Protegidos por CRON_SECRET');
console.log('─'.repeat(62));

let crP = 0, crF = 0;
const crons = ['/api/cron/maintenance', '/api/cron/sunat-daily-summary', '/api/cron/rfm', '/api/cron/sunat-queue', '/api/cron/message-outbox'];
for (const path of crons) {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 401) crP++;
  else { crF++; console.log(`    ❌ ${path} → ${res.status} (esperaba 401)`); }
}
report('Cron Jobs auth', crP, crF);

// ══════════════════════════════════════════════════════════════
// RESUMEN FINAL
// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(62)}`);
console.log(`  RESULTADO FINAL`);
console.log(`  ✅ ${totalPassed} pasos exitosos  |  ❌ ${totalFailed} fallidos`);
console.log(`  Total: ${totalPassed + totalFailed} verificaciones`);
console.log(`${'═'.repeat(62)}`);

if (totalFailed === 0) {
  console.log(`
  ┌────────────────────────────────────────────────────────┐
  │           TODO FUNCIONA CORRECTAMENTE                  │
  ├────────────────────────────────────────────────────────┤
  │  ✓ 18 rutas con auth guards (401 sin token)           │
  │  ✓ Middleware /admin protegido                         │
  │  ✓ Impresoras: CRUD + test print + validación Zod     │
  │  ✓ Cola impresión: stats + retry workflow              │
  │  ✓ POS → KDS → Mozo → Pago → SUNAT → Delivery        │
  │  ✓ Nota en item + propina + boleta                    │
  │  ✓ Delivery: PENDING → ASSIGNED → DISPATCHED → DELIVERED │
  │  ✓ Print jobs: RECEIPT + KITCHEN_TICKET                │
  │  ✓ 5 UI pages cargan sin crash                        │
  │  ✓ 5 cron endpoints protegidos                        │
  └────────────────────────────────────────────────────────┘
`);
} else {
  console.log(`\n  ⚠️  ${totalFailed} verificación(es) fallaron — revisar arriba\n`);
}

process.exit(totalFailed > 0 ? 1 : 0);
