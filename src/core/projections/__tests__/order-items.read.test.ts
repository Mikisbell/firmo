/**
 * order-items.read — Database Integration Tests
 *
 * Foco: el read-model server-side ÚNICO `getItemStatuses` / `getItemStatusesForOrders`.
 *
 * CONTRATO (change remove-item-status-from-write-model, council #2179):
 *  - El status del item se resuelve LEYENDO EXCLUSIVAMENTE de
 *    `order_item_projections` (proyección VIVA del KDS).
 *  - NUNCA se fusiona con el JSON `orders.items[]` ni se usa fallback
 *    `?? item.status`. Una línea SIN fila en la proyección queda AUSENTE del
 *    Map (ausencia explícita) — el read-model no inventa un status desde el JSON.
 *  - Filtrado SIEMPRE por `tenant_id` (server-side, aislamiento multi-tenant).
 *  - El batch `getItemStatusesForOrders` evita el N+1 (una sola query).
 *
 * Aislado por TEST_TENANT. Cleanup tenant-scoped.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import prisma from '@/src/core/db/prisma';
import { getItemStatuses, getItemStatusesForOrders } from '../order-items.read';

// ─── Fixed Test IDs ───────────────────────────────────────────────────────────

const TEST_TENANT  = 'a3000003-0000-4000-a000-000000000001';
const OTHER_TENANT = 'a3000003-0000-4000-a000-000000000002';
const ORDER_A      = 'a3000003-0000-4000-a000-000000000010';
const ORDER_B      = 'a3000003-0000-4000-a000-000000000011';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Inserta una fila en la proyección VIVA del KDS. */
async function mkProjItem(
  tenantId: string,
  orderId: string,
  lineId: string,
  status: string,
  station = 'COCINA',
) {
  return prisma.order_item_projections.create({
    data: {
      tenant_id: tenantId,
      order_id: orderId,
      line_id: lineId,
      name: `Item ${lineId}`,
      qty: 1,
      station,
      status,
    },
  });
}

async function mkOrder(tenantId: string, orderId: string, items: unknown[]) {
  await prisma.orders.upsert({
    where: { id: orderId },
    update: {},
    create: {
      id: orderId,
      tenant_id: tenantId,
      order_number: Math.floor(Math.random() * 100000),
      order_type: 'DINE_IN',
      terminal_id: 'TEST_TERMINAL',
      items: items as never,
      checks: [],
    },
  });
}

async function cleanupTenant(tenantId: string) {
  // Borrar TODA proyección que referencie las órdenes de prueba, sin importar el
  // tenant de la fila: los tests de aislamiento insertan filas intrusas de
  // OTHER_TENANT apuntando a ORDER_A (de TEST_TENANT). Si no se limpian, el
  // DELETE de orders viola la FK order_item_projections_order_id_fkey.
  await prisma.order_item_projections.deleteMany({
    where: { order_id: { in: [ORDER_A, ORDER_B] } },
  });
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  for (const id of [TEST_TENANT, OTHER_TENANT]) {
    await prisma.tenants.upsert({
      where: { id },
      update: {},
      create: { id, name: `Test order-items.read ${id}` },
    });
  }
  // Órdenes con JSON `items` CONGELADO (todos PENDING). El read-model NO debe
  // leer de aquí: la verdad viva vive en la proyección.
  await mkOrder(TEST_TENANT, ORDER_A, [
    { line_id: 'L1', status: 'PENDING' },
    { line_id: 'L2', status: 'PENDING' },
    { line_id: 'L3', status: 'PENDING' }, // L3 quedará SIN fila en proyección
  ]);
  await mkOrder(TEST_TENANT, ORDER_B, [{ line_id: 'LB1', status: 'PENDING' }]);
});

beforeEach(async () => {
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: OTHER_TENANT } });
});

afterAll(async () => {
  await cleanupTenant(TEST_TENANT);
  await cleanupTenant(OTHER_TENANT);
  await prisma.tenants.deleteMany({ where: { id: { in: [TEST_TENANT, OTHER_TENANT] } } });
  await prisma.$disconnect();
});

// ─── getItemStatuses (single order) ────────────────────────────────────────────

