/**
 * TEST DE CARACTERIZACIÓN — Lifecycle del status de items de una orden.
 *
 * Red de seguridad INDEPENDIENTE para el refactor de alto riesgo
 * `remove-item-status-from-write-model` (design #2186, tasks #2187, council #2179):
 *   - P4: el writer dejará de escribir `status` en el JSON `orders.items[]`.
 *   - P5: migración masiva de ~4900 tests.
 *
 * Este test NO es uno de los que se migran: es la RED que debe PASAR HOY
 * (comportamiento actual) y SEGUIR PASANDO tras el refactor (comportamiento
 * preservado). Por eso:
 *
 *  1. Corre contra la DB REAL (prisma singleton, igual que los *.db.test.ts).
 *     Aislado por un TEST_TENANT dedicado, cleanup tenant-scoped
 *     (deleteMany({ where: { tenant_id } }), NUNCA deleteMany({})).
 *
 *  2. Ejerce el PIPELINE REAL del ingest: por cada evento escribe la fila en la
 *     tabla `events` (como lo hace el route handler del ingest) y llama
 *     `projectEvent(tx, event)` — el MISMO proyector de producción. NO hace
 *     inserts manuales en order_item_projections.
 *
 *  3. Lee el status VIVO EXCLUSIVAMENTE del read-model server-side
 *     `getItemStatuses` (order_item_projections). NUNCA asserta sobre
 *     `orders.items[].status` del JSON. Así el test SOBREVIVE a P4: cuando el
 *     JSON pierda `status`, estas aserciones siguen verdes porque leen la
 *     proyección, no el snapshot congelado.
 *
 * Cubre el golden path del lifecycle + bordes:
 *   - ORDER_CREATED + ORDER_ITEM_ADDED → items PENDING en la proyección.
 *   - ORDER_SUBMITTED → items pasan a IN_KITCHEN.
 *   - ORDER_ITEM_STATUS_CHANGED (PENDING→COOKING→READY→DONE) → cada transición viva.
 *   - ORDER_ITEM_VOIDED → la fila desaparece de la proyección.
 *   - Borde fiscal/SUNAT: tras un void, el line_id anulado se resuelve desde el
 *     event store (events.type=ORDER_ITEM_VOIDED), como hace resolveInvoiceItems.
 *   - Borde QR: orden creada con items[]:[] + ORDER_ITEM_ADDED (flujo del portal QR,
 *     #2181) → sus items SÍ se proyectan con status vivo (no caen en el agujero).
 *   - Borde ORDER_CREATED con items[] (no solo ITEM_ADDED) → sus items SÍ se
 *     proyectan (fix del agujero #2180).
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { projectEvent } from '@/src/core/events/project-event';
import { getItemStatuses } from '@/src/core/projections/order-items.read';
import type { ParkEvent, OrderLine } from '@/src/core/domain/events';

// ─── Test IDs fijos (tenant dedicado, aislamiento multi-tenant) ────────────────

const TEST_TENANT = 'c4000004-0000-4000-a000-000000000001';
const TERMINAL = 'TEST_TERMINAL_CHAR';

// ─── Helper: construir una OrderLine completa (payload del evento) ─────────────
// El status sigue VIVIENDO en el PAYLOAD del evento (OrderLineSchema.status) —
// eso NO cambia en P4. Lo que P4 quita es el status del SNAPSHOT orders.items[].
// Este helper produce el payload del evento, no el snapshot.
function makeLine(overrides: Partial<OrderLine> & { line_id: string }): OrderLine {
  return {
    line_id: overrides.line_id,
    product_id: overrides.product_id ?? randomUUID(),
    sku: overrides.sku ?? `SKU-${overrides.line_id}`,
    name: overrides.name ?? `Item ${overrides.line_id}`,
    qty: overrides.qty ?? 1,
    unit_price_cents: overrides.unit_price_cents ?? 2500,
    station: overrides.station ?? 'COCINA',
    status: overrides.status ?? 'PENDING',
    tax_category: overrides.tax_category ?? 'GRAVADO',
    mods: overrides.mods ?? [],
    is_special_sla: overrides.is_special_sla ?? false,
  } as OrderLine;
}

// ─── Helper: base envelope de un ParkEvent ─────────────────────────────────────
function baseEnvelope(orderId: string, seq: number) {
  return {
    event_id: randomUUID(),
    tenant_id: TEST_TENANT,
    terminal_id: TERMINAL,
    terminal_sequence: seq,
    occurred_at: new Date(Date.now() + seq * 1000).toISOString(),
    aggregate_type: 'ORDER' as const,
    aggregate_id: orderId,
    correlation_id: orderId,
    causation_id: null,
    actor_id: null,
    actor_role_snapshot: null,
    schema_version: 1,
    payload_version: 1,
    shift_id: null,
    business_date: null,
  };
}

/**
 * INGEST REAL (mínimo fiel): replica el camino de producción del route handler:
 *   1. escribe la fila en la tabla `events` (lo que consultan los lectores del
 *      event store, p.ej. resolveVoidedLineIds de SUNAT);
 *   2. llama `projectEvent(tx, event)` — el MISMO proyector que el ingest.
 * Corre dentro de UNA transacción, igual que el ingest. NO duplica la lógica de
 * proyección: la invoca tal cual.
 */
