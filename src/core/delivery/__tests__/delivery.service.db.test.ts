/**
 * DeliveryService — Database Integration Tests
 *
 * Tests the full state machine (PENDING → ASSIGNED → DISPATCHED → DELIVERED/FAILED)
 * against a real PostgreSQL database. Each test scope is isolated by TEST_TENANT_ID.
 *
 * Coverage:
 * - createDeliveryOrder()
 * - assignDriver(): PENDING→ASSIGNED, tenant isolation, driver availability
 * - markDispatched(): ASSIGNED→DISPATCHED, invalid transitions
 * - markDelivered(): DISPATCHED→DELIVERED, delivery_time_mins calculation
 * - markFailed(): reason validation, valid from ASSIGNED and DISPATCHED
 * - getByStatus(): tenant isolation, multi-status filtering
 * - getDriverDeliveries(): returns only active deliveries
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as fc from 'fast-check';
import prisma from '@/src/core/db/prisma';
import { DeliveryService } from '../delivery.service';
import { v4 as uuidv4 } from 'uuid';
import { asCentavos } from '@/src/core/types/shared';

// ─── Fixed Test IDs ───────────────────────────────────────────────────────────

const TEST_TENANT  = 'f1000001-0000-4000-a000-000000000001';
const OTHER_TENANT = 'f1000001-0000-4000-a000-000000000002';
const TEST_ORDER   = 'f1000001-0000-4000-a000-000000000010';
const TEST_ORDER_2 = 'f1000001-0000-4000-a000-000000000011';

const BASE_DELIVERY = {
  tenantId:      TEST_TENANT,
  orderId:       TEST_ORDER,
  addressText:   'Av. Javier Prado Este 4200, Santiago de Surco',
  customerPhone: '987654321',
  deliveryFee:   asCentavos(800), // S/8.00 en centavos
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a fresh active driver scoped to TEST_TENANT. Each test should use
 *  its own driver to avoid "already has active delivery" conflicts. */
async function mkDriver(name = 'Test Driver') {
  return prisma.drivers.create({
    data: { id: uuidv4(), tenant_id: TEST_TENANT, name, is_active: true },
  });
}

async function cleanupTenant(tenantId: string) {
  await prisma.delivery_orders.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.drivers.deleteMany({ where: { tenant_id: tenantId } });
  await prisma.orders.deleteMany({ where: { tenant_id: tenantId } });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.tenants.upsert({
    where: { id: TEST_TENANT },
    update: {},
    create: { id: TEST_TENANT, name: 'Test Delivery Tenant' },
  });
  await prisma.tenants.upsert({
    where: { id: OTHER_TENANT },
    update: {},
    create: { id: OTHER_TENANT, name: 'Other Tenant' },
  });
  // Fixed orders — reused across tests
  await prisma.orders.upsert({
    where: { id: TEST_ORDER },
    update: {},
    create: { id: TEST_ORDER, tenant_id: TEST_TENANT, order_number: 9001, order_type: 'DELIVERY', terminal_id: 'TEST_TERMINAL', items: [], checks: [] },
  });
  await prisma.orders.upsert({
    where: { id: TEST_ORDER_2 },
    update: {},
    create: { id: TEST_ORDER_2, tenant_id: TEST_TENANT, order_number: 9002, order_type: 'DELIVERY', terminal_id: 'TEST_TERMINAL', items: [], checks: [] },
  });
});

beforeEach(async () => {
  // Delete delivery_orders first (FK dependency), then drivers
  await prisma.delivery_orders.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.delivery_orders.deleteMany({ where: { tenant_id: OTHER_TENANT } });
  await prisma.drivers.deleteMany({ where: { tenant_id: TEST_TENANT } });
});

afterAll(async () => {
  await cleanupTenant(TEST_TENANT);
  await cleanupTenant(OTHER_TENANT);
  await prisma.tenants.deleteMany({ where: { id: { in: [TEST_TENANT, OTHER_TENANT] } } });
  await prisma.$disconnect();
});

// ─── createDeliveryOrder ─────────────────────────────────────────────────────

