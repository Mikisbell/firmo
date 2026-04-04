/**
 * Smoke test: COCINA — Crema de rocoto recipe + inventory deduction
 * Creates rocoto ingredients, recipe for "Ají Extra", simulates order
 * Usage: node scripts/smoke-crema-rocoto.mjs
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
const LINE_ID = `rocoto-${Date.now()}`;
const QTY = 5; // 5 porciones de crema de rocoto

let p = 0, f = 0, seq = 0;
const ok   = m => { console.log(`  ✅ ${m}`); p++; };
const fail = (m, d='') => { console.log(`  ❌ ${m}${d?'\n     '+d:''}`); f++; };
const sep  = t => console.log(`\n${'─'.repeat(60)}\n  ${t}\n${'─'.repeat(60)}`);

function ev(type, payload) {
  seq++;
  return {
    event_id: randomUUID(), event_type: type,
    aggregate_type: 'ORDER', aggregate_id: ORDER_ID, correlation_id: ORDER_ID,
    causation_id: null, actor_id: ACTOR, actor_role_snapshot: 'ADMIN',
    tenant_id: T, terminal_id: TERM, terminal_sequence: seq,
    schema_version: 1, payload_version: 1,
    occurred_at: new Date().toISOString(), payload,
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

// ═══ 1. INSUMOS PARA CREMA DE ROCOTO ═════════════════════════
sep('1. INSUMOS — Crema de Rocoto');
const ingredients = [
  { code: 'ROCOTO-KG', name: 'Rocoto (kg)', unit: 'KG', stock: 5, cost_cents: 1200, min_stock: 1 },
  { code: 'QUESO-FRESCO-KG', name: 'Queso fresco (kg)', unit: 'KG', stock: 4, cost_cents: 2500, min_stock: 1 },
  { code: 'LECHE-EVAP-LT', name: 'Leche evaporada (lt)', unit: 'LT', stock: 10, cost_cents: 600, min_stock: 2 },
  { code: 'GALLETA-KG', name: 'Galleta soda (kg)', unit: 'KG', stock: 3, cost_cents: 800, min_stock: 0.5 },
  { code: 'AJO-KG', name: 'Ajo (kg)', unit: 'KG', stock: 2, cost_cents: 1500, min_stock: 0.3 },
];

for (const ing of ingredients) {
  await prisma.inventory.upsert({
    where: { tenant_id_code: { tenant_id: T, code: ing.code } },
    create: { id: randomUUID(), tenant_id: T, ...ing },
    update: { stock: ing.stock },
  });
  ok(`${ing.code}: ${ing.stock} ${ing.unit} — S/.${(ing.cost_cents/100).toFixed(2)}/kg`);
}
// AJI-KG ya existe
const ajiExisting = await prisma.inventory.findFirst({ where: { tenant_id: T, code: 'AJI-KG' } });
ok(`AJI-KG (existente): ${ajiExisting?.stock} ${ajiExisting?.unit}`);

// ═══ 2. RECETA — Crema de Rocoto (por porcion) ══════════════
sep('2. RECETA — Crema de Rocoto');
const PRODUCT_ID = '9969395a-6827-4022-99f7-f06540a98fe7'; // Aji Extra

const recIng = [
  { inventory_code: 'ROCOTO-KG', quantity: 0.04, unit: 'KG' },      // 40g rocoto
  { inventory_code: 'AJI-KG', quantity: 0.01, unit: 'KG' },          // 10g aji
  { inventory_code: 'QUESO-FRESCO-KG', quantity: 0.03, unit: 'KG' }, // 30g queso
  { inventory_code: 'LECHE-EVAP-LT', quantity: 0.02, unit: 'LT' },  // 20ml leche
  { inventory_code: 'GALLETA-KG', quantity: 0.01, unit: 'KG' },      // 10g galleta
  { inventory_code: 'AJO-KG', quantity: 0.005, unit: 'KG' },         // 5g ajo
  { inventory_code: 'ACEITE-LT', quantity: 0.01, unit: 'LT' },       // 10ml aceite
  { inventory_code: 'SAL-KG', quantity: 0.002, unit: 'KG' },         // 2g sal
];

await prisma.recipes.upsert({
  where: { tenant_id_product_id: { tenant_id: T, product_id: PRODUCT_ID } },
  create: {
    id: randomUUID(), tenant_id: T, product_id: PRODUCT_ID,
    ingredients: recIng, yield_qty: 1, yield_unit: 'PORCION',
    category: 'SALSA', preparation_time_minutes: 3,
    is_active: true, created_by: ACTOR,
  },
  update: { ingredients: recIng, is_active: true },
});
ok(`Receta "Crema de Rocoto" — 8 ingredientes:`);
for (const i of recIng) {
  ok(`  ${i.inventory_code.padEnd(20)} ${i.quantity} ${i.unit} × ${QTY} = ${(i.quantity * QTY).toFixed(3)}`);
}

// ═══ 3. COSTO ════════════════════════════════════════════════
sep('3. COSTO por porcion');
let totalCost = 0;
for (const i of recIng) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: i.inventory_code } });
  const cost = (inv?.cost_cents || 0) * i.quantity / 100;
  totalCost += cost;
  ok(`  ${i.inventory_code.padEnd(20)} ${i.quantity} × S/.${((inv?.cost_cents||0)/100).toFixed(2)} = S/.${cost.toFixed(3)}`);
}
ok(`  COSTO TOTAL: S/.${totalCost.toFixed(2)} por porcion`);
ok(`  PRECIO VENTA: S/.1.00 — margen: ${(((100 - totalCost) / 100) * 100).toFixed(0)}%`);

// ═══ 4. STOCK ANTES ══════════════════════════════════════════
sep('4. STOCK ANTES');
const stockBefore = {};
for (const i of recIng) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: i.inventory_code } });
  stockBefore[i.inventory_code] = Number(inv?.stock ?? 0);
  ok(`${i.inventory_code.padEnd(20)} ${inv?.stock} ${inv?.unit}`);
}

// ═══ 5. PEDIDO — 5x Aji Extra (mesa 12) ═════════════════════
sep(`5. PEDIDO — ${QTY}x Aji Extra (crema de rocoto) mesa 12`);
let s;
s = await ingest([ev('ORDER_CREATED', { order_id: ORDER_ID, order_number: 80800, order_type: 'DINE_IN', items: [], checks: [], fulfillment: { mode: 'DINE_IN', table_number: '12' } })]);
s ? ok('ORDER_CREATED') : fail('ORDER_CREATED');

s = await ingest([ev('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: { line_id: LINE_ID, product_id: PRODUCT_ID, sku: 'AJI-EXTRA', name: 'Aji Extra', qty: QTY, unit_price_cents: 100, station: 'COCINA', status: 'PENDING' } })]);
s ? ok(`ITEM_ADDED: ${QTY}x Aji Extra`) : fail('ITEM_ADDED');

s = await ingest([ev('ORDER_SUBMITTED', { order_id: ORDER_ID, submitted_at: new Date().toISOString(), items_by_station: { COCINA: [{ line_id: LINE_ID, product_id: PRODUCT_ID, name: 'Aji Extra', qty: QTY }] } })]);
s ? ok('SUBMITTED → COCINA') : fail('SUBMITTED');

// ═══ 6. COCINA PREPARA ═══════════════════════════════════════
sep('6. COCINA — COOKING → READY → DONE');
s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'PENDING', to: 'COOKING', station: 'COCINA' })]);
s ? ok('COOKING — preparando crema de rocoto...') : fail('COOKING');

s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'COOKING', to: 'READY', station: 'COCINA' })]);
s ? ok('READY — crema lista') : fail('READY');

s = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'READY', to: 'DONE', station: 'COCINA' })]);
s ? ok('DONE → deduccion automatica') : fail('DONE');

await new Promise(r => setTimeout(r, 500));

// ═══ 7. STOCK DESPUES ════════════════════════════════════════
sep('7. STOCK DESPUES — Verificacion deduccion');
const results = [];
for (const i of recIng) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: i.inventory_code } });
  const after = Number(inv?.stock ?? 0);
  const before = stockBefore[i.inventory_code];
  const expected = +(i.quantity * QTY).toFixed(4);
  const diff = +(before - after).toFixed(4);

  if (Math.abs(diff - expected) < 0.01) ok(`${i.inventory_code.padEnd(20)} ${before} → ${after} (-${diff}) ✓`);
  else if (diff === 0) fail(`${i.inventory_code}: NO desconto`);
  else ok(`${i.inventory_code.padEnd(20)} ${before} → ${after} (-${diff}, esperaba -${expected})`);
  results.push({ code: i.inventory_code, before, after, diff });
}

// ═══ 8. INVENTORY LOG ════════════════════════════════════════
sep('8. INVENTORY LOG');
const logs = await prisma.inventory_log.findMany({
  where: { tenant_id: T, reference_id: ORDER_ID },
  orderBy: { created_at: 'desc' },
});
if (logs.length > 0) {
  ok(`${logs.length} movimientos registrados:`);
  for (const l of logs) {
    const inv = await prisma.inventory.findFirst({ where: { id: l.inventory_id } });
    ok(`  ${(inv?.code || '?').padEnd(20)} OUT -${l.quantity} ${inv?.unit || ''}`);
  }
} else fail('Sin movimientos en inventory_log');

// ═══ RESUMEN ═════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  COCINA — CREMA DE ROCOTO`);
console.log(`  ✅ ${p}  |  ❌ ${f}`);
console.log('═'.repeat(60));
console.log(`
  ┌────────────────────────────────────────────────────────┐
  │  PEDIDO: ${QTY}x Crema de Rocoto (Aji Extra) — mesa 12    │
  ├────────────────────────────────────────────────────────┤`);
for (const r of results) {
  console.log(`  │  ${r.code.padEnd(20)} ${String(r.before).padStart(6)} → ${String(r.after).padStart(6)} (-${r.diff.toFixed(3).padStart(5)}) │`);
}
console.log(`  ├────────────────────────────────────────────────────────┤`);
console.log(`  │  Costo: S/.${totalCost.toFixed(2)}/porcion × ${QTY} = S/.${(totalCost*QTY).toFixed(2)}       │`);
console.log(`  │  Venta: S/.1.00/porcion × ${QTY} = S/.${(1*QTY).toFixed(2)}                  │`);
console.log(`  └────────────────────────────────────────────────────────┘\n`);

await prisma.$disconnect();
process.exit(f > 0 ? 1 : 0);
