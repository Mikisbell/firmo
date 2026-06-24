/**
 * getStationMetrics — Database Integration Tests (status VIVO desde proyección)
 *
 * Demuestra la reparación de la víctima del trap [[architecture/order-item-status-trap]]:
 * `getStationMetrics` debe leer el status y los timestamps de lifecycle desde
 * `order_item_projections` (verdad VIVA), NO desde el JSON congelado `orders.items[]`.
 *
 * El JSON `orders.items[].status` queda CONGELADO en la creación (PENDING). La verdad
 * del estado (READY/COOKING) y los timestamps (submitted_at, ready_at) viven solo en
 * la proyección. Si la métrica leyera el JSON, prep_time sería siempre nulo y pending
 * estaría inflado.
 *
 * Aislado por TEST_TENANT. Cleanup tenant-scoped.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import prisma from '@/src/core/db/prisma';
import { getStationMetrics } from '../analytics.service';
import { getCurrentBusinessDate } from '@/src/core/utils/business-date';
import { v4 as uuidv4 } from 'uuid';

// ─── Fixed Test IDs ─────────────────────────────────────────────────────────
const TEST_TENANT  = 'a2000001-0000-4000-a000-000000000001';
const OTHER_TENANT = 'a2000001-0000-4000-a000-000000000002';

const businessDate = getCurrentBusinessDate();
const businessDateTime = new Date(`${businessDate}T00:00:00.000Z`);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Crea una orden con su JSON `items` CONGELADO en status PENDING (como lo hace el
 * ingest en ORDER_CREATED) y, por separado, las filas VIVAS en order_item_projections.
 */
async function seedOrderWithFrozenJson(opts: {
  tenantId: string;
  orderNumber: number;
  fulfillmentStatus: string;
  createdAt: Date;
  // El JSON queda congelado: todos PENDING con station, sin timestamps de lifecycle vivos
  frozenItems: Array<{ line_id: string; station: string }>;
  // La proyección lleva la verdad viva
  projections: Array<{
    line_id: string;
    station: string;
    status: string;
    createdAt?: Date;
    submittedAt?: Date | null;
    readyAt?: Date | null;
  }>;
}): Promise<string> {
  const orderId = uuidv4();

  // JSON congelado: status SIEMPRE PENDING, con started_cooking_at/ready_at ausentes
  const frozenJsonItems = opts.frozenItems.map((it) => ({
    line_id: it.line_id,
    product_id: uuidv4(),
    sku: 'SKU-' + it.line_id,
    name: 'Item ' + it.line_id,
    qty: 1,
    unit_price_cents: 1000,
    station: it.station,
    status: 'PENDING', // CONGELADO — el trap
  }));

  await prisma.orders.create({
    data: {
      id: orderId,
      tenant_id: opts.tenantId,
      order_number: opts.orderNumber,
      order_type: 'DINE_IN',
      terminal_id: 'TEST_TERMINAL',
      fulfillment_status: opts.fulfillmentStatus,
      business_date: businessDateTime,
      created_at: opts.createdAt,
      items: frozenJsonItems,
      checks: [],
    },
  });

  for (const p of opts.projections) {
    await prisma.order_item_projections.create({
      data: {
        tenant_id: opts.tenantId,
        order_id: orderId,
        line_id: p.line_id,
        name: 'Item ' + p.line_id,
        qty: 1,
        station: p.station,
        status: p.status,
        created_at: p.createdAt ?? opts.createdAt,
        submitted_at: p.submittedAt ?? null,
        ready_at: p.readyAt ?? null,
      },
    });
  }

  return orderId;
}

async function cleanupTenant(tenantId: string) {
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.stations.deleteMany({ where: { tenant_id: tenantId } });
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.tenants.upsert({
    where: { id: TEST_TENANT },
    update: {},
    create: { id: TEST_TENANT, name: 'Test Analytics Tenant' },
  });
  await prisma.tenants.upsert({
    where: { id: OTHER_TENANT },
    update: {},
    create: { id: OTHER_TENANT, name: 'Other Analytics Tenant' },
  });
});

beforeEach(async () => {
  await cleanupTenant(TEST_TENANT);
  await cleanupTenant(OTHER_TENANT);
  // Estación COCINA con estimado de 10 min para el cálculo de eficiencia
  await prisma.stations.create({
    data: { id: uuidv4(), tenant_id: TEST_TENANT, code: 'COCINA', name: 'Cocina', is_active: true, estimated_time: 10 },
  });
});