describe('DeliveryService.createDeliveryOrder', () => {
  it('crea en estado PENDING con los campos correctos', async () => {
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    expect(delivery.status).toBe('PENDING');
    expect(delivery.tenant_id).toBe(TEST_TENANT);
    expect(delivery.order_id).toBe(TEST_ORDER);
    expect(delivery.address_text).toBe(BASE_DELIVERY.addressText);
    expect(delivery.customer_phone).toBe(BASE_DELIVERY.customerPhone);
    expect(delivery.delivery_fee).toBe(800);
    expect(delivery.driver_id).toBeNull();
    expect(delivery.assigned_at).toBeNull();
    expect(delivery.id).toBeTruthy();
  });

  it('persiste en la base de datos', async () => {
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    const record = await prisma.delivery_orders.findUnique({ where: { id: delivery.id } });

    expect(record).not.toBeNull();
    expect(record!.status).toBe('PENDING');
    expect(record!.delivery_fee).toBe(800);
  });

  it('guarda address_reference cuando se provee', async () => {
    const delivery = await DeliveryService.createDeliveryOrder({
      ...BASE_DELIVERY,
      orderId: TEST_ORDER_2,
      addressReference: 'Frente al parque',
    });

    expect(delivery.address_reference).toBe('Frente al parque');
  });

  it('property: fee siempre se almacena sin modificacion (centavos)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10000 }),
        async (fee) => {
          const d = await DeliveryService.createDeliveryOrder({
            ...BASE_DELIVERY,
            deliveryFee: asCentavos(fee),
          });
          expect(d.delivery_fee).toBe(fee);
          await prisma.delivery_orders.delete({ where: { id: d.id } });
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── assignDriver ─────────────────────────────────────────────────────────────

describe('DeliveryService.assignDriver', () => {
  it('PENDING → ASSIGNED: asigna driver y fija assigned_at', async () => {
    const driver = await mkDriver('Assign Test 1');
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    const before = new Date();

    const updated = await DeliveryService.assignDriver(delivery.id, driver.id);

    expect(updated.status).toBe('ASSIGNED');
    expect(updated.driver_id).toBe(driver.id);
    expect(updated.assigned_at).toBeInstanceOf(Date);
    expect(updated.assigned_at!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('lanza INVALID_TRANSITION si el delivery no está en PENDING', async () => {
    const driver1 = await mkDriver('Assign Test 2a');
    const driver2 = await mkDriver('Assign Test 2b');
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(delivery.id, driver1.id);

    await expect(
      DeliveryService.assignDriver(delivery.id, driver2.id)
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('lanza NOT_FOUND si el delivery no existe', async () => {
    await expect(
      DeliveryService.assignDriver(uuidv4(), uuidv4())
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('lanza DRIVER_NOT_FOUND si el driver pertenece a otro tenant', async () => {
    const otherDriver = await prisma.drivers.create({
      data: { id: uuidv4(), tenant_id: OTHER_TENANT, name: 'Other Driver', is_active: true },
    });
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    await expect(
      DeliveryService.assignDriver(delivery.id, otherDriver.id)
    ).rejects.toMatchObject({ code: 'DRIVER_NOT_FOUND', statusCode: 404 });
  });

  it('lanza DRIVER_UNAVAILABLE si el driver ya tiene entrega activa (ASSIGNED)', async () => {
    const driver = await mkDriver('Busy Driver');
    const d1 = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d1.id, driver.id);

    // Second delivery tries to use the same driver
    const d2 = await DeliveryService.createDeliveryOrder({
      ...BASE_DELIVERY,
      orderId: TEST_ORDER_2,
    });

    await expect(
      DeliveryService.assignDriver(d2.id, driver.id)
    ).rejects.toMatchObject({ code: 'DRIVER_UNAVAILABLE' });
  });

  it('lanza DRIVER_UNAVAILABLE si el driver está inactivo', async () => {
    const driver = await mkDriver('Inactive Driver');
    await prisma.drivers.update({ where: { id: driver.id }, data: { is_active: false } });
    const delivery = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    await expect(
      DeliveryService.assignDriver(delivery.id, driver.id)
    ).rejects.toMatchObject({ code: 'DRIVER_UNAVAILABLE' });
  });
});

// ─── markDispatched ───────────────────────────────────────────────────────────

describe('DeliveryService.markDispatched', () => {
  it('ASSIGNED → DISPATCHED: fija dispatched_at', async () => {
    const driver = await mkDriver('Dispatch Test');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    const before = new Date();

    const updated = await DeliveryService.markDispatched(d.id);

    expect(updated.status).toBe('DISPATCHED');
    expect(updated.dispatched_at).toBeInstanceOf(Date);
    expect(updated.dispatched_at!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('lanza INVALID_TRANSITION desde PENDING', async () => {
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    await expect(
      DeliveryService.markDispatched(d.id)
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DeliveryService.markDispatched(uuidv4())
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('lanza INVALID_TRANSITION intentando despachar un DELIVERED', async () => {
    const driver = await mkDriver('Dispatch Delivered');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);
    await DeliveryService.markDelivered(d.id);

    await expect(
      DeliveryService.markDispatched(d.id)
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

// ─── markDelivered ────────────────────────────────────────────────────────────

describe('DeliveryService.markDelivered', () => {
  it('DISPATCHED → DELIVERED: fija delivered_at', async () => {
    const driver = await mkDriver('Delivered Test');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);
    const before = new Date();

    const updated = await DeliveryService.markDelivered(d.id);

    expect(updated.status).toBe('DELIVERED');
    expect(updated.delivered_at).toBeInstanceOf(Date);
    expect(updated.delivered_at!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('calcula delivery_time_mins desde dispatched_at', async () => {
    const driver = await mkDriver('Time Calc Test');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);

    const updated = await DeliveryService.markDelivered(d.id);

    expect(updated.delivery_time_mins).toBeGreaterThanOrEqual(0);
    expect(typeof updated.delivery_time_mins).toBe('number');
  });

  it('almacena signature_url cuando se provee', async () => {
    const driver = await mkDriver('Signature Test');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);

    const updated = await DeliveryService.markDelivered(d.id, 'https://cdn.example.com/sig.png');

    expect(updated.signature_url).toBe('https://cdn.example.com/sig.png');
  });

  it('lanza INVALID_TRANSITION desde ASSIGNED', async () => {
    const driver = await mkDriver('Invalid Deliver 1');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);

    await expect(
      DeliveryService.markDelivered(d.id)
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('lanza INVALID_TRANSITION desde PENDING', async () => {
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    await expect(
      DeliveryService.markDelivered(d.id)
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

// ─── markFailed ───────────────────────────────────────────────────────────────

describe('DeliveryService.markFailed', () => {
  it('ASSIGNED → FAILED: almacena motivo y fija failed_at', async () => {
    const driver = await mkDriver('Failed Test 1');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    const before = new Date();

    const updated = await DeliveryService.markFailed(d.id, 'Dirección incorrecta');

    expect(updated.status).toBe('FAILED');
    expect(updated.failure_reason).toBe('Dirección incorrecta');
    expect(updated.failed_at).toBeInstanceOf(Date);
    expect(updated.failed_at!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('DISPATCHED → FAILED: también es válido', async () => {
    const driver = await mkDriver('Failed Test 2');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);

    const updated = await DeliveryService.markFailed(d.id, 'Cliente no abrió');

    expect(updated.status).toBe('FAILED');
    expect(updated.failure_reason).toBe('Cliente no abrió');
  });

  it('lanza VALIDATION_ERROR si el motivo está vacío', async () => {
    const driver = await mkDriver('Failed Test 3');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);

    await expect(
      DeliveryService.markFailed(d.id, '')
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lanza VALIDATION_ERROR si el motivo es solo espacios', async () => {
    const driver = await mkDriver('Failed Test 4');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);

    await expect(
      DeliveryService.markFailed(d.id, '   ')
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lanza INVALID_TRANSITION desde PENDING', async () => {
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    await expect(
      DeliveryService.markFailed(d.id, 'motivo')
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DeliveryService.markFailed(uuidv4(), 'motivo')
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('property: motivo se almacena sin modificación (trim)', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        async (reason) => {
          const driver = await mkDriver('Prop Failed');
          const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
          await DeliveryService.assignDriver(d.id, driver.id);
          const updated = await DeliveryService.markFailed(d.id, reason);
          expect(updated.failure_reason).toBe(reason.trim());
          // cleanup within iteration so next iteration starts clean
          await prisma.delivery_orders.delete({ where: { id: d.id } });
          await prisma.drivers.delete({ where: { id: driver.id } });
        }
      ),
      { numRuns: 5 } // reduced from 20: each iteration has 6 DB round-trips (~5s each)
    );
  });
});

// ─── getByStatus ──────────────────────────────────────────────────────────────

describe('DeliveryService.getByStatus', () => {
  it('retorna solo los deliveries con el estado solicitado', async () => {
    const driver = await mkDriver('Status Filter');
    const d1 = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    const d2 = await DeliveryService.createDeliveryOrder({ ...BASE_DELIVERY, orderId: TEST_ORDER_2 });
    await DeliveryService.assignDriver(d2.id, driver.id);

    const pending  = await DeliveryService.getByStatus(TEST_TENANT, ['PENDING']);
    const assigned = await DeliveryService.getByStatus(TEST_TENANT, ['ASSIGNED']);

    expect(pending.map(d => d.id)).toContain(d1.id);
    expect(pending.map(d => d.id)).not.toContain(d2.id);
    expect(assigned.map(d => d.id)).toContain(d2.id);
    expect(assigned.map(d => d.id)).not.toContain(d1.id);
  });

  it('soporta filtro multi-estado', async () => {
    const driver = await mkDriver('Multi Status');
    const d1 = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    const d2 = await DeliveryService.createDeliveryOrder({ ...BASE_DELIVERY, orderId: TEST_ORDER_2 });
    await DeliveryService.assignDriver(d2.id, driver.id);

    const results = await DeliveryService.getByStatus(TEST_TENANT, ['PENDING', 'ASSIGNED']);

    expect(results.length).toBe(2);
  });

  it('aislamiento de tenant: no retorna deliveries de otro tenant', async () => {
    const otherOrderId = uuidv4();
    await prisma.orders.create({
      data: { id: otherOrderId, tenant_id: OTHER_TENANT, order_number: 8001, order_type: 'DELIVERY', terminal_id: 'T1', items: [], checks: [] },
    });
    await DeliveryService.createDeliveryOrder({
      ...BASE_DELIVERY,
      tenantId: OTHER_TENANT,
      orderId: otherOrderId,
    });

    // Create one in TEST_TENANT to have something to compare
    await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    const results = await DeliveryService.getByStatus(TEST_TENANT, ['PENDING']);

    expect(results.every(d => d.tenant_id === TEST_TENANT)).toBe(true);
    expect(results.length).toBe(1);
  });
});

// ─── getDriverDeliveries ──────────────────────────────────────────────────────

describe('DeliveryService.getDriverDeliveries', () => {
  it('retorna solo entregas ASSIGNED y DISPATCHED del driver', async () => {
    const driver1 = await mkDriver('Get Deliveries 1');
    const driver2 = await mkDriver('Get Deliveries 2');
    const d1 = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    const d2 = await DeliveryService.createDeliveryOrder({ ...BASE_DELIVERY, orderId: TEST_ORDER_2 });

    await DeliveryService.assignDriver(d1.id, driver1.id);
    await DeliveryService.assignDriver(d2.id, driver2.id);

    const myDeliveries = await DeliveryService.getDriverDeliveries(driver1.id);

    expect(myDeliveries.length).toBe(1);
    expect(myDeliveries[0].id).toBe(d1.id);
  });

  it('no incluye deliveries DELIVERED en las activas', async () => {
    const driver = await mkDriver('Get Delivered');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);
    await DeliveryService.markDelivered(d.id);

    const active = await DeliveryService.getDriverDeliveries(driver.id);

    expect(active.length).toBe(0);
  });

  it('incluye entrega DISPATCHED como activa', async () => {
    const driver = await mkDriver('Get Dispatched');
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);

    const active = await DeliveryService.getDriverDeliveries(driver.id);

    expect(active.length).toBe(1);
    expect(active[0].status).toBe('DISPATCHED');
  });
});

// ─── getById ─────────────────────────────────────────────────────────────────

describe('DeliveryService.getById', () => {
  it('retorna el delivery por ID', async () => {
    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);

    const found = await DeliveryService.getById(d.id);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(d.id);
  });

  it('retorna null si no existe', async () => {
    const found = await DeliveryService.getById(uuidv4());

    expect(found).toBeNull();
  });
});

// ─── State machine invariants ─────────────────────────────────────────────────

describe('Invariantes de la máquina de estados', () => {
  it('los estados terminales (DELIVERED, FAILED) no permiten ninguna transición', async () => {
    // DELIVERED es terminal
    const driver1 = await mkDriver('Terminal DELIVERED');
    const d1 = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d1.id, driver1.id);
    await DeliveryService.markDispatched(d1.id);
    await DeliveryService.markDelivered(d1.id);

    await expect(DeliveryService.markDispatched(d1.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(DeliveryService.markFailed(d1.id, 'x')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    // FAILED es terminal
    const driver2 = await mkDriver('Terminal FAILED');
    const d2 = await DeliveryService.createDeliveryOrder({ ...BASE_DELIVERY, orderId: TEST_ORDER_2 });
    await DeliveryService.assignDriver(d2.id, driver2.id);
    await DeliveryService.markFailed(d2.id, 'motivo');

    await expect(DeliveryService.markDispatched(d2.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(DeliveryService.markDelivered(d2.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('el flujo feliz completo actualiza timestamps en orden', async () => {
    const driver = await mkDriver('Happy Path');
    const t0 = Date.now();

    const d = await DeliveryService.createDeliveryOrder(BASE_DELIVERY);
    await DeliveryService.assignDriver(d.id, driver.id);
    await DeliveryService.markDispatched(d.id);
    const final = await DeliveryService.markDelivered(d.id);

    expect(final.assigned_at!.getTime()).toBeGreaterThanOrEqual(t0);
    expect(final.dispatched_at!.getTime()).toBeGreaterThanOrEqual(final.assigned_at!.getTime());
    expect(final.delivered_at!.getTime()).toBeGreaterThanOrEqual(final.dispatched_at!.getTime());
  });
});
