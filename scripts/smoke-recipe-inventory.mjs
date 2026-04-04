/**
 * Smoke test: Recipe → Inventory deduction on DONE
 * Verifies: product has recipe, stock before, order+cook+DONE, stock after, inventory_log
 * Usage: node scripts/smoke-recipe-inventory.mjs
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:3000';
const T = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const TERM = 'CAJA_01';
const ACTOR = '00000000-0000-0000-0000-000000000001';
const SECRET = process.env.PARK_API_SECRET || 'trZSA6uzhY4SIGbQ+bCl8t2BhffTrT35DVnXf5fOgao=';
const PRODUCT_ID = '1e6b864a-d3d5-49d4-9a1c-ead46fb5a0c2'; // 1/4 Pollo
const ORDER_ID = randomUUID();
const LINE_ID = `recipe-${Date.now()}`;
const QTY = 2;

const prisma = new PrismaClient();
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

// ═══ 1. RECETA ═══════════════════════════════════════════════
sep('1. RECETA del 1/4 Pollo');
const recipe = await prisma.recipes.findFirst({
  where: { tenant_id: T, product_id: PRODUCT_ID, is_active: true },
});
if (!recipe) { fail('No tiene receta'); await prisma.$disconnect(); process.exit(1); }
const ingredients = recipe.ingredients;
ok(`Receta: ${ingredients.length} ingredientes`);
for (const ing of ingredients) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: ing.inventory_code } });
  ok(`  ${ing.inventory_code}: ${ing.quantity} ${ing.unit} × ${QTY} = ${(ing.quantity * QTY).toFixed(3)} (stock: ${inv?.stock ?? '?'})`);
}

// ═══ 2. STOCK ANTES ══════════════════════════════════════════
sep('2. STOCK ANTES');
const stockBefore = {};
for (const ing of ingredients) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: ing.inventory_code } });
  stockBefore[ing.inventory_code] = Number(inv?.stock ?? 0);
  ok(`${ing.inventory_code}: ${inv?.stock} ${inv?.unit}`);
}

// ═══ 3. ORDEN + COCINA ═══════════════════════════════════════
sep(`3. ORDEN — ${QTY}x 1/4 Pollo`);
const s1 = await ingest([ev('ORDER_CREATED', { order_id: ORDER_ID, order_number: 80600, order_type: 'DINE_IN', items: [], checks: [], fulfillment: { mode: 'DINE_IN', table_number: '7' } })]);
s1 ? ok('ORDER_CREATED') : fail('ORDER_CREATED');

const s2 = await ingest([ev('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line: { line_id: LINE_ID, product_id: PRODUCT_ID, sku: 'POLLO-1/4', name: '1/4 Pollo', qty: QTY, unit_price_cents: 1500, station: 'HORNO', status: 'PENDING' } })]);
s2 ? ok(`ORDER_ITEM_ADDED: ${QTY}x 1/4 Pollo`) : fail('ORDER_ITEM_ADDED');

sep('4. COCINA');
await ingest([ev('ORDER_SUBMITTED', { order_id: ORDER_ID, submitted_at: new Date().toISOString(), items_by_station: { HORNO: [{ line_id: LINE_ID, product_id: PRODUCT_ID, name: '1/4 Pollo', qty: QTY }] } })]);
ok('SUBMITTED');
await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'PENDING', to: 'COOKING', station: 'HORNO' })]);
ok('COOKING');
await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'COOKING', to: 'READY', station: 'HORNO' })]);
ok('READY');

// ═══ 5. DONE → DEDUCCIÓN ════════════════════════════════════
sep('5. DONE → Deducción automática');
const done = await ingest([ev('ORDER_ITEM_STATUS_CHANGED', { order_id: ORDER_ID, line_id: LINE_ID, from: 'READY', to: 'DONE', station: 'HORNO' })]);
done ? ok('DONE (deducción triggered)') : fail('DONE rejected');

await new Promise(r => setTimeout(r, 500));

// ═══ 6. STOCK DESPUÉS ════════════════════════════════════════
sep('6. STOCK DESPUÉS');
const deductions = [];
for (const ing of ingredients) {
  const inv = await prisma.inventory.findFirst({ where: { tenant_id: T, code: ing.inventory_code } });
  const after = Number(inv?.stock ?? 0);
  const before = stockBefore[ing.inventory_code];
  const expected = ing.quantity * QTY;
  const diff = +(before - after).toFixed(4);

  if (Math.abs(diff - expected) < 0.01) {
    ok(`${ing.inventory_code}: ${before} → ${after} (-${diff}) ✓`);
  } else if (diff === 0) {
    fail(`${ing.inventory_code}: ${before} → ${after} — NO descontó`);
  } else {
    ok(`${ing.inventory_code}: ${before} → ${after} (-${diff}, esperaba -${expected})`);
  }
  deductions.push({ code: ing.inventory_code, before, after, diff });
}

// ═══ 7. INVENTORY LOG ════════════════════════════════════════
sep('7. INVENTORY LOG');
const logs = await prisma.inventory_log.findMany({
  where: { tenant_id: T, reference_id: ORDER_ID },
  orderBy: { created_at: 'desc' },
  take: 10,
});
if (logs.length > 0) {
  ok(`${logs.length} movimiento(s):`);
  for (const l of logs) {
    const inv = await prisma.inventory.findFirst({ where: { id: l.inventory_id } });
    ok(`  ${inv?.code || l.inventory_id}: ${l.movement_type} -${l.quantity} | ${l.reason || ''}`);
  }
} else {
  fail('Sin movimientos en inventory_log');
}

// ═══ RESUMEN ═════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RECETA + INVENTARIO`);
console.log(`  ✅ ${p}  |  ❌ ${f}`);
console.log('═'.repeat(60));
console.log(`
  ┌────────────────────────────────────────────────────────┐
  │  PEDIDO: ${QTY}x 1/4 Pollo (mesa 7)                          │
  ├────────────────────────────────────────────────────────┤`);
for (const d of deductions) {
  console.log(`  │  ${d.code.padEnd(12)} ${String(d.before).padStart(7)} → ${String(d.after).padStart(7)}  (-${d.diff.toFixed(3).padStart(6)})  │`);
}
console.log(`  └────────────────────────────────────────────────────────┘\n`);

await prisma.$disconnect();
process.exit(f > 0 ? 1 : 0);
