/**
 * Tests for /api/admin/customers (GET + POST)
 * and /api/admin/customers/[id] (GET + PUT + DELETE)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT
 * - GET list: cache.set with tags: ['customers']
 * - POST/PUT/DELETE: cache.deleteByTag('customers') called
 * - POST: 409 on duplicate phone or doc_number
 * - DELETE: 409 when customer has open orders
 * - PUT: 404 when customer not found in tenant scope
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockCustomersCount,
  mockCustomersFindMany,
  mockCustomersFindFirst,
  mockCustomersCreate,
  mockCustomersUpdate,
  mockCustomersDelete,
  mockOrdersCount,
  mockTransaction,
  mockCacheGet,
  mockCacheSet,
  mockDeleteByTag,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockCustomersCount: vi.fn(),
  mockCustomersFindMany: vi.fn(),
  mockCustomersFindFirst: vi.fn(),
  mockCustomersCreate: vi.fn(),
  mockCustomersUpdate: vi.fn(),
  mockCustomersDelete: vi.fn(),
  mockOrdersCount: vi.fn(),
  mockTransaction: vi.fn(),
  mockCacheGet: vi.fn<() => Promise<unknown>>(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockDeleteByTag: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    customers: {
      count: mockCustomersCount,
      findMany: mockCustomersFindMany,
      findFirst: mockCustomersFindFirst,
      create: mockCustomersCreate,
      update: mockCustomersUpdate,
      delete: mockCustomersDelete,
    },
    orders: { count: mockOrdersCount },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    deleteByTag: mockDeleteByTag,
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
}));

vi.mock('@/src/core/observability/logger-pino', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createRequestLogger: vi.fn(() => noop), logPerformance: vi.fn(), logAudit: vi.fn() };
});

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn(), set: vi.fn() },
}));

vi.mock('@/src/lib/pagination', () => ({
  parsePaginationParams: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
  createPaginatedResponse: vi.fn((items: any[], total: number) => ({
    items,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: false, hasPrev: false },
  })),
}));

import { GET, POST } from '../route';
import { GET as GETById, PUT, DELETE } from '../[id]/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const baseCustomer = {
  id: CUSTOMER_ID,
  tenant_id: TENANT_ID,
  phone: '987654321',
  name: 'Juan Pérez',
  email: 'juan@example.com',
  doc_type: 'DNI',
  doc_number: '12345678',
  total_orders: 5,
  total_spent: 25000,
  last_order_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeListRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/customers${query}`, {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
  });
}

function makePostRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/customers', {
    method: 'POST',
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDetailRequest(id: string, method: 'GET' | 'PUT' | 'DELETE', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/customers/${id}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', name: 'Test Admin', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/customers ──────────────────────────────────────────────────

describe('GET /api/admin/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCustomersCount.mockResolvedValue(1);
    mockCustomersFindMany.mockResolvedValue([baseCustomer]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeListRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated customers', async () => {
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.pagination).toBeDefined();
  });

  it('queries with tenant_id from JWT', async () => {
    await GET(makeListRequest());
    expect(mockCustomersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ items: [baseCustomer], pagination: {} });
    const res = await GET(makeListRequest());
    expect(res.status).toBe(200);
    expect(mockCustomersFindMany).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags: [customers]', async () => {
    await GET(makeListRequest());
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['customers'] }),
    );
  });

  it('filters by search query', async () => {
    await GET(makeListRequest('?search=juan'));
    expect(mockCustomersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    );
  });

  it('returns 400 on invalid doc_type filter', async () => {
    const res = await GET(makeListRequest('?doc_type=INVALID'));
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/customers ────────────────────────────────────────────────

describe('POST /api/admin/customers', () => {
  const validPayload = { phone: '987654321', name: 'Juan Pérez' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCustomersFindFirst.mockResolvedValue(null); // no duplicates
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        customers: { create: vi.fn().mockResolvedValue(baseCustomer) },
        admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('creates customer and returns 201', async () => {
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(201);
  });

  it('invalidates cache with deleteByTag after create', async () => {
    await POST(makePostRequest(validPayload));
    expect(mockDeleteByTag).toHaveBeenCalledWith('customers');
  });

  it('returns 409 on duplicate phone', async () => {
    mockCustomersFindFirst.mockResolvedValue(baseCustomer); // phone duplicate
    const res = await POST(makePostRequest(validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('teléfono');
  });

  it('returns 409 on duplicate doc_number', async () => {
    mockCustomersFindFirst
      .mockResolvedValueOnce(baseCustomer)  // doc duplicate check
      .mockResolvedValue(null);             // phone check
    const res = await POST(makePostRequest({ ...validPayload, doc_type: 'DNI', doc_number: '12345678' }));
    expect(res.status).toBe(409);
  });

  it('returns 400 on missing phone', async () => {
    const res = await POST(makePostRequest({ name: 'Juan' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when doc_type given without doc_number', async () => {
    const res = await POST(makePostRequest({ ...validPayload, doc_type: 'DNI' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid DNI (not 8 digits)', async () => {
    const res = await POST(makePostRequest({ ...validPayload, doc_type: 'DNI', doc_number: '123' }));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/customers/[id] ────────────────────────────────────────────

describe('GET /api/admin/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCustomersFindFirst.mockResolvedValue(baseCustomer);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETById(makeDetailRequest(CUSTOMER_ID, 'GET'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 with customer data', async () => {
    const res = await GETById(makeDetailRequest(CUSTOMER_ID, 'GET'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(CUSTOMER_ID);
    expect(body.phone).toBe('987654321');
  });

  it('queries with tenant_id from JWT', async () => {
    await GETById(makeDetailRequest(CUSTOMER_ID, 'GET'), routeParams(CUSTOMER_ID));
    expect(mockCustomersFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: CUSTOMER_ID, tenant_id: TENANT_ID }),
      }),
    );
  });

  it('returns 404 when customer not found', async () => {
    mockCustomersFindFirst.mockResolvedValue(null);
    const res = await GETById(makeDetailRequest(CUSTOMER_ID, 'GET'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(404);
  });
});

// ─── PUT /api/admin/customers/[id] ────────────────────────────────────────────

describe('PUT /api/admin/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCustomersFindFirst.mockResolvedValue(baseCustomer);
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        customers: { update: vi.fn().mockResolvedValue(baseCustomer) },
        admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeDetailRequest(CUSTOMER_ID, 'PUT', { name: 'New Name' }), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(401);
  });

  it('updates customer and returns 200', async () => {
    const res = await PUT(makeDetailRequest(CUSTOMER_ID, 'PUT', { name: 'New Name' }), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(200);
  });

  it('invalidates cache with deleteByTag after update', async () => {
    await PUT(makeDetailRequest(CUSTOMER_ID, 'PUT', { name: 'New Name' }), routeParams(CUSTOMER_ID));
    expect(mockDeleteByTag).toHaveBeenCalledWith('customers');
  });

  it('returns 404 when customer not found', async () => {
    mockCustomersFindFirst.mockResolvedValue(null);
    const res = await PUT(makeDetailRequest(CUSTOMER_ID, 'PUT', { name: 'New Name' }), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(404);
  });

  it('returns 409 when changing to an existing doc_number', async () => {
    const anotherCustomer = { ...baseCustomer, id: 'bbbbbbbb-0000-0000-0000-000000000002', doc_number: '87654321' };
    mockCustomersFindFirst
      .mockResolvedValueOnce(baseCustomer)       // exists check
      .mockResolvedValueOnce(anotherCustomer);   // duplicate doc check
    const res = await PUT(
      makeDetailRequest(CUSTOMER_ID, 'PUT', { doc_type: 'DNI', doc_number: '87654321' }),
      routeParams(CUSTOMER_ID),
    );
    expect(res.status).toBe(409);
  });

  it('update where clause includes tenant_id (TOCTOU prevention)', async () => {
    let capturedWhere: any;
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        customers: {
          update: vi.fn(async (args: any) => {
            capturedWhere = args.where;
            return baseCustomer;
          }),
        },
        admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
    await PUT(makeDetailRequest(CUSTOMER_ID, 'PUT', { name: 'New Name' }), routeParams(CUSTOMER_ID));
    expect(capturedWhere).toMatchObject({ id: CUSTOMER_ID, tenant_id: TENANT_ID });
  });
});

// ─── DELETE /api/admin/customers/[id] ─────────────────────────────────────────

describe('DELETE /api/admin/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCustomersFindFirst.mockResolvedValue(baseCustomer);
    mockOrdersCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        customers: { delete: vi.fn().mockResolvedValue(baseCustomer) },
        admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
      }),
    );
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await DELETE(makeDetailRequest(CUSTOMER_ID, 'DELETE'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(401);
  });

  it('deletes customer and returns 200', async () => {
    const res = await DELETE(makeDetailRequest(CUSTOMER_ID, 'DELETE'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('invalidates cache with deleteByTag after delete', async () => {
    await DELETE(makeDetailRequest(CUSTOMER_ID, 'DELETE'), routeParams(CUSTOMER_ID));
    expect(mockDeleteByTag).toHaveBeenCalledWith('customers');
  });

  it('returns 404 when customer not found', async () => {
    mockCustomersFindFirst.mockResolvedValue(null);
    const res = await DELETE(makeDetailRequest(CUSTOMER_ID, 'DELETE'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(404);
  });

  it('returns 409 when customer has open orders', async () => {
    mockOrdersCount.mockResolvedValue(2);
    const res = await DELETE(makeDetailRequest(CUSTOMER_ID, 'DELETE'), routeParams(CUSTOMER_ID));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('activos');
  });
});