afterAll(async () => {
  await cleanupTenant(TEST_TENANT);
  await cleanupTenant(OTHER_TENANT);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('getStationMetrics — status VIVO desde order_item_projections', () => {
  it('un item READY en la proyección (con JSON congelado en PENDING) cuenta como completado con prep_time real', async () => {
    const created = new Date(Date.now() - 30 * 60000); // hace 30 min
    const submitted = new Date(created.getTime() + 2 * 60000);
    const ready = new Date(submitted.getTime() + 8 * 60000); // prep = 8 min

    await seedOrderWithFrozenJson({
      tenantId: TEST_TENANT,
      orderNumber: 5001,
      fulfillmentStatus: 'COOKING',
      createdAt: created,
      frozenItems: [{ line_id: 'L1', station: 'COCINA' }],
      projections: [
        { line_id: 'L1', station: 'COCINA', status: 'READY', submittedAt: submitted, readyAt: ready },
      ],
    });

    const metrics = await getStationMetrics(TEST_TENANT);
    const cocina = metrics.find((m) => m.station === 'COCINA')!;

    // Si leyera el JSON congelado (PENDING, sin ready_at): pending=1, prep=0, efficiency=100 (basura)
    // Leyendo la proyección VIVA: el item está READY -> completado, prep=8min, pending=0
    expect(cocina.pending_items).toBe(0);
    expect(cocina.avg_prep_time_minutes).toBe(8);
    // prep (8) <= estimado (10) -> on-time -> efficiency 100
    expect(cocina.efficiency).toBe(100);
  });

  it('regresión: pending cuenta items PENDING/COOKING desde la proyección, no del JSON', async () => {
    const created = new Date(Date.now() - 15 * 60000); // hace 15 min

    await seedOrderWithFrozenJson({
      tenantId: TEST_TENANT,
      orderNumber: 5002,
      fulfillmentStatus: 'COOKING',
      createdAt: created,
      frozenItems: [
        { line_id: 'A', station: 'COCINA' },
        { line_id: 'B', station: 'COCINA' },
        { line_id: 'C', station: 'COCINA' },
      ],
      projections: [
        { line_id: 'A', station: 'COCINA', status: 'PENDING' },
        { line_id: 'B', station: 'COCINA', status: 'COOKING' },
        { line_id: 'C', station: 'COCINA', status: 'READY', submittedAt: new Date(created.getTime() + 60000), readyAt: new Date(created.getTime() + 5 * 60000) },
      ],
    });

    const metrics = await getStationMetrics(TEST_TENANT);
    const cocina = metrics.find((m) => m.station === 'COCINA')!;

    // PENDING + COOKING = 2 pending; READY = 1 completado
    expect(cocina.pending_items).toBe(2);
    expect(cocina.oldest_item_minutes).toBeGreaterThanOrEqual(14);
    expect(cocina.avg_prep_time_minutes).toBe(4); // ready(5) - submitted(1) = 4 min
  });

  it('aislamiento por tenant: no cuenta items de otro tenant', async () => {
    const created = new Date(Date.now() - 10 * 60000);

    await seedOrderWithFrozenJson({
      tenantId: OTHER_TENANT,
      orderNumber: 5003,
      fulfillmentStatus: 'COOKING',
      createdAt: created,
      frozenItems: [{ line_id: 'X', station: 'COCINA' }],
      projections: [{ line_id: 'X', station: 'COCINA', status: 'PENDING' }],
    });

    const metrics = await getStationMetrics(TEST_TENANT);
    const cocina = metrics.find((m) => m.station === 'COCINA')!;

    expect(cocina.pending_items).toBe(0);
  });

  it('preserva el universo de órdenes: ignora órdenes con fulfillment_status fuera de COOKING/PARTIALLY_READY', async () => {
    const created = new Date(Date.now() - 20 * 60000);

    // Orden cerrada/servida -> fuera del universo; su item PENDING en proyección NO debe contar
    await seedOrderWithFrozenJson({
      tenantId: TEST_TENANT,
      orderNumber: 5004,
      fulfillmentStatus: 'READY', // fuera del filtro COOKING/PARTIALLY_READY
      createdAt: created,
      frozenItems: [{ line_id: 'Z', station: 'COCINA' }],
      projections: [{ line_id: 'Z', station: 'COCINA', status: 'PENDING' }],
    });

    const metrics = await getStationMetrics(TEST_TENANT);
    const cocina = metrics.find((m) => m.station === 'COCINA')!;

    expect(cocina.pending_items).toBe(0);
  });
});
