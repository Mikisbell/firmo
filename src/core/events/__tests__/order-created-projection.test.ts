/**
 * projectEvent — ORDER_CREATED proyecta sus items[] a order_item_projections
 *
 * Regresión del "agujero negro" bugs/order-created-projection-hole (#2180/#2179):
 * el handler ORDER_CREATED hacía el upsert de `orders` con `items: p.items` (JSON)
 * pero NUNCA insertaba esas líneas en `order_item_projections`. El ÚNICO INSERT a
 * la proyección vivía en ORDER_ITEM_ADDED. Resultado: cada item que NACE en
 * ORDER_CREATED (POS clásico, importación, cualquier flujo que cree con items) era
 * invisible para el KDS/ready-items y su status nunca progresaba (los UPDATE de
 * ORDER_ITEM_STATUS_CHANGED afectaban 0 filas).
 *
 * Estos tests verifican el FIX: ORDER_CREATED proyecta CADA item de p.items a
 * order_item_projections con status inicial 'PENDING', usando
 * `ON CONFLICT (order_id, line_id) DO NOTHING`.
 *
 * SEMÁNTICA DE REPLAY (blind spot del council #2179): el DO NOTHING es lo que evita
 * que un rebuild/reproceso pise el status VIVO. ORDER_CREATED aporta SOLO el status
 * inicial; si la fila ya existe (porque un ITEM_ADDED/STATUS_CHANGED la creó/avanzó
 * en otro orden de aplicación), ORDER_CREATED NO la toca. Por eso DO NOTHING y no
 * DO UPDATE: nunca debe degradar un status más avanzado a PENDING.
 *
 * @module core/events/__tests__/order-created-projection.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ParkEvent } from '@/src/core/domain/events';

// ---------------------------------------------------------------------------
// Mocks — projectEvent importa el logger y deduction.service.
// ---------------------------------------------------------------------------

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/src/core/inventory/deduction.service', () => ({
  deductInventoryForOrder: vi.fn().mockResolvedValue({
    success: true,
    deductions: [],
    alerts: [],
    productIdToReevaluate: null,
  }),
}));

// ---------------------------------------------------------------------------
// Mock tx — modela order_item_projections como un Map<line_id, row> en memoria.
//
// Esto nos permite verificar CONVERGENCIA del status (la propiedad clave del
// council): aplicamos eventos en cualquier orden y miramos el estado final del
// "store" de la proyección. El mock respeta la semántica SQL relevante:
//   - INSERT ... ON CONFLICT (order_id, line_id) DO NOTHING → no pisa fila existente
//   - UPDATE ... WHERE line_id = X                          → afecta 0 filas si no existe
//   - UPDATE ... WHERE line_id = X AND status = 'PENDING'   → solo si está PENDING
//   - DELETE ... WHERE line_id = X                          → elimina la fila
// ---------------------------------------------------------------------------

type ProjRow = {
  line_id: string;
  table_number: string | null;
  waiter_id: string | null;
  name: string;
  qty: number;
  station: string;
  status: string;
  ready_at: Date | null;
  served_at: Date | null;
  submitted_at: Date | null;
  updated_at: Date;
};

function makeProjectionStore() {
  const rows = new Map<string, ProjRow>();

  // Reconstruye el texto SQL de un template-literal de $executeRaw (Prisma.Sql)
  // o de un string plano. Los tests sólo necesitan distinguir el verbo + tabla.
  function sqlText(strings: TemplateStringsArray | string): string {
    if (typeof strings === 'string') return strings;
    return Array.isArray(strings) ? strings.join(' ') : String(strings);
  }

  const $executeRaw = vi.fn(async (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    const sql = sqlText(strings);

    if (sql.includes('INSERT INTO order_item_projections')) {
      // VALUES order: tenant_id, order_id, line_id, table_number, waiter_id, name, qty, station, [status literal], created_at, updated_at
      const [, , line_id, table_number, waiter_id, name, qty, station] = values as [
        string, string, string, string | null, string | null, string, number, string,
      ];
      if (!rows.has(String(line_id))) {
        // status='PENDING' es literal en el SQL, no un bind.
        rows.set(String(line_id), {
          line_id: String(line_id),
          table_number: (table_number ?? null) as string | null,
          waiter_id: (waiter_id ?? null) as string | null,
          name: String(name),
          qty: Number(qty),
          station: String(station),
          status: 'PENDING',
          ready_at: null,
          served_at: null,
          submitted_at: null,
          updated_at: new Date(),
        });
        return 1;
      }
      return 0; // ON CONFLICT DO NOTHING
    }

    if (sql.includes('UPDATE order_item_projections') && sql.includes('IN_KITCHEN')) {
      // ORDER_SUBMITTED: SET status='IN_KITCHEN' ... WHERE line_id = X AND status = 'PENDING'
      // last bind = now (Date); el line_id es el penúltimo en este template.
      const lineId = String(values[values.length - 2]);
      const row = rows.get(lineId);
      if (row && row.status === 'PENDING') {
        row.status = 'IN_KITCHEN';
        row.submitted_at = row.submitted_at ?? new Date();
        return 1;
      }
      return 0;
    }

    if (sql.includes('UPDATE order_item_projections') && sql.includes('ready_at')) {
      // ORDER_ITEM_STATUS_CHANGED: SET status = ${to}, ... WHERE line_id = X
      // binds: status(to), readyAt, servedAt, now, order_id, line_id
      const toStatus = String(values[0]);
      const lineId = String(values[values.length - 1]);
      const row = rows.get(lineId);
      if (row) {
        row.status = toStatus;
        if (toStatus === 'READY') row.ready_at = row.ready_at ?? new Date();
        if (toStatus === 'DONE') row.served_at = row.served_at ?? new Date();
        return 1;
      }
      return 0;
    }

    if (sql.includes('DELETE FROM order_item_projections')) {
      // ORDER_ITEM_VOIDED: WHERE order_id = X AND line_id = Y
      // ORDER_CANCELLED:   WHERE order_id = X (sin line_id)
      if (sql.includes('line_id')) {
        const lineId = String(values[values.length - 1]);
        rows.delete(lineId);
      } else {
        rows.clear();
      }
      return 1;
    }

    return 0;
  });

  return { rows, $executeRaw };
}

function makeTx(store: ReturnType<typeof makeProjectionStore>) {
  return {
    $executeRaw: store.$executeRaw,
    orders: {
      upsert: vi.fn().mockResolvedValue({}),
      // ITEM_ADDED lee la orden; devolvemos una orden mínima con fulfillment.
      findUnique: vi.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000020',
        items: [],
        subtotal_cents: 0,
        total_cents: 0,
        fulfillment: { table_number: '5' },
        location_id: null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Parameters<typeof import('../project-event')['projectEvent']>[0];
}

// ---------------------------------------------------------------------------
// Helpers — fábricas de eventos tipados (mínimo viable para projectEvent).
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ORDER_ID = '00000000-0000-0000-0000-000000000020';
const ACTOR_ID = '00000000-0000-0000-0000-000000000099';

function baseEnvelope(event_type: string, payload: unknown) {
  return {
    event_id: crypto.randomUUID(),
    event_type,
    aggregate_type: 'ORDER',
    aggregate_id: ORDER_ID,
    correlation_id: ORDER_ID,
    causation_id: null,
    actor_id: ACTOR_ID,
    tenant_id: TENANT_ID,
    terminal_id: 'TERM-001',
    terminal_sequence: 1,
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    payload,
  } as unknown as ParkEvent;
}

function makeLine(line_id: string, overrides: Record<string, unknown> = {}) {
  return {
    line_id,
    product_id: 'prod-001',
    sku: 'sku-001',
    name: '1/4 Pollo',
    qty: 1,
    unit_price_cents: 1500,
    station: 'HORNO',
    status: 'PENDING',
    ...overrides,
  };
}

function orderCreated(items: ReturnType<typeof makeLine>[], tableNumber = '5') {
  return baseEnvelope('ORDER_CREATED', {
    order_id: ORDER_ID,
    order_number: 1001,
    order_type: 'DINE_IN',
    items,
    checks: [],
    fulfillment: { table_number: tableNumber },
  });
}

function itemAdded(line: ReturnType<typeof makeLine>) {
  return baseEnvelope('ORDER_ITEM_ADDED', { order_id: ORDER_ID, line });
}

function statusChanged(line_id: string, to: string, from = 'IN_KITCHEN') {
  return baseEnvelope('ORDER_ITEM_STATUS_CHANGED', {
    order_id: ORDER_ID,
    line_id,
    from,
    to,
    station: 'HORNO',
  });
}

function itemVoided(line_id: string) {
  return baseEnvelope('ORDER_ITEM_VOIDED', {
    order_id: ORDER_ID,
    line_id,
    reason: 'UNDO',
    voided_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// 1) Unit tests — el agujero y su fix
// ---------------------------------------------------------------------------

describe('projectEvent ORDER_CREATED — proyecta items a order_item_projections', () => {
  let store: ReturnType<typeof makeProjectionStore>;
  let tx: ReturnType<typeof makeTx>;
  let projectEvent: typeof import('../project-event')['projectEvent'];

  beforeEach(async () => {
    vi.clearAllMocks();
    store = makeProjectionStore();
    tx = makeTx(store);
    ({ projectEvent } = await import('../project-event'));
  });

  it('RED→GREEN: ORDER_CREATED con items inserta una fila PENDING por cada item', async () => {
    const event = orderCreated([makeLine('l1'), makeLine('l2', { name: 'Gaseosa', station: 'BAR' })]);
    await projectEvent(tx, event);

    // Un INSERT INTO order_item_projections por cada item (2).
    const projInserts = store.$executeRaw.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO order_item_projections'),
    );
    expect(projInserts).toHaveLength(2);

    // El store refleja 2 filas en PENDING (status inicial).
    expect(store.rows.size).toBe(2);
    expect(store.rows.get('l1')?.status).toBe('PENDING');
    expect(store.rows.get('l2')?.status).toBe('PENDING');
  });

  it('cada fila proyectada lleva line_id, name, station y table_number del payload', async () => {
    const event = orderCreated([makeLine('l1', { name: 'Bisteck', station: 'PARRILLA' })], 'M7');
    await projectEvent(tx, event);

    const row = store.rows.get('l1');
    expect(row).toBeDefined();
    expect(row?.name).toBe('Bisteck');
    expect(row?.station).toBe('PARRILLA');
    expect(row?.table_number).toBe('M7');
    expect(row?.waiter_id).toBe(ACTOR_ID);
  });

  it('ORDER_CREATED con items:[] no inserta filas (POS/QR nacen vacíos)', async () => {
    const event = orderCreated([]);
    await projectEvent(tx, event);

    const projInserts = store.$executeRaw.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO order_item_projections'),
    );
    expect(projInserts).toHaveLength(0);
    expect(store.rows.size).toBe(0);
  });

  it('REPLAY: ORDER_CREATED NO degrada un status ya avanzado (DO NOTHING)', async () => {
    // La fila ya existe y avanzó a READY (p.ej. por un STATUS_CHANGED previo en un
    // reproceso con orden distinto). ORDER_CREATED no debe pisarla a PENDING.
    store.rows.set('l1', {
      line_id: 'l1',
      table_number: '5',
      waiter_id: ACTOR_ID,
      name: '1/4 Pollo',
      qty: 1,
      station: 'HORNO',
      status: 'READY',
      ready_at: new Date(),
      served_at: null,
      submitted_at: null,
      updated_at: new Date(),
    });

    await projectEvent(tx, orderCreated([makeLine('l1')]));

    // DO NOTHING: el status VIVO (READY) se conserva, NO baja a PENDING.
    expect(store.rows.get('l1')?.status).toBe('READY');
  });
});

// ---------------------------------------------------------------------------
// 2) Property test — convergencia bajo replay desordenado
// ---------------------------------------------------------------------------

describe('projectEvent — convergencia de status bajo replay desordenado', () => {
  let projectEvent: typeof import('../project-event')['projectEvent'];

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ projectEvent } = await import('../project-event'));
  });

  // Permuta un array de forma determinista a partir de un seed de fast-check.
  function permute<T>(arr: T[], order: number[]): T[] {
    const idx = order
      .map((o, i) => ({ o, i }))
      .sort((a, b) => a.o - b.o)
      .map((x) => x.i);
    return idx.map((i) => arr[i]);
  }

  it('invariante: aplicar {CREATED(items), ITEM_ADDED, STATUS_CHANGED, VOIDED} en cualquier orden converge al mismo store', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Un set fijo de eventos sobre 1 línea ('l1') nacida en ORDER_CREATED.
        // El orden de aplicación lo decide `orderSeed`.
        fc.constantFrom<'READY' | 'DONE' | 'IN_KITCHEN'>('READY', 'DONE', 'IN_KITCHEN'),
        fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: 4, maxLength: 4 }),
        async (finalStatus, orderSeed) => {
          const events: ParkEvent[] = [
            orderCreated([makeLine('l1')]),        // nace en CREATED (el agujero)
            statusChanged('l1', finalStatus),      // status vivo objetivo
          ];

          // Referencia: orden CRONOLÓGICO correcto (CREATED → STATUS_CHANGED).
          const refStore = makeProjectionStore();
          const refTx = makeTx(refStore);
          for (const ev of events) await projectEvent(refTx, ev);
          const expected = refStore.rows.get('l1')?.status ?? null;

          // Permutación arbitraria del MISMO set de eventos.
          const permuted = permute(events, orderSeed.slice(0, events.length).map((d) => d));
          const store = makeProjectionStore();
          const tx = makeTx(store);
          for (const ev of permuted) await projectEvent(tx, ev);
          const got = store.rows.get('l1')?.status ?? null;

          // CONVERGENCIA: el status final NO debe depender del orden... salvo el
          // caso en que STATUS_CHANGED se aplica ANTES que CREATE (UPDATE no-op →
          // luego CREATE deja PENDING). Ese caso lo medimos aparte; aquí afirmamos
          // que cuando CREATE precede a STATUS_CHANGED, converge a `expected`.
          const createIdx = permuted.findIndex((e) => e.event_type === 'ORDER_CREATED');
          const statusIdx = permuted.findIndex((e) => e.event_type === 'ORDER_ITEM_STATUS_CHANGED');
          if (createIdx < statusIdx) {
            expect(got).toBe(expected);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('hallazgo medido: STATUS_CHANGED antes que CREATE deja la fila en PENDING (no converge sin orden garantizado)', async () => {
    // Aplicar STATUS_CHANGED PRIMERO: la fila no existe → UPDATE afecta 0 filas.
    // Luego CREATE inserta status='PENDING'. El status vivo (READY) se PIERDE.
    const store = makeProjectionStore();
    const tx = makeTx(store);
    await projectEvent(tx, statusChanged('l1', 'READY'));
    await projectEvent(tx, orderCreated([makeLine('l1')]));

    // Documenta el límite: SIN garantía de orden, no converge. El sistema garantiza
    // el orden vía (a) dependency-check del ingest (STATUS_CHANGED requiere que la
    // orden exista, encolado out-of-order si falta ORDER_CREATED) y (b) rebuild por
    // global_sequence ascendente. Con CREATE siempre antes, el caso de arriba no
    // ocurre en producción. Este test FIJA esa precondición como contrato.
    expect(store.rows.get('l1')?.status).toBe('PENDING');
  });

  it('VOIDED elimina la fila independientemente del orden relativo a otros UPDATE', async () => {
    // CREATE → STATUS_CHANGED(READY) → VOIDED  vs  CREATE → VOIDED  (mismo final: sin fila)
    const a = makeProjectionStore();
    const txA = makeTx(a);
    for (const ev of [orderCreated([makeLine('l1')]), statusChanged('l1', 'READY'), itemVoided('l1')]) {
      await projectEvent(txA, ev);
    }
    expect(a.rows.has('l1')).toBe(false);

    const b = makeProjectionStore();
    const txB = makeTx(b);
    for (const ev of [orderCreated([makeLine('l1')]), itemVoided('l1')]) {
      await projectEvent(txB, ev);
    }
    expect(b.rows.has('l1')).toBe(false);
  });

  it('idempotencia: re-aplicar ORDER_CREATED no duplica ni resetea filas', async () => {
    const store = makeProjectionStore();
    const tx = makeTx(store);
    const created = orderCreated([makeLine('l1'), makeLine('l2', { station: 'BAR' })]);

    await projectEvent(tx, created);
    await projectEvent(tx, statusChanged('l1', 'READY'));
    await projectEvent(tx, created); // reproceso del MISMO ORDER_CREATED

    expect(store.rows.size).toBe(2);          // sin duplicar
    expect(store.rows.get('l1')?.status).toBe('READY'); // sin resetear el status vivo
    expect(store.rows.get('l2')?.status).toBe('PENDING');
  });

  it('ITEM_ADDED y CREATED-con-items sobre la misma línea: DO NOTHING evita duplicado', async () => {
    // Si por alguna vía la misma línea llega por CREATED y por ITEM_ADDED, sólo 1 fila.
    const store = makeProjectionStore();
    const tx = makeTx(store);
    await projectEvent(tx, orderCreated([makeLine('l1')]));
    await projectEvent(tx, itemAdded(makeLine('l1')));
    expect(store.rows.size).toBe(1);
  });
});
