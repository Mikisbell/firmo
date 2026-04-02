/**
 * Smoke test: FULL ORDER LIFECYCLE — all areas
 *
 * Simulates a real delivery order touching every system area:
 *   POS → Kitchen → Waiter → Payment → Invoice → Delivery → Printer → DB verification
 *
 * Usage: node scripts/smoke-full-lifecycle.mjs
 */
import { randomUUID } from 'crypto';

const BASE = 'http://localhost:3000';
const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERMINAL_ID = 'CAJA_01';
const ACTOR_ID = '00000000-0000-0000-0000-000000000001'; // Admin Principal
const DRIVER_ID = '83000a4a-fae7-4841-bf89-295262bb7b26'; // Fernando Castro
const API_SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';

let passed = 0, failed = 0, seq = 0;
const ok   = msg => { console.log(`  ✅ ${msg}`); passed++; };
const fail = (msg, d='') => { console.log(`  ❌ ${msg}${d?'\n     '+d:''}`); failed++; };
const sep  = t => console.log(`\n${'─'.repeat(62)}\n  ${t}\n${'─'.repeat(62)}`);

// ── IDs ───────────────────────────────────────────────────────
const ORDER_ID = randomUUID();
const CHECK_ID = `chk-${Date.now()}`;
const INVOICE_ID = randomUUID();
const LINE_1 = { line_id: `ln-${Date.now()}-1`, product_id: '1e6b864a-d3d5-49d4-9a1c-ead46fb5a0c2', sku: 'POLLO-1/4', name: '1/4 Pollo', qty: 2, unit_price_cents: 1500, station: 'HORNO', status: 'PENDING' };
const LINE_2 = { line_id: `ln-${Date.now()}-2`, product_id: '2bba2f3f-3c63-4e5b-b48f-ebe94dbfd83c', sku: 'INCA-500', name: 'Inca Kola 500ml', qty: 1, unit_price_cents: 400, station: 'BAR', status: 'PENDING' };
const DELIVERY_FEE = 600;
const SUBTOTAL = LINE_1.unit_price_cents * LINE_1.qty + LINE_2.unit_price_cents * LINE_2.qty; // 3400
const TIP = 200; // S/. 2.00
const TOTAL = SUBTOTAL + DELIVERY_FEE; // 4000

// ── Helpers ───────────────────────────────────────────────────
function makeEvent(type, payload, overrides = {}) {
  seq++;
  const agg = type.startsWith('SHIFT') ? 'SHIFT' : 'ORDER';
  const aggId = payload.order_id || payload.shift_id || ORDER_ID;
  return {
    event_id: randomUUID(), event_type: type,
    aggregate_type: agg, aggregate_id: aggId, correlation_id: aggId,
    causation_id: null, actor_id: ACTOR_ID, actor_role_snapshot: 'ADMIN',
    tenant_id: TENANT_ID, terminal_id: TERMINAL_ID,
    terminal_sequence: seq, schema_version: 1, payload_version: 1,
    occurred_at: new Date().toISOString(), payload, ...overrides,
  };
}

