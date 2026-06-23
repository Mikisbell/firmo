/**
 * Regresión: el portal del cliente (/api/menu/[slug]/[tableId]/orders) debe
 * mostrar el estado VIVO de cada item (order_item_projections, lo que actualiza
 * la cocina), NO el status inicial del JSON orders.items.
 *
 * Bug: el endpoint leía `order.items[].status` (JSON, congelado en el estado de
 * creación) → el cliente nunca veía READY/DONE aunque la cocina marcara el plato
 * listo. Fix: leer el status desde order_item_projections.
 *
 * Corre contra la DB real. Limpia por tenant_id de prueba (NUNCA deleteMany({})).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { GET } from '@/src/app/api/menu/[tenantSlug]/[tableId]/orders/route';

const TENANT = randomUUID();
const SLUG = `menu-test-${TENANT.slice(0, 8)}`;
const LOCATION = randomUUID();
const TABLE = randomUUID();
const ORDER = randomUUID();
const LINE = 'line-ready-1';

describe('Portal cliente: status del item desde la proyección viva', () => {
  beforeAll(async () => {
    await prisma.tenants.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Tenant Menu', slug: SLUG },
      update: { slug: SLUG },
    });
    await prisma.locations.create({
      data: { id: LOCATION, tenant_id: TENANT, code: 'MAIN', name: 'Principal' },
    });
    await prisma.tables.create({
      data: { id: TABLE, tenant_id: TENANT, location_id: LOCATION, number: '1', is_active: true },
    });
    await prisma.orders.create({
      data: {
        id: ORDER,
        tenant_id: TENANT,
        table_id: TABLE,
        order_number: 1,
        order_type: 'DINE_IN',
        terminal_id: 'T-MENU',
        order_status: 'OPEN',
        total_cents: 2500,
        // El JSON guarda el item con su estado INICIAL (PENDING).
        items: [
          { line_id: LINE, name: 'Pollo a la brasa', qty: 1, unit_price_cents: 2500, line_total_cents: 2500, status: 'PENDING' },
        ],
        checks: [],
        created_at: new Date(),
      },
    });
    // La cocina marcó el item READY: eso vive en la proyección, NO en orders.items.
    await prisma.order_item_projections.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT,
        order_id: ORDER,
        line_id: LINE,
        name: 'Pollo a la brasa',
        station: 'PARRILLA',
        qty: 1,
        status: 'READY',
      },
    });
  });

  afterAll(async () => {
    await prisma.order_item_projections.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.orders.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.tables.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.locations.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.tenants.deleteMany({ where: { id: TENANT } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('el cliente ve READY (proyección), no el PENDING stale del JSON', async () => {
    const req = new NextRequest(`http://localhost/api/menu/${SLUG}/${TABLE}/orders`);
    const res = await GET(req, { params: Promise.resolve({ tenantSlug: SLUG, tableId: TABLE }) });
    expect(res.status).toBe(200);

    const body = await res.json();
    const item = body.orders?.[0]?.items?.find((i: { name: string }) => i.name === 'Pollo a la brasa');
    expect(item).toBeDefined();
    expect(item.status).toBe('READY'); // antes (bug): 'PENDING'
  });
});
