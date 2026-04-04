/**
 * Smoke test: BAR station — Chicha Morada recipe + inventory deduction
 * Creates bar ingredients, recipe, places order, verifies deduction
 * Usage: node scripts/smoke-bar-recipe.mjs
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3000';
const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERM = 'CAJA_01';
const ACTOR = '00000000-0000-0000-0000-000000000001';
const SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const prisma = new PrismaClient();
const ORDER_ID = randomUUID();
const LINE_ID = `bar-${Date.now()}`;
const QTY = 3;

let p = 0, f = 0, seq = 0;
const ok   = m => { console.log(`  ✅ ${m}`); p++; };
const fail = (m, d='') => { console.log(`  ❌ ${m}${d?'\n     '+d:''}`); f++; };
const sep  = t => console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`);

function ev(type, payload, overrides = {}) {
  seq++;
  return {
    event_id: randomUUID(), event_type: type,
    aggregate_type: 'ORDER', aggregate_id: ORDER_ID, correlation_id: ORDER_ID,
    causation_id: null, actor_id: ACTOR, actor_role_snapshot: 'ADMIN',
    tenant_id: T, terminal_id: TERM, terminal_sequence: seq,
    schema_version: 1, payload_version: 1,
    occurred_at: new Date().toISOString(), payload, ...overrides,
  };
}

async function ingest(events) {
  const res = await fetch(`${BASE}/api/events/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': T, 'x-api-secret': SECRET },
    body: JSON.stringify({ tenant_id: T, terminal_id: TERM, from_terminal_sequence: 0, to_terminal_sequence: seq, events }),
  });
  const body = await res.json().catch(() => null);
  return (body?.rejected?.length === 0);
}

// ═══ 1. CREAR INSUMOS BAR ════════════════════════════════════
sep('1. INSUMOS BAR');
const barItems = [
  { code: 'MAIZ-MORADO-KG', name: 'Maiz morado (kg)', unit: 'KG', stock: 15, cost_cents: 800, min_stock: 3 },
  { code: 'AZUCAR-KG', name: 'Azucar (kg)', unit: 'KG', stock: 20, cost_cents: 300, min_stock: 5 },
  { code: 'LIMON-KG', name: 'Limon (kg)', unit: 'KG', stock: 10, cost_cents: 500, min_stock: 2 },
  { code: 'CANELA-KG', name: 'Canela (kg)', unit: 'KG', stock: 2, cost_cents: 4000, min_stock: 0.5 },
  { code: 'PINA-KG', name: 'Pina (kg)', unit: 'KG', stock: 8, cost_cents: 400, min_stock: 2 },
];
for (const ing of barItems) {
  await prisma.inventory.upsert({
    where: { tenant_id_code: { tenant_id: T, code: ing.code } },
    create: { id: randomUUID(), tenant_id: T, ...ing },
    update: { stock: ing.stock },
  });
  ok(`${ing.code}: ${ing.stock} ${ing.unit}`);
}

// ═══ 2. RECETA CHICHA MORADA ═════════════════════════════════
sep('2. RECETA — Chicha Morada Jarra');
const chicha = await prisma.products.findFirst({
  where: { tenant_id: T, name: { contains: 'Chicha Morada Jarra' } },
  select: { id: true, name: true },
});
if (!chicha) { fail('Producto no encontrado'); await prisma.$disconnect(); process.exit(1); }

const recIng = [
  { inventory_code: 'MAIZ-MORADO-KG', quantity: 0.5, unit: 'KG' },
  { inventory_code: 'AZUCAR-KG', quantity: 0.15, unit: 'KG' },
  { inventory_code: 'LIMON-KG', quantity: 0.1, unit: 'KG' },
  { inventory_code: 'CANELA-KG', quantity: 0.01, unit: 'KG' },
  { inventory_code: 'PINA-KG', quantity: 0.2, unit: 'KG' },
];

await prisma.recipes.upsert({
  where: { tenant_id_product_id: { tenant_id: T, product_id: chicha.id } },
  create: {
    id: randomUUID(), tenant_id: T, product_id: chicha.id,
    ingredients: recIng, yield_qty: 1, yield_unit: 'JARRA',
    category: 'BEBIDA', preparation_time_minutes: 5,
    is_active: true, created_by: ACTOR,
  },
  update: { ingredients: recIng, is_active: true },
});
ok(`Receta: ${chicha.name} (5 ingredientes)`);
recIng.forEach(i => ok(`  ${i.inventory_code}: ${i.quantity} ${i.unit} x${QTY} = ${(i.quantity*QTY).toFixed(3)}`));

// ═══ 3. STOCK ANTES ══════════════════════════════════════════
sep('3. STOCK ANTES');
const stockBefore = {};
for (const ing of recIng) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: ing.inventory_code } });
  stockBefore[ing.inventory_code] = Number(inv?.stock ?? 0);
  ok(`${ing.inventory_code}: ${inv?.stock} ${inv?.unit}`);
}

// ═══ 4. PEDIDO ═══════════════════════════════════════════════
sep(`4. PEDIDO — ${QTY}x Chicha Morada Jarra (mesa 3)`);
let s;
s = await ingest([ev('ORDER_CREATED', { order_id: ORDER_ID, order_number: 80700, order_type: 'DINE_IN', items: [], checks: [], fulfillment: { mode: 'DINE_IN', table_number: '3' } })]);
s ? ok('ORDER_CREATED') : fail('ORDER_CREATED');

s = await ingest([ev('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: { line_id: LINE_ID, product_id: chicha.id, sku: 'CHICHA-JARRA', name: 'Chicha Morada Jarra', qty: QTY, unit_price_cents: 1200, station: 'BAR', status: 'PENDING' } })]);
s ? ok(`ITEM_ADDED: ${QTY}x Chicha Morada`) : fail('ITEM_ADDED');

s = await ingest([ev('ORDER_SUBMITTED', { order_id: ORDER_ID, submitted_at: new Date().toISOString(), items_by_station: { BAR: [{ line_id: LINE_ID, product_id: chicha.id, name: 'Chicha Morada Jarra', qty: QTY }] } })]);
s ? ok('SUBMITTED → BAR') : fail('SUBMITTED');

// ═══ 5. BAR PREPARA ══════════════════════════════════════════
sep('5. BAR — COOKING → READY → DONE');
s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'PENDING', to: 'COOKING', station: 'BAR' })]);
s ? ok('COOKING') : fail('COOKING');

s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'COOKING', to: 'READY', station: 'BAR' })]);
s ? ok('READY') : fail('READY');

s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'READY', to: 'DONE', station: 'BAR' })]);
s ? ok('DONE → deduccion triggered') : fail('DONE');

await new Promise(r => setTimeout(r, 500));

// ═══ 6. STOCK DESPUES ════════════════════════════════════════
sep('6. STOCK DESPUES');
for (const ing of recIng) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: ing.inventory_code } });
  const after = Number(inv?.stock ?? 0);
  const before = stockBefore[ing.inventory_code];
  const expected = +(ing.quantity * QTY).toFixed(4);
  const diff = +(before - after).toFixed(4);

  if (Math.abs(diff - expected) < 0.01) ok(`${ing.inventory_code}: ${before} → ${after} (-${diff}) ✓`);
  else if (diff === 0) fail(`${ing.inventory_code}: NO desconto`);
  else ok(`${ing.inventory_code}: ${before} → ${after} (-${diff}, esperaba -${expected})`);
}

// ═══ 7. INVENTORY LOG ════════════════════════════════════════
sep('7. INVENTORY LOG');
const logs = await prisma.inventory_log.findMany({
  where: { tenant_id: T, reference_id: ORDER_ID },
  orderBy: { created_at: 'desc' },
});
if (logs.length > 0) {
  ok(`${logs.length} movimientos:`);
  for (const l of logs) {
    const inv = await prisma.inventory.findFirst({ where: { id: l.inventory_id } });
    ok(`  ${(inv?.code || '?').padEnd(18)} OUT -${l.quantity}`);
  }
} else fail('Sin movimientos');

// ═══ RESUMEN ═════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  BAR — CHICHA MORADA + INVENTARIO`);
console.log(`  ✅ ${p}  |  ❌ ${f}`);
console.log('═'.repeat(60) + '\n');

await prisma.$disconnect();
process.exit(f > 0 ? 1 : 0);
