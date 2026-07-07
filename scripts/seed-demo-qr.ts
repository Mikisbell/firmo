/**
 * Siembra un local DEMO navegable para probar el flujo QR -> cocina en local.
 * Crea: tenant con slug, local, mesa, admin (PIN 1111) y productos.
 * Imprime los ENLACES locales listos para abrir en el navegador.
 *
 * Uso (con la app levantada en :3000):
 *   npx tsx --env-file=.env scripts/seed-demo-qr.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

const prisma = new PrismaClient();
const SALT = process.env.PIN_SALT || 'PARK_POS_2026_';
const hashPin = (pin: string) => crypto.createHash('sha256').update(SALT + pin).digest('hex');

const TID = '99999999-9999-9999-9999-999999999999'; // ID fijo del tenant demo
const SLUG = 'demo';
const BASE = 'http://localhost:3000';

async function purge() {
  await prisma.processed_events.deleteMany({ where: { tenant_id: TID } });
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: TID } });
  await prisma.events.deleteMany({ where: { tenant_id: TID } });
  await prisma.orders.deleteMany({ where: { tenant_id: TID } });
  await prisma.products.deleteMany({ where: { tenant_id: TID } });
  await prisma.tables.deleteMany({ where: { tenant_id: TID } });
  await prisma.locations.deleteMany({ where: { tenant_id: TID } });
  await prisma.employees.deleteMany({ where: { tenant_id: TID } });
  await prisma.tenant_settings.deleteMany({ where: { tenant_id: TID } });
  await prisma.tenants.deleteMany({ where: { id: TID } });
}

async function main() {
  await purge(); // demo limpio cada vez

  await prisma.tenants.create({ data: { id: TID, name: 'Pollería Demo', slug: SLUG, is_active: true, created_at: new Date(), updated_at: new Date() } });
  await prisma.tenant_settings.create({ data: { tenant_id: TID, legal_name: 'Pollería Demo S.A.C.', ruc: '20123456789', address_text: 'Av. Demo 123, Lima', timezone: 'America/Lima', currency: 'PEN' } });

  const locId = randomUUID();
  await prisma.locations.create({ data: { id: locId, tenant_id: TID, code: 'DEMO', name: 'Local Demo' } });

  const tableId = randomUUID();
  await prisma.tables.create({ data: { id: tableId, tenant_id: TID, location_id: locId, number: '1', is_active: true } });

  await prisma.employees.create({ data: { id: randomUUID(), tenant_id: TID, name: 'Admin Demo', role: 'ADMIN', pin_hash: hashPin('1111'), is_active: true } });
  await prisma.employees.create({ data: { id: randomUUID(), tenant_id: TID, name: 'Cocina Demo', role: 'KITCHEN', pin_hash: hashPin('2222'), is_active: true } });

  const prods = [
    { sku: 'DEMO-POLLO', name: 'Pollo a la Brasa', price_cents: 3500, category: 'POLLOS', station: 'PARRILLA' },
    { sku: 'DEMO-PAPAS', name: 'Papas Fritas', price_cents: 800, category: 'EXTRAS', station: 'COCINA' },
    { sku: 'DEMO-GASEOSA', name: 'Gaseosa 1L', price_cents: 600, category: 'BEBIDAS', station: 'BAR' },
  ];
  const created: any[] = [];
  for (const p of prods) {
    const id = randomUUID();
    await prisma.products.create({ data: { id, tenant_id: TID, sku: p.sku, name: p.name, short_name: p.name, price_cents: p.price_cents, category: p.category, station: p.station, type: 'SIMPLE', is_active: true, is_available: true } });
    created.push({ id, ...p });
  }

  console.log('\n================ DEMO LISTO ================');
  console.log('🔗 Portal QR del cliente (mesa 1):');
  console.log(`   ${BASE}/menu/${SLUG}/${tableId}`);
  console.log('🔗 KDS de cocina (login con PIN 2222):');
  console.log(`   ${BASE}/cocina`);
  console.log('🔗 Panel admin (login con PIN 1111):');
  console.log(`   ${BASE}/admin`);
  console.log('🔗 Estado del pedido (lo que ve el cliente):');
  console.log(`   GET ${BASE}/api/menu/${SLUG}/${tableId}/orders`);
  console.log('\n📦 Productos disponibles:');
  for (const p of created) console.log(`   • ${p.name}  S/${(p.price_cents / 100).toFixed(2)}  [${p.station}]  id=${p.id}`);
  console.log('===========================================\n');
  await prisma.$disconnect();
}

main().catch((e) => { console.error('ERROR:', e?.message || e); process.exit(1); });
