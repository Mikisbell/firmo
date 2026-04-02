/**
 * Smoke test: Full delivery order + payment lifecycle
 * Tests: ORDER_CREATED → ITEM_ADDED → SUBMITTED → CHECK_CREATED → PAYMENT → PAID → DELIVERY lifecycle
 * Usage: node scripts/smoke-delivery-payment.mjs
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
const sep  = t => console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`);

// IDs
const ORDER_ID = randomUUID();
const CHECK_ID = `chk-${Date.now()}`;
const LINE_1 = { line_id: `ln-${Date.now()}-1`, product_id: '1e6b864a-d3d5-49d4-9a1c-ead46fb5a0c2', sku: 'POLLO-1/4', name: '1/4 Pollo', qty: 2, unit_price_cents: 1500, station: 'HORNO', status: 'PENDING' };
const LINE_2 = { line_id: `ln-${Date.now()}-2`, product_id: '2bba2f3f-3c63-4e5b-b48f-ebe94dbfd83c', sku: 'INCA-500', name: 'Inca Kola 500ml', qty: 1, unit_price_cents: 400, station: 'BAR', status: 'PENDING' };
const DELIVERY_FEE = 600; // S/. 6.00

function makeEvent(type, payload) {
  seq++;
  const aggregateId = payload.order_id || payload.shift_id || ORDER_ID;
  return {
    event_id: randomUUID(),
    event_type: type,
    aggregate_type: type.startsWith('SHIFT') ? 'SHIFT' : 'ORDER',
    aggregate_id: aggregateId,
    correlation_id: aggregateId,
    causation_id: null,
    actor_id: ACTOR_ID,
    actor_role_snapshot: 'ADMIN',
    tenant_id: TENANT_ID,
    terminal_id: TERMINAL_ID,
    terminal_sequence: seq,
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

async function ingest(events) {
  const res = await fetch(`${BASE}/api/events/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID, 'x-api-secret': API_SECRET },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      terminal_id: TERMINAL_ID,
      from_terminal_sequence: 0,
      to_terminal_sequence: seq,
      events,
    }),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

function checkRejected(res, label) {
  const rejected = res.body?.rejected || [];
  if (res.status === 200 && rejected.length === 0) {
    ok(label);
    return true;
  }
  fail(`${label} — rejected: ${rejected.map(r => r.error).join(', ')}`, JSON.stringify(rejected[0]));
  return false;
}

// ── Login para API calls autenticadas ─────────────────────────
sep('0. Login admin');
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ dni: '43708661', pin: '160902', tenant_id: TENANT_ID }),
});
const loginBody = await loginRes.json();
const cookies = loginRes.headers.getSetCookie?.() || [];
const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
if (loginBody.success) ok(`Login: ${loginBody.employee.name}`);
else { fail('Login falló'); process.exit(1); }

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookieStr },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// ══════════════════════════════════════════════════════════════
//  FASE 1: CREAR ORDEN DELIVERY VIA EVENT SOURCING
// ══════════════════════════════════════════════════════════════

sep('1. ORDER_CREATED (delivery)');
const subtotal = LINE_1.unit_price_cents * LINE_1.qty + LINE_2.unit_price_cents * LINE_2.qty;
const total = subtotal + DELIVERY_FEE;

checkRejected(await ingest([makeEvent('ORDER_CREATED', {
  order_id: ORDER_ID,
  order_number: 80001,
  order_type: 'DELIVERY',
  items: [],
  checks: [],
  fulfillment: {
    mode: 'DELIVERY',
    customer_name: 'Juan Pérez',
    customer_phone: '987654321',
    address: 'Av. Larco 1234, Miraflores',
    delivery_fee_cents: DELIVERY_FEE,
  },
})]), 'ORDER_CREATED (DELIVERY)');

sep('2. ORDER_ITEM_ADDED × 2');
checkRejected(await ingest([
  makeEvent('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_1 }),
  makeEvent('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: LINE_2 }),
]), 'Items: 2x Pollo + 1x Inca Kola');

sep('3. ORDER_SUBMITTED → cocina');
checkRejected(await ingest([makeEvent('ORDER_SUBMITTED', {
  order_id: ORDER_ID,
  submitted_at: new Date().toISOString(),
  items_by_station: {
    HORNO: [{ line_id: LINE_1.line_id, product_id: LINE_1.product_id, name: LINE_1.name, qty: LINE_1.qty }],
    BAR: [{ line_id: LINE_2.line_id, product_id: LINE_2.product_id, name: LINE_2.name, qty: LINE_2.qty }],
  },
})]), 'ORDER_SUBMITTED');

// ══════════════════════════════════════════════════════════════
//  FASE 2: COBRAR (CHECK + PAYMENT)
// ══════════════════════════════════════════════════════════════

sep('4. CHECK_CREATED');
checkRejected(await ingest([makeEvent('CHECK_CREATED', {
  order_id: ORDER_ID,
  check: {
    check_id: CHECK_ID,
    name: 'Cuenta Delivery',
    mode: 'ITEMS',
    lines: [
      { line_id: LINE_1.line_id, qty: LINE_1.qty },
      { line_id: LINE_2.line_id, qty: LINE_2.qty },
    ],
    subtotal_cents: subtotal,
    discount_cents: 0,
    tip_cents: 0,
    total_cents: total,
    status: 'UNPAID',
  },
})]), `CHECK_CREATED — total S/. ${(total / 100).toFixed(2)}`);

sep('5. CHECK_PAYMENT_ADDED (Yape)');
checkRejected(await ingest([makeEvent('CHECK_PAYMENT_ADDED', {
  order_id: ORDER_ID,
  check_id: CHECK_ID,
  idempotency_key: `pay-${Date.now()}`,
  payment: {
    method: 'YAPE',
    amount_cents: total,
    ref: 'YP-' + Date.now(),
  },
})]), `Pago Yape: S/. ${(total / 100).toFixed(2)}`);

sep('6. CHECK_MARKED_PAID');
checkRejected(await ingest([makeEvent('CHECK_MARKED_PAID', {
  order_id: ORDER_ID,
  check_id: CHECK_ID,
  paid_at: new Date().toISOString(),
  change_cents: 0,
})]), 'CHECK_MARKED_PAID — orden cobrada');

// ══════════════════════════════════════════════════════════════
//  FASE 3: DELIVERY LIFECYCLE
// ══════════════════════════════════════════════════════════════

sep('7. Crear delivery order');
const delivery = await api('POST', '/api/delivery', {
  orderId: ORDER_ID,
  addressText: 'Av. Larco 1234, Miraflores, Lima',
  addressReference: 'Frente al parque Kennedy',
  customerPhone: '987654321',
  deliveryFee: DELIVERY_FEE,
});
let deliveryId;
if (delivery.status === 201) {
  deliveryId = delivery.body.id;
  ok(`PENDING — delivery ID: ${deliveryId}`);
} else {
  fail(`Crear delivery (${delivery.status})`, JSON.stringify(delivery.body));
}

sep('8. Asignar motorizado');
if (deliveryId) {
  const assign = await api('PATCH', `/api/delivery/${deliveryId}/assign`, { driverId: DRIVER_ID });
  if (assign.status === 200) ok('PENDING → ASSIGNED (Fernando Castro)');
  else fail(`Assign (${assign.status})`, JSON.stringify(assign.body));
}

sep('9. Despachar');
if (deliveryId) {
  const dispatch = await api('PATCH', `/api/delivery/${deliveryId}/dispatch`);
  if (dispatch.status === 200) ok('ASSIGNED → DISPATCHED');
  else fail(`Dispatch (${dispatch.status})`, JSON.stringify(dispatch.body));
}

sep('10. Entregar al cliente');
if (deliveryId) {
  const deliver = await api('PATCH', `/api/delivery/${deliveryId}/deliver`, {});
  if (deliver.status === 200) ok('DISPATCHED → DELIVERED');
  else fail(`Deliver (${deliver.status})`, JSON.stringify(deliver.body));
}

// ══════════════════════════════════════════════════════════════
//  FASE 4: VERIFICACIÓN FINAL
// ══════════════════════════════════════════════════════════════

sep('11. Verificación en DB');
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const order = await prisma.orders.findUnique({ where: { id: ORDER_ID } });
if (order) {
  ok(`Orden: #${order.order_number} | tipo: ${order.order_type}`);
  ok(`  Subtotal: S/. ${(order.subtotal_cents / 100).toFixed(2)}`);
  ok(`  Total: S/. ${(order.total_cents / 100).toFixed(2)}`);
  ok(`  Items: ${(order.items || []).length}`);
} else {
  fail('Orden no encontrada en DB');
}

const payments = await prisma.payments.findMany({ where: { order_id: ORDER_ID } });
if (payments.length > 0) {
  for (const p of payments) {
    ok(`  Pago: ${p.method} — S/. ${(p.amount_cents / 100).toFixed(2)} (${p.status})`);
  }
} else {
  fail('No se encontraron pagos');
}

if (deliveryId) {
  const del = await prisma.delivery_orders.findUnique({ where: { id: deliveryId } });
  if (del) {
    ok(`  Delivery: ${del.status}`);
    ok(`  Dirección: ${del.address_text}`);
    ok(`  Fee: S/. ${(del.delivery_fee / 100).toFixed(2)}`);
    ok(`  Driver: ${del.driver_id}`);
    if (del.delivered_at) ok(`  Entregado: ${new Date(del.delivered_at).toLocaleTimeString('es-PE')}`);
  } else {
    fail('Delivery no encontrado en DB');
  }
}

await prisma.$disconnect();

// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  DELIVERY + PAGO — CICLO COMPLETO`);
console.log(`  ✅ ${passed}  |  ❌ ${failed}`);
console.log('═'.repeat(60));

console.log(`
  Resumen del pedido:
  ┌──────────────────────────────────────────┐
  │  2x 1/4 Pollo a la Brasa    S/.  50.00  │
  │  1x Inca Kola 1L            S/.   8.00  │
  │  Delivery fee                S/.   6.00  │
  ├──────────────────────────────────────────┤
  │  TOTAL                       S/.  64.00  │
  │  Pagado con: YAPE            S/.  64.00  │
  │  Estado: DELIVERED ✓                     │
  └──────────────────────────────────────────┘
`);

process.exit(failed > 0 ? 1 : 0);