describe('getItemStatuses', () => {
  it('devuelve un Map<line_id, ProjectedItemStatus> SOLO de la proyección', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');
    await mkProjItem(TEST_TENANT, ORDER_A, 'L2', 'IN_KITCHEN');

    const map = await getItemStatuses(prisma, TEST_TENANT, ORDER_A);

    expect(map.size).toBe(2);
    expect(map.get('L1')?.status).toBe('READY');
    expect(map.get('L2')?.status).toBe('IN_KITCHEN');
    expect(map.get('L1')?.line_id).toBe('L1');
    expect(map.get('L1')?.station).toBe('COCINA');
    expect(map.get('L1')?.updated_at).toBeInstanceOf(Date);
  });

  it('línea SIN fila en proyección → ausencia EXPLÍCITA (no en el Map), sin fallback al JSON', async () => {
    // L1 y L2 proyectados; L3 está en el JSON CONGELADO (PENDING) pero NO en la proyección.
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');
    await mkProjItem(TEST_TENANT, ORDER_A, 'L2', 'DONE');

    const map = await getItemStatuses(prisma, TEST_TENANT, ORDER_A);

    // L3 NO aparece — el read-model NO inventa status desde orders.items[].status.
    expect(map.has('L3')).toBe(false);
    expect(map.get('L3')).toBeUndefined();
    expect(map.size).toBe(2);
  });

  it('NO lee del JSON congelado: JSON en PENDING pero proyección en READY → devuelve READY', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');

    const order = await prisma.orders.findUnique({
      where: { id: ORDER_A },
      select: { items: true },
    });
    const frozen = order!.items as Array<{ line_id: string; status?: string }>;
    expect(frozen.find(i => i.line_id === 'L1')?.status).toBe('PENDING'); // sanity: JSON congelado

    const map = await getItemStatuses(prisma, TEST_TENANT, ORDER_A);
    expect(map.get('L1')?.status).toBe('READY'); // gana la proyección viva
  });

  it('aísla por tenant: filas de otro tenant para la misma orden NO se mezclan', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');
    // Fila intrusa de otro tenant con el mismo order_id/line_id pero status distinto.
    await mkProjItem(OTHER_TENANT, ORDER_A, 'LX', 'DONE');

    const map = await getItemStatuses(prisma, TEST_TENANT, ORDER_A);
    expect(map.has('LX')).toBe(false);
    expect(map.size).toBe(1);
  });

  it('orden sin filas proyectadas → Map vacío', async () => {
    const map = await getItemStatuses(prisma, TEST_TENANT, ORDER_A);
    expect(map.size).toBe(0);
  });
});

// ─── getItemStatusesForOrders (batch, evita N+1) ───────────────────────────────

describe('getItemStatusesForOrders', () => {
  it('devuelve Map<order_id, Map<line_id, ProjectedItemStatus>> en una sola pasada', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');
    await mkProjItem(TEST_TENANT, ORDER_A, 'L2', 'PENDING');
    await mkProjItem(TEST_TENANT, ORDER_B, 'LB1', 'DONE');

    const result = await getItemStatusesForOrders(prisma, TEST_TENANT, [ORDER_A, ORDER_B]);

    expect(result.get(ORDER_A)?.size).toBe(2);
    expect(result.get(ORDER_A)?.get('L1')?.status).toBe('READY');
    expect(result.get(ORDER_A)?.get('L2')?.status).toBe('PENDING');
    expect(result.get(ORDER_B)?.get('LB1')?.status).toBe('DONE');
  });

  it('orden sin filas → ausente del Map externo (ausencia explícita)', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');

    const result = await getItemStatusesForOrders(prisma, TEST_TENANT, [ORDER_A, ORDER_B]);

    expect(result.has(ORDER_A)).toBe(true);
    expect(result.has(ORDER_B)).toBe(false); // ORDER_B sin proyección → ausente
  });

  it('lista de orderIds vacía → Map vacío (sin query)', async () => {
    const result = await getItemStatusesForOrders(prisma, TEST_TENANT, []);
    expect(result.size).toBe(0);
  });

  it('aísla por tenant en el batch', async () => {
    await mkProjItem(TEST_TENANT, ORDER_A, 'L1', 'READY');
    await mkProjItem(OTHER_TENANT, ORDER_A, 'LX', 'DONE');

    const result = await getItemStatusesForOrders(prisma, TEST_TENANT, [ORDER_A]);
    const inner = result.get(ORDER_A);
    expect(inner?.has('LX')).toBe(false);
    expect(inner?.size).toBe(1);
  });
});
