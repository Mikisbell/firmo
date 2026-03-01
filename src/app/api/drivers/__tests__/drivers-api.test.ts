/**
 * Drivers API Integration Tests
 *
 * Tests GET /api/drivers (list drivers with pagination and status enrichment)
 * and POST /api/drivers (create driver with admin auth).
 * Validates auth guard, tenant isolation, input validation, and error handling.
 *
 * @module app/api/drivers/__tests__/drivers-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDriverCreate = vi.fn();
vi.mock('@/src/core/delivery', () => ({
  DriverService: {
    create: (...args: any[]) => mockDriverCreate(...args),
  },
  DriverServiceError: class DriverServiceError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode = 400) {
      super(message);
      this.name = 'DriverServiceError';
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

const mockDriversCount = vi.fn();
const mockDriversFindMany = vi.fn();
const mockDeliveryOrdersCount = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    drivers: {
      count: (...args: any[]) => mockDriversCount(...args),
      findMany: (...args: any[]) => mockDriversFindMany(...args),
    },
    delivery_orders: {
      count: (...args: any[]) => mockDeliveryOrdersCount(...args),
    },
  },
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: () => 'tenant-drv-001',
}));

const mockAdminAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAdminAuth(...args),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function adminAuthed() {
  mockAdminAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      name: 'Admin User',
      tenantId: 'tenant-drv-001',
      sessionId: 'session-1',
    },
  });
}

function unauthorized() {
  mockAdminAuth.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'No autenticado. Por favor inicie sesion.' }),
      { status: 401 },
    ),
  });
}

function forbidden() {
  mockAdminAuth.mockResolvedValue({
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'Acceso denegado. Se requiere rol de ADMIN o MANAGER.' }),
      { status: 403 },
    ),
  });
}

function makePostRequest(body: any) {
  return new NextRequest('http://localhost/api/drivers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/drivers');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests: POST /api/drivers
// ---------------------------------------------------------------------------

describe('POST /api/drivers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminAuthed();
  });

  it('debe crear driver exitosamente con admin auth', async () => {
    const fakeDriver = { id: 'drv-1', name: 'Carlos Lopez', phone: '999111222', is_active: true };
    mockDriverCreate.mockResolvedValue(fakeDriver);

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Carlos Lopez', phone: '999111222' }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('drv-1');
    expect(data.name).toBe('Carlos Lopez');
  });

  it('debe usar tenant_id de config al crear driver', async () => {
    mockDriverCreate.mockResolvedValue({ id: 'drv-2', name: 'Test' });

    const { POST } = await import('../route');
    await POST(makePostRequest({ name: 'Test Driver' }));

    expect(mockDriverCreate).toHaveBeenCalledWith(
      'tenant-drv-001',
      'Test Driver',
      undefined,
    );
  });

  it('debe rechazar sin auth (401)', async () => {
    unauthorized();

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Carlos' }));

    expect(res.status).toBe(401);
  });

  it('debe rechazar con rol insuficiente (403)', async () => {
    forbidden();

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Carlos' }));

    expect(res.status).toBe(403);
  });

  it('debe rechazar nombre vacio', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: '' }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe rechazar sin campo name', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ phone: '999111222' }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe rechazar telefono menor a 9 caracteres', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Carlos', phone: '1234' }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('validaci');
  });

  it('debe crear driver sin telefono (opcional)', async () => {
    mockDriverCreate.mockResolvedValue({ id: 'drv-3', name: 'Pedro', phone: null });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Pedro' }));

    expect(res.status).toBe(201);
    expect(mockDriverCreate).toHaveBeenCalledWith(
      'tenant-drv-001',
      'Pedro',
      undefined,
    );
  });

  it('debe propagar DriverServiceError con su status code', async () => {
    const { DriverServiceError } = await import('@/src/core/delivery');
    mockDriverCreate.mockRejectedValue(
      new DriverServiceError('Duplicate driver name', 'DUPLICATE', 409),
    );

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Duplicado' }));

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('DUPLICATE');
  });

  it('debe retornar 500 ante error inesperado', async () => {
    mockDriverCreate.mockRejectedValue(new Error('Unexpected'));

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({ name: 'Error Test' }));

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error interno');
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/drivers
// ---------------------------------------------------------------------------

describe('GET /api/drivers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDriversCount.mockResolvedValue(2);
    mockDriversFindMany.mockResolvedValue([
      { id: 'drv-1', name: 'Carlos', phone: '999111222', is_active: true },
      { id: 'drv-2', name: 'Pedro', phone: '999333444', is_active: true },
    ]);
    // First driver busy, second available
    mockDeliveryOrdersCount.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
  });

  it('debe listar drivers con estado enriquecido', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.drivers).toHaveLength(2);
    expect(data.drivers[0].status).toBe('BUSY');
    expect(data.drivers[0].active_deliveries).toBe(1);
    expect(data.drivers[1].status).toBe('AVAILABLE');
    expect(data.drivers[1].active_deliveries).toBe(0);
  });

  it('debe filtrar drivers por tenant_id de config', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockDriversFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: 'tenant-drv-001' },
      }),
    );
  });

  it('debe incluir paginacion en respuesta', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ page: '1', pageSize: '10' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
    expect(data.pagination.page).toBe(1);
  });

  it('debe ordenar drivers por nombre ascendente', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockDriversFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      }),
    );
  });

  it('debe retornar 500 ante error de base de datos', async () => {
    mockDriversCount.mockRejectedValue(new Error('DB down'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error interno');
  });
});
