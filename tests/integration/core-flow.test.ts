/**
 * Integracion del FLUJO CORE de PARK (happy path) contra la DB real.
 *
 * Cubre la cadena que cruza varios subsistemas (lo que un E2E de UI probaria,
 * pero deterministico y rapido, sin browser):
 *   1. Orden creada + item agregado (parrilla)
 *   2. Item marcado DONE en cocina  -> el ALMACEN descuenta el insumo (recipe/BOM)
 *   3. Pre-cuenta (Nota de Venta) emitida -> estado OPEN
 *   4. Conversion a comprobante (caja) -> Nota CONVERTED
 *
 * La emision fiscal real (InvoiceService -> SUNAT) ya esta cubierta aparte
 * (invoice.service.test + prisma/cleanup/verify-sales-notes). Aca validamos la
 * INTEGRACION entre ingest/proyeccion, descuento de inventario y nota de venta.
 *
 * Requiere DB (CI: postgres del job; local: la DATABASE_URL de .env). Limpia por
 * tenant_id de prueba al final (NUNCA deleteMany({})).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import prisma from '@/src/core/db/prisma';
import {
  handleOrderCreated,
  handleOrderItemAdded,
  handleOrderItemStatusChanged,
} from '@/src/core/events/projections/order-projections';
import {
  handleSalesNoteIssued,
  handleSalesNoteConverted,
} from '@/src/core/events/projections/sales-note-projections';

const TENANT = randomUUID();
const ORDER = randomUUID();
const PRODUCT = randomUUID();
const LINE = 'line-core-1';
const CHECK = 'c1';
const INSUMO = 'POLLO_INSUMO_COREFLOW';
const SALES_NOTE = randomUUID();
const INVOICE = randomUUID();
const STOCK_INICIAL = 100;
const QTY = 2;

function ev(event_type: string, payload: Record<string, unknown>, aggregateId: string = ORDER) {
  return {
    event_id: randomUUID(),
    tenant_id: TENANT,
    terminal_id: 'T-CORE',
    occurred_at: new Date().toISOString(),
    actor_id: randomUUID(),
    aggregate_id: aggregateId, // handleOrderItemStatusChanged busca la orden por event.aggregate_id
    event_type,
    payload,
  } as never;
}

describe('Flujo core PARK (integracion DB)', () => {
  beforeAll(async () => {
    // Seed minimo: tenant + insumo en almacen + receta (producto -> 1 unidad de insumo).
    await prisma.tenants.upsert({
      where: { id: TENANT },
      create: { id: TENANT, name: 'Tenant Flujo Core' },
      update: {},
    });
    await prisma.inventory.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT,
        code: INSUMO,
        name: 'Pollo (insumo)',
        unit: 'unidades',
        stock: STOCK_INICIAL,
      },
    });
    // El recipe.product_id tiene FK a products.
    await prisma.products.create({
      data: {
        id: PRODUCT,
        tenant_id: TENANT,
        sku: 'POLLO-CORE',
        name: 'Pollo a la brasa',
        price_cents: 2500,
        category: 'POLLOS',
        station: 'PARRILLA',
      },
    });
    await prisma.recipes.create({
      data: {
        id: randomUUID(),
        tenant_id: TENANT,
        product_id: PRODUCT,
        is_active: true,
        ingredients: [{ inventory_code: INSUMO, quantity: 1, is_optional: false }],
      },
    });
  });

  afterAll(async () => {
    // Cleanup por tenant_id (orden inversa a las FKs).
    await prisma.sales_notes.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.recipes.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.products.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.inventory.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.$executeRaw`DELETE FROM order_item_projections WHERE tenant_id = ${TENANT}::uuid`.catch(() => {});
    await prisma.order_tables.deleteMany({ where: { order_id: ORDER } }).catch(() => {});
    await prisma.orders.deleteMany({ where: { tenant_id: TENANT } }).catch(() => {});
    await prisma.tenants.deleteMany({ where: { id: TENANT } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('orden -> item DONE descuenta almacen -> pre-cuenta -> conversion', async () => {
    // 1. Orden creada (TAKEOUT para no depender de seed de mesa).
    await handleOrderCreated(prisma as never, ev('ORDER_CREATED', {
      order_id: ORDER,
      order_number: 1,
      order_type: 'TAKEOUT',
      items: [],
      checks: [{ check_id: CHECK, name: 'Principal', lines: [], subtotal_cents: 0, total_cents: 0 }],
    }));

    // 2. Item agregado (parrilla), qty 2.
    await handleOrderItemAdded(prisma as never, ev('ORDER_ITEM_ADDED', {
      order_id: ORDER,
      line: { line_id: LINE, product_id: PRODUCT, qty: QTY, unit_price_cents: 2500, name: 'Pollo a la brasa', station: 'PARRILLA' },
    }));

    // 3. Cocina marca el item DONE -> dispara el descuento de almacen.
    await handleOrderItemStatusChanged(prisma as never, ev('ORDER_ITEM_STATUS_CHANGED', {
      order_id: ORDER,
      line_id: LINE,
      to: 'DONE',
    }));

    // ASSERT: el almacen descuento qty * receta (2 * 1 = 2) -> 100 - 2 = 98.
    const insumo = await prisma.inventory.findFirst({ where: { tenant_id: TENANT, code: INSUMO } });
    expect(Number(insumo?.stock)).toBe(STOCK_INICIAL - QTY);

    // 4. Pre-cuenta: Nota de Venta emitida -> OPEN.
    await handleSalesNoteIssued(prisma as never, ev('SALES_NOTE_ISSUED', {
      sales_note_id: SALES_NOTE, order_id: ORDER, check_id: CHECK, serie: 'NVT-CORE', numero: '00000001', total_cents: 5000,
    }, SALES_NOTE));
    const open = await prisma.sales_notes.findUnique({ where: { id: SALES_NOTE } });
    expect(open?.status).toBe('OPEN');

    // 5. Caja convierte la nota en comprobante -> CONVERTED.
    await handleSalesNoteConverted(prisma as never, ev('SALES_NOTE_CONVERTED', {
      sales_note_id: SALES_NOTE, invoice_id: INVOICE, invoice_type: 'BOLETA',
    }, SALES_NOTE));
    const converted = await prisma.sales_notes.findUnique({ where: { id: SALES_NOTE } });
    expect(converted?.status).toBe('CONVERTED');
    expect(converted?.invoice_id).toBe(INVOICE);
  });
});