async function ingest(event: ParkEvent): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.events.create({
      data: {
        id: event.event_id,
        tenant_id: event.tenant_id,
        occurred_at: new Date(event.occurred_at),
        type: event.event_type,
        entity_type: event.aggregate_type,
        entity_id: event.aggregate_id,
        actor_id: event.actor_id ?? null,
        actor_role_snapshot: event.actor_role_snapshot ?? null,
        terminal_id: event.terminal_id,
        payload_version: event.payload_version,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
    const projected = await projectEvent(tx, event);
    // projectEvent devuelve false si la proyección falló (el ingest rechazaría el
    // evento). En el camino feliz SIEMPRE es true; lo afirmamos como red.
    expect(projected).toBe(true);
  });
}

// ─── Cleanup tenant-scoped (NUNCA deleteMany({})) ──────────────────────────────
async function cleanupTenant() {
  await prisma.order_item_projections.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.events.deleteMany({ where: { tenant_id: TEST_TENANT } });
  await prisma.orders.deleteMany({ where: { tenant_id: TEST_TENANT } });
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await prisma.tenants.upsert({
    where: { id: TEST_TENANT },
    update: {},
    create: { id: TEST_TENANT, name: 'Test Characterization Tenant' },
  });
});

beforeEach(async () => {
  await cleanupTenant();
});

