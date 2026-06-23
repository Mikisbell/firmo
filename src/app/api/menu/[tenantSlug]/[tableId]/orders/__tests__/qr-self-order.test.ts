/**
 * QR self-order POST — entra por la arquitectura event-sourced
 *
 * Regresión del incidente bugs/qr-portal-bypasses-event-sourcing (#2181):
 * el endpoint público del portal QR creaba la orden con `prisma.orders.create`
 * DIRECTO, sin emitir eventos ni proyectar a order_item_projections → los items
 * eran invisibles para el KDS/ready-items y su status nunca progresaba.
 *
 * Estos tests verifican el FIX: el POST ahora emite ORDER_CREATED + N
 * ORDER_ITEM_ADDED, los proyecta vía `projectEvent` (INSERT en
 * order_item_projections) y persiste cada evento en `events`.
 *
 * @module app/api/menu/[tenantSlug]/[tableId]/orders/__tests__/qr-self-order.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — prisma (singleton) con un tx que ejecuta projectEvent/markAsProcessed
// reales contra estos mocks.
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-0000-0000-0000000000aa';
const TABLE_ID = '00000000-0000-0000-0000-0000000000bb';
const PRODUCT_1 = '00000000-0000-0000-0000-000000000001';
const PRODUCT_2 = '00000000-0000-0000-0000-000000000002';

// Estado de la "orden" que projectEvent crea/lee dentro de la tx.
let createdOrder: any = null;

const txExecuteRaw = vi.fn();
const txEventsCreate = vi.fn().mockResolvedValue({});
const txOrdersCreate = vi.fn().mockResolvedValue({});

const tx = {
  // markAsProcessed: INSERT ... processed_events ON CONFLICT DO NOTHING → filas (1 = nuevo)
  // projectEvent ITEM_ADDED: INSERT INTO order_item_projections ...
  $executeRaw: txExecuteRaw,
  orders: {
    upsert: vi.fn(async ({ create }: any) => {
      createdOrder = {
        ...create,
        items: create.items ?? [],
        subtotal_cents: 0,
        total_cents: 0,
        fulfillment: null,
        location_id: null,
      };
      return createdOrder;
    }),
    findUnique: vi.fn(async () => createdOrder),
    update: vi.fn(async ({ data }: any) => {
      if (createdOrder) Object.assign(createdOrder, data);
      return createdOrder;
    }),
  },
  events: { create: txEventsCreate },
  // Si alguien intentara el create directo (bug viejo), lo detectamos.
  __ordersCreate: txOrdersCreate,
};

const prismaMock = {
  $transaction: vi.fn(async (fn: (t: any) => Promise<any>) => fn(tx)),
  tenants: { findFirst: vi.fn() },
  tables: { findFirst: vi.fn() },
  products: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  // Bug viejo: prisma.orders.create directo. Debe quedar SIN usar.
  orders: { create: txOrdersCreate },
};

vi.mock('@/src/core/db/prisma', () => ({ default: prismaMock }));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// deduction.service no se ejecuta para ORDER_CREATED/ORDER_ITEM_ADDED, pero
// projectEvent lo importa: lo mockeamos por seguridad.
vi.mock('@/src/core/inventory/deduction.service', () => ({
  deductInventoryForOrder: vi.fn().mockResolvedValue({ success: true, deductions: [], alerts: [], productIdToReevaluate: null }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// El rate limiting es in-memory por clave `tenantSlug:tableId` y persiste entre
// tests (módulo cacheado). Para no contaminar entre casos, cada test usa un slug
// único salvo el test que verifica explícitamente el rate limit.
let slugCounter = 0;
function freshContext() {
  slugCounter += 1;
  const slug = `polleria-${slugCounter}`;
  return {
    slug,
    context: { params: Promise.resolve({ tenantSlug: slug, tableId: TABLE_ID }) },
  };
}

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/menu/polleria/${TABLE_ID}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function seedHappyPath() {
  prismaMock.tenants.findFirst.mockResolvedValue({ id: TENANT_ID });
  prismaMock.tables.findFirst.mockResolvedValue({ id: TABLE_ID, number: '5', display_name: 'Mesa 5' });
  prismaMock.products.findMany.mockResolvedValue([
    { id: PRODUCT_1, name: '1/4 Pollo', price_cents: 1500, sku: 'POLLO-14', station: 'HORNO' },
    { id: PRODUCT_2, name: 'Gaseosa', price_cents: 500, sku: 'GAS-01', station: 'BAR' },
  ]);
  prismaMock.$queryRaw.mockResolvedValue([{ max_num: 1042 }]);
  // markAsProcessed (INSERT processed_events) → 1 (no duplicado).
  // projectEvent ITEM_ADDED (INSERT order_item_projections) → 1.
  txExecuteRaw.mockResolvedValue(1);
}

const validBody = {
  items: [
    { product_id: PRODUCT_1, name: '1/4 Pollo', price_cents: 1500, qty: 2 },
    { product_id: PRODUCT_2, name: 'Gaseosa', price_cents: 500, qty: 1 },
  ],
  customerName: 'Juan',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QR self-order POST — event-sourced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdOrder = null;
    seedHappyPath();
  });

  it('proyecta cada item a order_item_projections (INSERT por línea)', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    const res = await POST(makeRequest(validBody), context);
    expect(res.status).toBe(200);

    // Un INSERT INTO order_item_projections por cada item (2).
    const projInserts = txExecuteRaw.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO order_item_projections'),
    );
    expect(projInserts).toHaveLength(2);
  });

  it('persiste ORDER_CREATED + N ORDER_ITEM_ADDED en la tabla events', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    await POST(makeRequest(validBody), context);

    const types = txEventsCreate.mock.calls.map((c) => c[0].data.type);
    expect(types).toContain('ORDER_CREATED');
    expect(types.filter((t: string) => t === 'ORDER_ITEM_ADDED')).toHaveLength(2);
    // 1 ORDER_CREATED + 2 ORDER_ITEM_ADDED
    expect(types).toHaveLength(3);
  });

  it('NO usa prisma.orders.create directo (bug viejo erradicado)', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    await POST(makeRequest(validBody), context);
    expect(txOrdersCreate).not.toHaveBeenCalled();
  });

  it('el item proyectado lleva el line_id qr_N y la mesa (visible para KDS/ready-items)', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    await POST(makeRequest(validBody), context);

    const projInserts = txExecuteRaw.mock.calls.filter((call) =>
      String(call[0]).includes('INSERT INTO order_item_projections'),
    );
    // line_ids qr_1 y qr_2 entre los binds de los INSERT.
    const allBinds = projInserts.flatMap((c) => c.slice(1));
    expect(allBinds).toContain('qr_1');
    expect(allBinds).toContain('qr_2');
    // table_number '5' (la proyección lo lee de order.fulfillment, seteado
    // antes de proyectar los ITEM_ADDED).
    expect(allBinds).toContain('5');
  });

  it('crea la orden vía projectEvent (orders.upsert) con table_id de servidor', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    await POST(makeRequest(validBody), context);

    expect(tx.orders.upsert).toHaveBeenCalledTimes(1);
    // El UPDATE de columnas QR-específicas setea table_id (la GET filtra por él).
    const updateWithTable = tx.orders.update.mock.calls.find(
      (c) => c[0]?.data?.table_id === TABLE_ID,
    );
    expect(updateWithTable).toBeDefined();
  });

  it('responde {success, orderNumber, orderId}', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    const res = await POST(makeRequest(validBody), context);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.orderNumber).toBe(1043); // max_num 1042 + 1
    expect(typeof json.orderId).toBe('string');
    expect(json.orderId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

// ---------------------------------------------------------------------------
// Regresión: validación y rate limiting siguen funcionando
// ---------------------------------------------------------------------------

describe('QR self-order POST — validación y rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createdOrder = null;
    seedHappyPath();
  });

  it('rechaza precio desactualizado (409) sin emitir eventos', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    const badPrice = {
      items: [{ product_id: PRODUCT_1, name: '1/4 Pollo', price_cents: 999, qty: 1 }],
    };
    const res = await POST(makeRequest(badPrice), context);
    expect(res.status).toBe(409);
    expect(txEventsCreate).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rechaza producto inexistente (400)', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    prismaMock.products.findMany.mockResolvedValue([]); // ninguno disponible
    const res = await POST(makeRequest(validBody), context);
    expect(res.status).toBe(400);
    expect(txEventsCreate).not.toHaveBeenCalled();
  });

  it('rechaza body inválido (400)', async () => {
    const { POST } = await import('../route');
    const { context } = freshContext();
    const res = await POST(makeRequest({ items: [] }), context);
    expect(res.status).toBe(400);
  });

  it('rate limit: al 4to pedido devuelve 429', async () => {
    const { POST } = await import('../route');
    // Mismo contexto (misma clave de rate limit) para los 4 intentos.
    const { context } = freshContext();
    // 3 pedidos OK (límite 3/hora/mesa).
    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest(validBody), context);
      expect(res.status).toBe(200);
    }
    const limited = await POST(makeRequest(validBody), context);
    expect(limited.status).toBe(429);
  });
});
