/**
 * Delivery API Integration Tests
 *
 * Tests POST /api/delivery (create delivery order) and GET /api/delivery (list deliveries).
 * Validates tenant isolation (tenant_id from config, not client), input validation via Zod,
 * pagination, and service-layer error propagation.
 *
 * @module app/api/delivery/__tests__/delivery-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateDeliveryOrder = vi.fn();
vi.mock('@/src/core/delivery', () => ({
  DeliveryService: {
    createDeliveryOrder: (...args: any[]) => mockCreateDeliveryOrder(...args),
  },
  DeliveryServiceError: class DeliveryServiceError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode = 400) {
      super(message);
      this.name = 'DeliveryServiceError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    delivery_orders: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// El route ahora obtiene tenant_id desde requirePosAuth (authResult.user.tenantId),
// NO desde getTenantId/config. Mockeamos el guard de auth para que devuelva un
// usuario autorizado con el tenant esperado.
const mockAuth = vi.fn();
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: (...args: any[]) => mockAuth(...args),
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: { invalidatePattern: vi.fn().mockResolvedValue(undefined) },
}));

// El logger ahora expone createLogger además de la instancia logger.
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

// El POST dispara notificación WhatsApp fire-and-forget; mockear para aislar.
vi.mock('@/src/core/delivery/whatsapp-tracking', () => ({
  sendDeliveryTrackingWhatsApp: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: any) {
  return new NextRequest('http://localhost/api/delivery', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/delivery');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// Configura requirePosAuth como usuario autorizado con el tenant de prueba.
function authed() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-test-001', role: 'CASHIER', terminalId: 'term-1' },
  });
}

const VALID_DELIVERY_BODY = {
  orderId: '11111111-1111-1111-1111-111111111111',
  addressText: 'Av. Javier Prado 1234, San Isidro',
  customerPhone: '999888777',
  deliveryFee: 500,
};

// ---------------------------------------------------------------------------
// Tests: POST /api/delivery
// ---------------------------------------------------------------------------

describe('POST /api/delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe crear delivery exitosamente con datos validos', async () => {
    const fakeDelivery = {
      id: 'del-1',
      orderId: VALID_DELIVERY_BODY.orderId,
      status: 'PENDING',
      addressText: VALID_DELIVERY_BODY.addressText,
      customerPhone: VALID_DELIVERY_BODY.customerPhone,
      deliveryFee: 500,
    };
    mockCreateDeliveryOrder.mockResolvedValue(fakeDelivery);

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(VALID_DELIVERY_BODY));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('del-1');
    expect(data.status).toBe('PENDING');
  });

  it('debe usar tenant_id de config, no del cliente', async () => {
    mockCreateDeliveryOrder.mockResolvedValue({ id: 'del-2', status: 'PENDING' });

    const { POST } = await import('../route');
    await POST(makePostRequest({
      ...VALID_DELIVERY_BODY,
      tenantId: 'tenant-malicioso',
    }));

    expect(mockCreateDeliveryOrder).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-test-001' }),
    );
    // Should NOT pass the client-supplied tenantId
    expect(mockCreateDeliveryOrder).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-malicioso' }),
    );
  });

  it('debe rechazar orderId no UUID', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      ...VALID_DELIVERY_BODY,
      orderId: 'not-a-uuid',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe rechazar direccion menor a 10 caracteres', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      ...VALID_DELIVERY_BODY,
      addressText: 'Corta',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe rechazar telefono menor a 9 caracteres', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      ...VALID_DELIVERY_BODY,
      customerPhone: '1234',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe rechazar deliveryFee negativo', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      ...VALID_DELIVERY_BODY,
      deliveryFee: -100,
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe propagar DeliveryServiceError con su status code', async () => {
    const { DeliveryServiceError } = await import('@/src/core/delivery');
    mockCreateDeliveryOrder.mockRejectedValue(
      new DeliveryServiceError('Order not found', 'NOT_FOUND', 404),
    );

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(VALID_DELIVERY_BODY));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.code).toBe('NOT_FOUND');
  });

  it('debe retornar 500 ante error inesperado', async () => {
    mockCreateDeliveryOrder.mockRejectedValue(new Error('DB connection failed'));

    const { POST } = await import('../route');
    const res = await POST(makePostRequest(VALID_DELIVERY_BODY));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error interno');
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/delivery
// ---------------------------------------------------------------------------

describe('GET /api/delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe listar deliveries con paginacion', async () => {
    const prisma = (await import('@/src/core/db/prisma')).default;
    (prisma.delivery_orders.count as any).mockResolvedValue(2);
    (prisma.delivery_orders.findMany as any).mockResolvedValue([
      { id: 'del-1', status: 'PENDING', drivers: null },
      { id: 'del-2', status: 'ASSIGNED', drivers: { id: 'd1', name: 'Carlos', phone: '999' } },
    ]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ page: '1', pageSize: '10' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deliveries).toHaveLength(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  it('debe filtrar por tenant_id de config', async () => {
    const prisma = (await import('@/src/core/db/prisma')).default;
    (prisma.delivery_orders.count as any).mockResolvedValue(0);
    (prisma.delivery_orders.findMany as any).mockResolvedValue([]);

    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(prisma.delivery_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-test-001' }),
      }),
    );
  });

  it('debe filtrar por status personalizado', async () => {
    const prisma = (await import('@/src/core/db/prisma')).default;
    (prisma.delivery_orders.count as any).mockResolvedValue(0);
    (prisma.delivery_orders.findMany as any).mockResolvedValue([]);

    const { GET } = await import('../route');
    await GET(makeGetRequest({ status: 'DELIVERED' }));

    expect(prisma.delivery_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ['DELIVERED'] } }),
      }),
    );
  });

  it('debe usar statuses por defecto: PENDING, ASSIGNED, DISPATCHED', async () => {
    const prisma = (await import('@/src/core/db/prisma')).default;
    (prisma.delivery_orders.count as any).mockResolvedValue(0);
    (prisma.delivery_orders.findMany as any).mockResolvedValue([]);

    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(prisma.delivery_orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['PENDING', 'ASSIGNED', 'DISPATCHED'] },
        }),
      }),
    );
  });

  it('debe retornar 500 ante error de base de datos', async () => {
    const prisma = (await import('@/src/core/db/prisma')).default;
    (prisma.delivery_orders.count as any).mockRejectedValue(new Error('DB down'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error interno');
  });
});