afterAll(async () => {
  await cleanupTenant();
  await prisma.tenants.deleteMany({ where: { id: TEST_TENANT } });
  await prisma.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOLDEN PATH — lifecycle completo del status leído SOLO de la proyección
// ═══════════════════════════════════════════════════════════════════════════════

describe('Lifecycle del status de items (caracterización, status VIVO desde proyección)', () => {
  it('ORDER_CREATED + ORDER_ITEM_ADDED → cada item PENDING en order_item_projections', async () => {
    const orderId = randomUUID();
    const l1 = makeLine({ line_id: 'L1' });
    const l2 = makeLine({ line_id: 'L2' });

    // Orden creada con UN item embebido (camino POS clásico: ORDER_CREATED-con-items)
    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9001, order_type: 'DINE_IN', items: [l1], checks: [] },
    } as ParkEvent);

    // Segundo item agregado vía ORDER_ITEM_ADDED
    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_ITEM_ADDED',
      payload: { order_id: orderId, line: l2 },
    } as ParkEvent);

    const statuses = await getItemStatuses(prisma, TEST_TENANT, orderId);

    expect(statuses.size).toBe(2);
    expect(statuses.get('L1')?.status).toBe('PENDING');
    expect(statuses.get('L2')?.status).toBe('PENDING');
    expect(statuses.get('L1')?.station).toBe('COCINA');
  });

  it('ORDER_SUBMITTED → los items pasan a IN_KITCHEN en la proyección', async () => {
    const orderId = randomUUID();
    const l1 = makeLine({ line_id: 'L1' });
    const l2 = makeLine({ line_id: 'L2', station: 'BAR' });

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9002, order_type: 'DINE_IN', items: [l1, l2], checks: [] },
    } as ParkEvent);

    // ORDER_SUBMITTED agrupa por estación; solo afecta filas PENDING.
    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_SUBMITTED',
      payload: {
        order_id: orderId,
        submitted_at: new Date().toISOString(),
        items_by_station: {
          COCINA: [{ line_id: 'L1', product_id: l1.product_id, name: l1.name, qty: 1, mods: [] }],
          BAR: [{ line_id: 'L2', product_id: l2.product_id, name: l2.name, qty: 1, mods: [] }],
        },
      },
    } as ParkEvent);

    const statuses = await getItemStatuses(prisma, TEST_TENANT, orderId);
    expect(statuses.get('L1')?.status).toBe('IN_KITCHEN');
    expect(statuses.get('L2')?.status).toBe('IN_KITCHEN');
  });

  it('ORDER_ITEM_STATUS_CHANGED PENDING→COOKING→READY→DONE → cada transición VIVA en la proyección', async () => {
    const orderId = randomUUID();
    const l1 = makeLine({ line_id: 'L1' });

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9003, order_type: 'DINE_IN', items: [l1], checks: [] },
    } as ParkEvent);

    // Estado inicial vivo: PENDING
    expect((await getItemStatuses(prisma, TEST_TENANT, orderId)).get('L1')?.status).toBe('PENDING');

    const transitions: Array<['PENDING' | 'COOKING' | 'READY', 'COOKING' | 'READY' | 'DONE']> = [
      ['PENDING', 'COOKING'],
      ['COOKING', 'READY'],
      ['READY', 'DONE'],
    ];

    let seq = 2;
    for (const [from, to] of transitions) {
      await ingest({
        ...baseEnvelope(orderId, seq++),
        event_type: 'ORDER_ITEM_STATUS_CHANGED',
        payload: { order_id: orderId, line_id: 'L1', from, to, station: 'COCINA' },
      } as ParkEvent);

      const live = await getItemStatuses(prisma, TEST_TENANT, orderId);
      expect(live.get('L1')?.status).toBe(to); // la proyección refleja el status VIVO
    }

    // Estado final: DONE, con served_at poblado (lifecycle completo)
    const finalRow = await prisma.order_item_projections.findFirst({
      where: { tenant_id: TEST_TENANT, order_id: orderId, line_id: 'L1' },
      select: { status: true, ready_at: true, served_at: true },
    });
    expect(finalRow?.status).toBe('DONE');
    expect(finalRow?.ready_at).not.toBeNull();
    expect(finalRow?.served_at).not.toBeNull();
  });

  it('ORDER_ITEM_VOIDED → la fila desaparece de la proyección (getItemStatuses no la incluye)', async () => {
    const orderId = randomUUID();
    const l1 = makeLine({ line_id: 'L1' });
    const l2 = makeLine({ line_id: 'L2' });

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9004, order_type: 'DINE_IN', items: [l1, l2], checks: [] },
    } as ParkEvent);

    expect((await getItemStatuses(prisma, TEST_TENANT, orderId)).size).toBe(2);

    // Anular L1
    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_ITEM_VOIDED',
      payload: { order_id: orderId, line_id: 'L1', reason: 'Cliente cambió de opinión', voided_at: new Date().toISOString() },
    } as ParkEvent);

    const statuses = await getItemStatuses(prisma, TEST_TENANT, orderId);
    expect(statuses.has('L1')).toBe(false); // ausencia explícita: el void hace DELETE en la proyección
    expect(statuses.has('L2')).toBe(true);
    expect(statuses.size).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BORDE FISCAL / SUNAT — el void se resuelve desde el EVENT STORE, no del JSON
// ═══════════════════════════════════════════════════════════════════════════════