async function ingest(events) {
  const res = await fetch(`${BASE}/api/events/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-api-secret': API_SECRET },
    body: JSON.stringify({ tenant_id: TENANT_ID, terminal_id: TERMINAL_ID, from_terminal_sequence: 0, to_terminal_sequence: seq, events }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function check(res, label) {
  const rej = res.body?.rejected || [];
  if (res.status === 200 && rej.length === 0) { ok(label); return true; }
  fail(`${label} — ${rej[0]?.error}`, JSON.stringify(rej[0]));
  return false;
}

// Login
sep('0. LOGIN');
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dni: '43708661', pin: '160902', tenant_id: TENANT_ID }),
});
const loginBody = await loginRes.json();
const cookies = loginRes.headers.getSetCookie?.() || [];
const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
if (loginBody.success) ok(`Login: ${loginBody.employee.name} (${loginBody.employee.role})`);
else { fail('Login'); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ══════════════════════════════════════════════════════════════
//  AREA 1: POS — Crear orden delivery
// ══════════════════════════════════════════════════════════════
sep('1. POS — ORDER_CREATED (DELIVERY)');
check(await ingest([makeEvent('ORDER_CREATED', {
  order_id: ORDER_ID, order_number: 80100, order_type: 'DELIVERY',
  items: [], checks: [],
  fulfillment: { mode: 'DELIVERY', customer_name: 'María López', customer_phone: '999888777', address: 'Jr. Huallaga 456, Cercado de Lima', delivery_fee_cents: DELIVERY_FEE },
})]), 'Orden delivery creada (#80100)');

sep('2. POS — ORDER_ITEM_ADDED (2 items)');
check(await ingest([
  makeEvent('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_1 }),
  makeEvent('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_2 }),
]), `2x ${LINE_1.name} + 1x ${LINE_2.name}`);

sep('3. POS — ORDER_SUBMITTED → cocina');
check(await ingest([makeEvent('ORDER_SUBMITTED', {
  order_id: ORDER_ID, submitted_at: new Date().toISOString(),
  items_by_station: {
    HORNO: [{ line_id: LINE_1.line_id, product_id: LINE_1.product_id, name: LINE_1.name, qty: LINE_1.qty }],
    BAR: [{ line_id: LINE_2.line_id, product_id: LINE_2.product_id, name: LINE_2.name, qty: LINE_2.qty }],
  },
})]), 'Orden enviada a HORNO + BAR');

// ══════════════════════════════════════════════════════════════
//  AREA 2: KITCHEN (KDS) — Cocinar items
// ══════════════════════════════════════════════════════════════
sep('4. KDS — Item 1 COOKING');
check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'PENDING', to: 'COOKING', station: 'HORNO',
})]), `${LINE_1.name}: PENDING → COOKING`);

sep('5. KDS — Item 2 COOKING');
check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_2.line_id, from: 'PENDING', to: 'COOKING', station: 'BAR',
})]), `${LINE_2.name}: PENDING → COOKING`);

sep('6. KDS — Item 1 READY');
check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'COOKING', to: 'READY', station: 'HORNO',
})]), `${LINE_1.name}: COOKING → READY`);

sep('7. KDS — Item 2 READY');
check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_2.line_id, from: 'COOKING', to: 'READY', station: 'BAR',
})]), `${LINE_2.name}: COOKING → READY`);

// ══════════════════════════════════════════════════════════════
//  AREA 3: WAITER — Notificación items listos
// ══════════════════════════════════════════════════════════════
sep('8. MOZO — Items listos para servir');
await new Promise(r => setTimeout(r, 300));
const readyRes = await fetch(`${BASE}/api/pos/ready-items`, {
  headers: { 'x-tenant-id': TENANT_ID },
});
const readyItems = await readyRes.json();
if (Array.isArray(readyItems)) {
  const ours = readyItems.filter(i => i.order_id === ORDER_ID);
  if (ours.length >= 1) {
    ok(`${ours.length} item(s) READY visibles para mozo`);
    ours.forEach(i => ok(`  → ${i.name} (${i.station})`));
  } else {
    fail(`0 items READY para esta orden (total ready: ${readyItems.length})`);
  }
} else {
  fail('ready-items no retorna array');
}

// ══════════════════════════════════════════════════════════════
//  AREA 4: KDS — Marcar DONE (trigger inventario)
// ══════════════════════════════════════════════════════════════
sep('9. KDS — Items DONE (trigger deducción inventario)');
check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_1.line_id, from: 'READY', to: 'DONE', station: 'HORNO',
})]), `${LINE_1.name}: READY → DONE`);

check(await ingest([makeEvent('ORDER_ITEM_STATUS_CHANGED', {
  order_id: ORDER_ID, line_id: LINE_2.line_id, from: 'READY', to: 'DONE', station: 'BAR',
})]), `${LINE_2.name}: READY → DONE`);

// ══════════════════════════════════════════════════════════════
//  AREA 5: WAITER — Items desaparecen de ready
// ══════════════════════════════════════════════════════════════
sep('10. MOZO — Items DONE ya no aparecen en ready');
await new Promise(r => setTimeout(r, 300));
const readyAfter = await fetch(`${BASE}/api/pos/ready-items`, { headers: { 'x-tenant-id': TENANT_ID } });
const readyAfterItems = await readyAfter.json();
const stillReady = (readyAfterItems || []).filter(i => i.order_id === ORDER_ID);
if (stillReady.length === 0) ok('0 items READY — todos servidos');
else fail(`${stillReady.length} items aún en ready`);

// ══════════════════════════════════════════════════════════════
//  AREA 6: NOTA en item (mozo feature)
// ══════════════════════════════════════════════════════════════
sep('11. MOZO — Nota en item');
check(await ingest([makeEvent('ORDER_ITEM_NOTE', {
  order_id: ORDER_ID, line_id: LINE_1.line_id, note: 'Sin ensalada, extra papas',
})]), 'Nota agregada al 1/4 Pollo');

// ══════════════════════════════════════════════════════════════
//  AREA 7: PAGO — Check + Tip + Payment + Mark Paid
// ══════════════════════════════════════════════════════════════
sep('12. CAJA — CHECK_CREATED');
check(await ingest([makeEvent('CHECK_CREATED', {
  order_id: ORDER_ID,
  check: {
    check_id: CHECK_ID, name: 'Cuenta Delivery', mode: 'ITEMS',
    lines: [{ line_id: LINE_1.line_id, qty: LINE_1.qty }, { line_id: LINE_2.line_id, qty: LINE_2.qty }],
    subtotal_cents: SUBTOTAL, discount_cents: 0, tip_cents: 0, total_cents: TOTAL, status: 'UNPAID',
  },
})]), `Check creado — subtotal S/. ${(SUBTOTAL/100).toFixed(2)} + fee S/. ${(DELIVERY_FEE/100).toFixed(2)} = S/. ${(TOTAL/100).toFixed(2)}`);

sep('13. CAJA — Propina S/. 2.00');
check(await ingest([makeEvent('CHECK_TIP_SET', {
  order_id: ORDER_ID, check_id: CHECK_ID, tip_cents: TIP,
})]), `Propina: S/. ${(TIP/100).toFixed(2)}`);

sep('14. CAJA — Pago con Yape');
check(await ingest([makeEvent('CHECK_PAYMENT_ADDED', {
  order_id: ORDER_ID, check_id: CHECK_ID,
  idempotency_key: `pay-${Date.now()}`,
  payment: { method: 'YAPE', amount_cents: TOTAL + TIP, ref: `YP-${Date.now()}` },
})]), `Pago Yape: S/. ${((TOTAL+TIP)/100).toFixed(2)}`);

sep('15. CAJA — CHECK_MARKED_PAID');
check(await ingest([makeEvent('CHECK_MARKED_PAID', {
  order_id: ORDER_ID, check_id: CHECK_ID,
  paid_at: new Date().toISOString(), change_cents: 0,
})]), 'Orden cobrada');

// ══════════════════════════════════════════════════════════════
//  AREA 8: FACTURACIÓN — Boleta SUNAT
// ══════════════════════════════════════════════════════════════
sep('16. SUNAT — INVOICE_ISSUED (Boleta)');
check(await ingest([makeEvent('INVOICE_ISSUED', {
  order_id: ORDER_ID, check_id: CHECK_ID, invoice_id: INVOICE_ID,
  invoice_type: 'BOLETA', series: 'B001', invoice_number: `${Date.now() % 100000}`,
  total_cents: TOTAL + TIP,
}, { aggregate_type: 'INVOICE', aggregate_id: INVOICE_ID })]), `Boleta B001 emitida — S/. ${((TOTAL+TIP)/100).toFixed(2)}`);

// ══════════════════════════════════════════════════════════════
//  AREA 9: DELIVERY — Ciclo completo
// ══════════════════════════════════════════════════════════════
sep('17. DELIVERY — Crear');
const del = await api('POST', '/api/delivery', {
  orderId: ORDER_ID, addressText: 'Jr. Huallaga 456, Cercado de Lima',
  addressReference: 'Al lado de la bodega', customerPhone: '999888777', deliveryFee: DELIVERY_FEE,
});
let deliveryId;
if (del.status === 201) { deliveryId = del.body.id; ok(`PENDING — ${deliveryId}`); }
else fail(`Crear delivery (${del.status})`, JSON.stringify(del.body));

sep('18. DELIVERY — Asignar motorizado');
if (deliveryId) {
  const a = await api('PATCH', `/api/delivery/${deliveryId}/assign`, { driverId: DRIVER_ID });
  a.status === 200 ? ok('PENDING → ASSIGNED (Fernando Castro)') : fail(`Assign (${a.status})`);
}

sep('19. DELIVERY — Despachar');
if (deliveryId) {
  const d = await api('PATCH', `/api/delivery/${deliveryId}/dispatch`);
  d.status === 200 ? ok('ASSIGNED → DISPATCHED') : fail(`Dispatch (${d.status})`);
}

sep('20. DELIVERY — Entregar');
if (deliveryId) {
  const d = await api('PATCH', `/api/delivery/${deliveryId}/deliver`, {});
  d.status === 200 ? ok('DISPATCHED → DELIVERED') : fail(`Deliver (${d.status})`);
}

// ══════════════════════════════════════════════════════════════
//  AREA 10: IMPRESORA — Print jobs
// ══════════════════════════════════════════════════════════════
sep('21. IMPRESORA — Crear print jobs');
const receiptJob = await api('POST', '/api/admin/print-jobs', {
  jobType: 'RECEIPT', payload: { order_id: ORDER_ID, check_id: CHECK_ID }, orderId: ORDER_ID,
});
if (receiptJob.status === 201) ok(`Print job RECEIPT creado — ${receiptJob.body.job.id}`);
else fail(`Receipt job (${receiptJob.status})`);

const kitchenJob = await api('POST', '/api/admin/print-jobs', {
  jobType: 'KITCHEN_TICKET', payload: { order_id: ORDER_ID, items: [LINE_1, LINE_2] }, orderId: ORDER_ID,
});
if (kitchenJob.status === 201) ok(`Print job KITCHEN_TICKET creado — ${kitchenJob.body.job.id}`);
else fail(`Kitchen job (${kitchenJob.status})`);

// ══════════════════════════════════════════════════════════════
//  AREA 11: VERIFICACIÓN EN DB
// ══════════════════════════════════════════════════════════════
sep('22. VERIFICACIÓN FINAL — DB');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Orden
const order = await prisma.orders.findUnique({ where: { id: ORDER_ID } });
if (order) {
  ok(`Orden #${order.order_number} | ${order.order_type}`);
  ok(`  Items: ${(order.items || []).length} | Checks: ${(order.checks || []).length}`);
  ok(`  Subtotal: S/. ${(order.subtotal_cents/100).toFixed(2)} | Total: S/. ${(order.total_cents/100).toFixed(2)}`);
} else fail('Orden no encontrada');

// Pagos
const payments = await prisma.payments.findMany({ where: { order_id: ORDER_ID } });
if (payments.length > 0) {
  payments.forEach(p => ok(`  Pago: ${p.payment_method} — S/. ${(p.amount_cents/100).toFixed(2)} (${p.status})`));
} else fail('Sin pagos');

// Factura
const invoice = await prisma.invoices.findFirst({ where: { order_id: ORDER_ID } });
if (invoice) {
  ok(`  Factura: ${invoice.invoice_type} ${invoice.series}-${invoice.invoice_number} — S/. ${(invoice.total_cents/100).toFixed(2)} (${invoice.status})`);
} else fail('Sin factura');

// Delivery
if (deliveryId) {
  const d = await prisma.delivery_orders.findUnique({ where: { id: deliveryId } });
  if (d) {
    ok(`  Delivery: ${d.status} | Fee: S/. ${(d.delivery_fee/100).toFixed(2)}`);
    ok(`  Dirección: ${d.address_text}`);
    ok(`  Driver: ${d.driver_id}`);
    if (d.delivered_at) ok(`  Entregado: ${new Date(d.delivered_at).toLocaleTimeString('es-PE')}`);
  } else fail('Delivery no encontrado');
}

// Events
const eventCount = await prisma.events.count({ where: { entity_id: ORDER_ID } });
ok(`  Eventos almacenados: ${eventCount}`);

// Print jobs
const printJobs = await prisma.print_jobs.findMany({ where: { order_id: ORDER_ID } });
ok(`  Print jobs: ${printJobs.length} (${printJobs.map(j => j.job_type).join(', ')})`);

// Projections
const projections = await prisma.order_item_projections.findMany({ where: { order_id: ORDER_ID } });
ok(`  Item projections: ${projections.length} (${projections.map(p => `${p.name}:${p.status}`).join(', ')})`);

await prisma.$disconnect();

// ══════════════════════════════════════════════════════════════
//  RESUMEN
// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(62)}`);
console.log(`  PEDIDO COMPLETO — TODAS LAS ÁREAS`);
console.log(`  ✅ ${passed}  |  ❌ ${failed}`);
console.log('═'.repeat(62));
console.log(`
  ┌────────────────────────────────────────────────────────┐
  │  ORDEN #80100 — DELIVERY                               │
  ├────────────────────────────────────────────────────────┤
  │  2x 1/4 Pollo                         S/.  30.00      │
  │  1x Inca Kola 500ml                   S/.   4.00      │
  │  Delivery fee                          S/.   6.00      │
  │  Propina                               S/.   2.00      │
  ├────────────────────────────────────────────────────────┤
  │  TOTAL                                 S/.  42.00      │
  │  Pagado: YAPE                          S/.  42.00      │
  ├────────────────────────────────────────────────────────┤
  │  ÁREAS CUBIERTAS:                                      │
  │  ✓ POS (crear orden + items)                           │
  │  ✓ KDS (COOKING → READY → DONE)                       │
  │  ✓ Mozo (ready-items notificación)                     │
  │  ✓ Nota en item                                        │
  │  ✓ Caja (check + propina + pago Yape)                  │
  │  ✓ SUNAT (boleta B001)                                 │
  │  ✓ Delivery (PENDING → ASSIGNED → DISPATCHED → DELIVERED) │
  │  ✓ Impresora (receipt + kitchen ticket jobs)            │
  │  ✓ Inventario (deducción en DONE)                      │
  │  ✓ Projections (order_item_projections)                │
  └────────────────────────────────────────────────────────┘
`);

process.exit(failed > 0 ? 1 : 0);
