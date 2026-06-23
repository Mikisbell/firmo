/**
 * pos-integration — Database Integration Tests
 *
 * Foco: checkAllItemsReady(orderId)
 *
 * Demuestra el bug→fix del "trap": la función original leía el JSON CONGELADO
 * `orders.items[].status` (que nunca recibe transiciones de cocina) y por eso
 * devolvía siempre false. La versión reparada lee la proyección VIVA
 * `order_item_projections`, fuente de verdad del KDS.
 *
 * Casos:
 *  - todos los items en READY/DONE en la proyección → true
 *  - al menos uno PENDING/IN_KITCHEN → false
 *  - status CONGELADO PENDING en el JSON pero READY/DONE en la proyección → true
 *    (prueba que NO se lee del JSON)
 *  - 0 filas proyectadas → false (fail-safe documentado)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import prisma from '@/src/core/db/prisma';
import { checkAllItemsReady } from '../pos-integration';

// ─── Fixed Test IDs ───────────────────────────────────────────────────────────

const TEST_TENANT = 'f1000002-0000-4000-a000-000000000001';
const TEST_ORDER  = 'f1000002-0000-4000-a000-000000000010';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Inserta una fila en la proyección VIVA del KDS para la orden de prueba. */
async function mkProjItem(lineId: string, status: string) {
  return prisma.order_item_projections.create({
    data: {
      tenant_id: TEST_TENANT,
      order_id: TEST_ORDER,
      line_id: lineId,
      name: `Item ${lineId}`,
      qty: 1,
      station: 'KITCHEN',
      status,
    },
  });
}

async function cleanupTenant(tenantId: string) {
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.tenants.upsert({
    where: { id: TEST_TENANT },
    update: {},
    create: { id: TEST_TENANT, name: 'Test POS Integration Tenant' },
  });
  // Orden con JSON `items` CONGELADO: todos los items aparecen como PENDING.
  // Esto es lo que la versión buggy leía. La fuente de verdad real es la
  // proyección, no este JSON.
  await prisma.orders.upsert({
    where: { id: TEST_ORDER },
    update: {},
    create: {
      id: TEST_ORDER,
      tenant_id: TEST_TENANT,
      order_number: 7001,
      order_type: 'DELIVERY',
      terminal_id: 'TEST_TERMINAL',
      items: [
        { line_id: 'L1', status: 'PENDING' },
        { line_id: 'L2', status: 'PENDING' },
      ],
      checks: [],
    },
  });
});

beforeEach(async () => {
  // Proyección limpia antes de cada test (instancias frescas).
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: TEST_TENANT } });
});

afterAll(async () => {
  await cleanupTenant(TEST_TENANT);
  await prisma.tenants.deleteMany({ where: { id: TEST_TENANT } });
  await prisma.$disconnect();
});

// ─── checkAllItemsReady ────────────────────────────────────────────────────────

describe('checkAllItemsReady', () => {
  it('todos los items en READY/DONE en la proyección → true', async () => {
    await mkProjItem('L1', 'READY');
    await mkProjItem('L2', 'DONE');

    expect(await checkAllItemsReady(TEST_ORDER)).toBe(true);
  });

  it('al menos un item PENDING → false', async () => {
    await mkProjItem('L1', 'READY');
    await mkProjItem('L2', 'PENDING');

    expect(await checkAllItemsReady(TEST_ORDER)).toBe(false);
  });

  it('al menos un item IN_KITCHEN (cocinando) → false', async () => {
    await mkProjItem('L1', 'DONE');
    await mkProjItem('L2', 'IN_KITCHEN');

    expect(await checkAllItemsReady(TEST_ORDER)).toBe(false);
  });

  it('JSON `items` CONGELADO en PENDING pero proyección en READY/DONE → true (NO lee del JSON)', async () => {
    // El JSON de la orden (sembrado en beforeAll) tiene L1/L2 como PENDING.
    // La versión buggy devolvería false. La reparada lee la proyección viva:
    await mkProjItem('L1', 'READY');
    await mkProjItem('L2', 'DONE');

    // Sanity: confirmamos que el JSON sigue CONGELADO en PENDING.
    const order = await prisma.orders.findUnique({
      where: { id: TEST_ORDER },
      select: { items: true },
    });
    const frozen = order!.items as Array<{ status?: string }>;
    expect(frozen.every(i => i.status === 'PENDING')).toBe(true);

    // A pesar del JSON congelado, la fuente viva manda → true.
    expect(await checkAllItemsReady(TEST_ORDER)).toBe(true);
  });

  it('0 filas proyectadas → false (fail-safe: sin evidencia de que estén listos)', async () => {
    // beforeEach ya dejó la proyección vacía para esta orden.
    expect(await checkAllItemsReady(TEST_ORDER)).toBe(false);
  });
});
