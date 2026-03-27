/**
 * DriverService — Database Integration Tests
 *
 * Tests create, update, deactivate, activate, getAvailable, getDriverStatus,
 * listWithStatus and getById against a real PostgreSQL database.
 * Scope is isolated by TEST_TENANT_ID.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import * as fc from 'fast-check';
import prisma from '@/src/core/db/prisma';
import { DriverService, DriverServiceError } from '../driver.service';
import { DeliveryService } from '../delivery.service';
import { v4 as uuidv4 } from 'uuid';
import { asCentavos } from '@/src/core/types/shared';

// ─── Fixed Test IDs ───────────────────────────────────────────────────────────

const TEST_TENANT = 'f2000001-0000-4000-a000-000000000001';
const TEST_ORDER  = 'f2000001-0000-4000-a000-000000000010';

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.tenants.upsert({
    where: { id: TEST_TENANT },
    update: {},
    create: { id: TEST_TENANT, name: 'Test Driver Tenant' },
  });
  // Base order for delivery tests that require order FK
  await prisma.orders.upsert({
    where: { id: TEST_ORDER },
    update: {},
    create: {
      id: TEST_ORDER,
      tenant_id: TEST_TENANT,
      order_number: 8001,
      order_type: 'DELIVERY',
      terminal_id: 'TEST_TERMINAL',
      items: [],
      checks: [],
    },
  });
});

beforeEach(async () => {
  await prisma.delivery_orders.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.admin_access_logs.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.drivers.deleteMany({ where: { tenant_id: TEST_TENANT } });
});

afterAll(async () => {
  await prisma.delivery_orders.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.admin_access_logs.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.drivers.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.orders.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.tenants.deleteMany({ where: { id: TEST_TENANT } });
  await prisma.$disconnect();
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('DriverService.create', () => {
  it('crea driver activo con nombre', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Jorge Mendoza');

    expect(driver.name).toBe('Jorge Mendoza');
    expect(driver.is_active).toBe(true);
    expect(driver.phone).toBeNull();
    expect(driver.id).toBeTruthy();
  });

  it('crea driver con teléfono', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'María Pérez', '987123456');

    expect(driver.phone).toBe('987123456');
  });

  it('hace trim del nombre', async () => {
    const driver = await DriverService.create(TEST_TENANT, '  Luis Soto  ');

    expect(driver.name).toBe('Luis Soto');
  });

  it('lanza VALIDATION_ERROR para nombre vacío', async () => {
    await expect(
      DriverService.create(TEST_TENANT, '')
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('lanza VALIDATION_ERROR para nombre solo espacios', async () => {
    await expect(
      DriverService.create(TEST_TENANT, '   ')
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('persiste en la base de datos', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Ana Ramos', '912345678');

    const record = await prisma.drivers.findUnique({ where: { id: driver.id } });
    expect(record).not.toBeNull();
    expect(record!.name).toBe('Ana Ramos');
    expect(record!.phone).toBe('912345678');
    expect(record!.is_active).toBe(true);
  });

  it('property: nombre siempre se almacena como trim', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0
          && !['__proto__', 'constructor', 'prototype'].includes(s.trim())),
        async (name) => {
          const driver = await DriverService.create(TEST_TENANT, `  ${name}  `);
          expect(driver.name).toBe(name.trim());
          await prisma.drivers.delete({ where: { id: driver.id } });
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ─── update ───────────────────────────────────────────────────────────────────

describe('DriverService.update', () => {
  it('actualiza nombre', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Nombre Viejo');
    const updated = await DriverService.update(driver.id, { name: 'Nombre Nuevo' });

    expect(updated.name).toBe('Nombre Nuevo');
  });

  it('actualiza teléfono', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Carlos Test');
    const updated = await DriverService.update(driver.id, { phone: '998877665' });

    expect(updated.phone).toBe('998877665');
  });

  it('actualiza nombre y teléfono a la vez', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Inicial');
    const updated = await DriverService.update(driver.id, { name: 'Final', phone: '900000001' });

    expect(updated.name).toBe('Final');
    expect(updated.phone).toBe('900000001');
  });

  it('lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DriverService.update(uuidv4(), { name: 'Nuevo' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('lanza VALIDATION_ERROR al actualizar con nombre vacío', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Inicial');

    await expect(
      DriverService.update(driver.id, { name: '' })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

// ─── deactivate / activate ────────────────────────────────────────────────────

describe('DriverService.deactivate / activate', () => {
  it('deactivate: cambia is_active a false', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Desactivar');
    const deactivated = await DriverService.deactivate(driver.id);

    expect(deactivated.is_active).toBe(false);
  });

  it('activate: cambia is_active a true', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Reactivar');
    await DriverService.deactivate(driver.id);

    const activated = await DriverService.activate(driver.id);

    expect(activated.is_active).toBe(true);
  });

  it('deactivate es idempotente (ya estaba inactivo)', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Idempotente');
    await DriverService.deactivate(driver.id);
    const again = await DriverService.deactivate(driver.id);

    expect(again.is_active).toBe(false);
  });

  it('deactivate lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DriverService.deactivate(uuidv4())
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('activate lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DriverService.activate(uuidv4())
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });
});

// ─── getAvailable ─────────────────────────────────────────────────────────────

describe('DriverService.getAvailable', () => {
  it('retorna drivers activos sin entregas activas', async () => {
    const d1 = await DriverService.create(TEST_TENANT, 'Libre 1');
    const d2 = await DriverService.create(TEST_TENANT, 'Libre 2');

    const available = await DriverService.getAvailable(TEST_TENANT);

    const ids = available.map(d => d.id);
    expect(ids).toContain(d1.id);
    expect(ids).toContain(d2.id);
  });

  it('excluye driver con entrega ASSIGNED', async () => {
    const busy = await DriverService.create(TEST_TENANT, 'Ocupado');
    const free = await DriverService.create(TEST_TENANT, 'Libre');

    // Asignar una entrega al driver ocupado
    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Av. Test 123, Lima',
      customerPhone: '999999999',
      deliveryFee: asCentavos(500),
    });
    await DeliveryService.assignDriver(delivery.id, busy.id);

    const available = await DriverService.getAvailable(TEST_TENANT);
    const ids = available.map(d => d.id);

    expect(ids).not.toContain(busy.id);
    expect(ids).toContain(free.id);
  });

  it('excluye driver con entrega DISPATCHED', async () => {
    const busy = await DriverService.create(TEST_TENANT, 'En ruta');

    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Av. Test 123, Lima',
      customerPhone: '999999999',
      deliveryFee: asCentavos(500),
    });
    await DeliveryService.assignDriver(delivery.id, busy.id);
    await DeliveryService.markDispatched(delivery.id);

    const available = await DriverService.getAvailable(TEST_TENANT);
    const ids = available.map(d => d.id);

    expect(ids).not.toContain(busy.id);
  });

  it('incluye driver cuya entrega fue completada (DELIVERED)', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Completó');

    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Av. Test 123, Lima',
      customerPhone: '999999999',
      deliveryFee: asCentavos(500),
    });
    await DeliveryService.assignDriver(delivery.id, driver.id);
    await DeliveryService.markDispatched(delivery.id);
    await DeliveryService.markDelivered(delivery.id);

    const available = await DriverService.getAvailable(TEST_TENANT);
    const ids = available.map(d => d.id);

    expect(ids).toContain(driver.id);
  });

  it('excluye drivers inactivos', async () => {
    const inactive = await DriverService.create(TEST_TENANT, 'Inactivo');
    await DriverService.deactivate(inactive.id);

    const available = await DriverService.getAvailable(TEST_TENANT);
    const ids = available.map(d => d.id);

    expect(ids).not.toContain(inactive.id);
  });

  it('retorna lista vacía si no hay drivers activos disponibles', async () => {
    // Crear uno y desactivarlo
    const driver = await DriverService.create(TEST_TENANT, 'Único');
    await DriverService.deactivate(driver.id);

    const available = await DriverService.getAvailable(TEST_TENANT);

    expect(available.length).toBe(0);
  });
});

// ─── getDriverStatus ──────────────────────────────────────────────────────────

describe('DriverService.getDriverStatus', () => {
  it('retorna available para driver sin entregas activas', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Status libre');

    const result = await DriverService.getDriverStatus(driver.id);

    expect(result.status).toBe('available');
    expect(result.currentDelivery).toBeNull();
    expect(result.driver.id).toBe(driver.id);
  });

  it('retorna on_delivery para driver con entrega ASSIGNED', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Status ocupado');
    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Calle Real 999, Lima',
      customerPhone: '912345678',
      deliveryFee: asCentavos(600),
    });
    await DeliveryService.assignDriver(delivery.id, driver.id);

    const result = await DriverService.getDriverStatus(driver.id);

    expect(result.status).toBe('on_delivery');
    expect(result.currentDelivery).not.toBeNull();
    expect(result.currentDelivery!.id).toBe(delivery.id);
  });

  it('retorna on_delivery para driver con entrega DISPATCHED', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Status en ruta');
    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Av. Arequipa 100, Miraflores',
      customerPhone: '945678123',
      deliveryFee: asCentavos(700),
    });
    await DeliveryService.assignDriver(delivery.id, driver.id);
    await DeliveryService.markDispatched(delivery.id);

    const result = await DriverService.getDriverStatus(driver.id);

    expect(result.status).toBe('on_delivery');
  });

  it('lanza NOT_FOUND para ID inexistente', async () => {
    await expect(
      DriverService.getDriverStatus(uuidv4())
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });
});

// ─── getById ─────────────────────────────────────────────────────────────────

describe('DriverService.getById', () => {
  it('retorna driver por ID', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Buscar por ID');

    const found = await DriverService.getById(driver.id);

    expect(found).not.toBeNull();
    expect(found!.name).toBe('Buscar por ID');
  });

  it('retorna null si no existe', async () => {
    const found = await DriverService.getById(uuidv4());

    expect(found).toBeNull();
  });
});

// ─── listWithStatus ───────────────────────────────────────────────────────────

describe('DriverService.listWithStatus', () => {
  it('incluye todos los drivers del tenant con su estado', async () => {
    const d1 = await DriverService.create(TEST_TENANT, 'Lista 1');
    const d2 = await DriverService.create(TEST_TENANT, 'Lista 2');

    const list = await DriverService.listWithStatus(TEST_TENANT);
    const ids = list.map(d => d.id);

    expect(ids).toContain(d1.id);
    expect(ids).toContain(d2.id);
  });

  it('incluye campo status en cada driver', async () => {
    await DriverService.create(TEST_TENANT, 'Con status');

    const list = await DriverService.listWithStatus(TEST_TENANT);

    expect(list.every(d => ['available', 'on_delivery', 'inactive'].includes(d.status))).toBe(true);
  });

  it('driver con entrega activa tiene status BUSY', async () => {
    const driver = await DriverService.create(TEST_TENANT, 'Busy en lista');
    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TEST_TENANT,
      orderId: TEST_ORDER,
      addressText: 'Jr. Ucayali 400, Lima',
      customerPhone: '923456789',
      deliveryFee: asCentavos(400),
    });
    await DeliveryService.assignDriver(delivery.id, driver.id);

    const list = await DriverService.listWithStatus(TEST_TENANT);
    const found = list.find(d => d.id === driver.id);

    expect(found).toBeDefined();
    expect(found!.status).toBe('on_delivery');
  });
});