describe('Borde fiscal: resolución del void desde el event store (como resolveInvoiceItems)', () => {
  it('tras un void, el line_id anulado se obtiene de events(ORDER_ITEM_VOIDED) y queda EXCLUIDO; el resto del JSON permanece', async () => {
    const orderId = randomUUID();
    const l1 = makeLine({ line_id: 'L1', sku: 'POLLO-1' });
    const l2 = makeLine({ line_id: 'L2', sku: 'GASEOSA-1' });

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9005, order_type: 'DINE_IN', items: [l1, l2], checks: [] },
    } as ParkEvent);

    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_ITEM_VOIDED',
      payload: { order_id: orderId, line_id: 'L1', reason: 'Plato devuelto', voided_at: new Date().toISOString() },
    } as ParkEvent);

    // resolveVoidedLineIds (SUNAT) consulta así: events.type='ORDER_ITEM_VOIDED'
    // + entity_id=order.id, leyendo line_id del payload. Replicamos esa query
    // EXACTA — es el camino que sobrevive a P4 (no toca orders.items[].status).
    const voidEvents = await prisma.events.findMany({
      where: { tenant_id: TEST_TENANT, type: 'ORDER_ITEM_VOIDED', entity_id: orderId },
      select: { payload: true },
    });
    const voidedLineIds = new Set(
      voidEvents
        .map((e) => (e.payload as { line_id?: string })?.line_id)
        .filter((id): id is string => typeof id === 'string'),
    );

    expect(voidedLineIds.has('L1')).toBe(true);
    expect(voidedLineIds.has('L2')).toBe(false);

    // El JSON orders.items[] NO marca el void (sigue listando L1) — por eso SUNAT
    // se apoya en el event store. Caracterizamos las DOS líneas del JSON y que el
    // filtro de void deja SOLO la no anulada (lo que facturaría resolveInvoiceItems).
    const order = await prisma.orders.findUnique({ where: { id: orderId }, select: { items: true } });
    const items = order!.items as Array<{ line_id: string; sku: string }>;
    const facturables = items.filter((it) => !voidedLineIds.has(it.line_id));

    expect(items.map((i) => i.line_id).sort()).toEqual(['L1', 'L2']); // JSON conserva ambas
    expect(facturables.map((i) => i.line_id)).toEqual(['L2']); // L1 anulada → excluida del comprobante
    expect(facturables[0].sku).toBe('GASEOSA-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BORDE QR — orden del portal QR (items[]:[] + ORDER_ITEM_ADDED) se proyecta (#2181)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Borde QR: orden creada por el flujo del portal (items[]:[] + ITEM_ADDED)', () => {
  it('los items QR SÍ aparecen en order_item_projections con status vivo (no caen en el agujero)', async () => {
    const orderId = randomUUID();
    // El portal QR (#2181) emite ORDER_CREATED con items:[] y luego N ORDER_ITEM_ADDED.
    const qr1 = makeLine({ line_id: 'qr_1', name: 'Pollo QR' });
    const qr2 = makeLine({ line_id: 'qr_2', name: 'Inca Kola QR', station: 'BAR' });

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9006, order_type: 'DINE_IN', items: [], checks: [] },
    } as ParkEvent);

    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_ITEM_ADDED',
      payload: { order_id: orderId, line: qr1 },
    } as ParkEvent);
    await ingest({
      ...baseEnvelope(orderId, 3),
      event_type: 'ORDER_ITEM_ADDED',
      payload: { order_id: orderId, line: qr2 },
    } as ParkEvent);

    const statuses = await getItemStatuses(prisma, TEST_TENANT, orderId);
    expect(statuses.size).toBe(2);
    expect(statuses.get('qr_1')?.status).toBe('PENDING');
    expect(statuses.get('qr_2')?.status).toBe('PENDING');

    // Y su status progresa (la cocina marca READY): prueba que la fila existe y
    // el UPDATE de STATUS_CHANGED la encuentra (antes del fix afectaba 0 filas).
    await ingest({
      ...baseEnvelope(orderId, 4),
      event_type: 'ORDER_ITEM_STATUS_CHANGED',
      payload: { order_id: orderId, line_id: 'qr_1', from: 'PENDING', to: 'READY', station: 'COCINA' },
    } as ParkEvent);

    expect((await getItemStatuses(prisma, TEST_TENANT, orderId)).get('qr_1')?.status).toBe('READY');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BORDE #2180 — items NACIDOS en ORDER_CREATED (no solo ITEM_ADDED) se proyectan
// ═══════════════════════════════════════════════════════════════════════════════

describe('Borde #2180: items nacidos en ORDER_CREATED se proyectan (fix del agujero)', () => {
  it('una orden creada con varios items embebidos proyecta TODAS sus líneas, y su status progresa', async () => {
    const orderId = randomUUID();
    // POS clásico / importación: la orden NACE con todos sus items en ORDER_CREATED.
    const lines = [
      makeLine({ line_id: 'P1', name: 'Pollo entero' }),
      makeLine({ line_id: 'P2', name: 'Papas', station: 'COCINA' }),
      makeLine({ line_id: 'P3', name: 'Ensalada', station: 'FRIOS' }),
    ];

    await ingest({
      ...baseEnvelope(orderId, 1),
      event_type: 'ORDER_CREATED',
      payload: { order_id: orderId, order_number: 9007, order_type: 'DINE_IN', items: lines, checks: [] },
    } as ParkEvent);

    const statuses = await getItemStatuses(prisma, TEST_TENANT, orderId);
    expect(statuses.size).toBe(3); // antes del fix #2180: 0 filas (agujero negro)
    expect(statuses.get('P1')?.status).toBe('PENDING');
    expect(statuses.get('P2')?.status).toBe('PENDING');
    expect(statuses.get('P3')?.status).toBe('PENDING');

    // El status progresa para un item nacido en CREATE (el UPDATE encuentra la fila).
    await ingest({
      ...baseEnvelope(orderId, 2),
      event_type: 'ORDER_ITEM_STATUS_CHANGED',
      payload: { order_id: orderId, line_id: 'P3', from: 'PENDING', to: 'COOKING', station: 'FRIOS' },
    } as ParkEvent);

    expect((await getItemStatuses(prisma, TEST_TENANT, orderId)).get('P3')?.status).toBe('COOKING');
  });
});
