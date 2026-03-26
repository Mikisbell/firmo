/**
 * Tests for /api/admin/promotions (GET + POST)
 * and /api/admin/promotions/[id] (GET + PUT + DELETE)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - Cache stored with tags: ['promotions'] for proper invalidation
 * - POST/PUT/DELETE invalidate via deleteByTag('promotions')
 * - GET returns { items, pagination } shape (not { promotions })
 * - 404 on unknown promotion id (tenant-scoped)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockPromotionsFindMany,
  mockPromotionsCount,
  mockPromotionsFindFirst,
  mockTransaction,
  mockRequireAdminAuth,
  mockCacheGet,
  mockCacheSet,
  mockDeleteByTag,
} = vi.hoisted(() => ({
  mockPromotionsFindMany: vi.fn(),
  mockPromotionsCount: vi.fn(),
  mockPromotionsFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockDeleteByTag: vi.fn(async () => {}),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    promotions: {
      findMany: mockPromotionsFindMany,
      count: mockPromotionsCount,
      findFirst: mockPromotionsFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
}));

vi.mock('@/src/core/observability/logger-pino', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createRequestLogger: vi.fn(() => noop),
    logAudit: vi.fn(),
    logPerformance: vi.fn(),
  };
});

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    invalidatePattern: vi.fn(async () => {}),
    deleteByTag: mockDeleteByTag,
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn(), set: vi.fn() },
  MetricNames: {},
}));

vi.mock('@/src/lib/pagination', () => ({
  parsePaginationParams: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
  createPaginatedResponse: vi.fn((items: any[], total: number) => ({
    items,
    pagination: { page: 1, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: false, hasPrev: false },
  })),
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { GET, POST } from '../route';
import { GET as GetById, PUT, DELETE } from '../[id]/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';
const PROMOTION_ID = 'dddddddd-0000-0000-0000-000000000001';

const basePromotion = {
  id: PROMOTION_ID,
  tenant_id: TENANT_ID,
  name: 'Happy Hour Miércoles',
  type: 'PERCENT',
  value: 20,
  rules: {},
  starts_at: new Date('2026-03-01T17:00:00Z'),
  ends_at: new Date('2026-12-31T20:00:00Z'),
  is_active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/promotions', {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDetailRequest(method: 'GET' | 'PUT' | 'DELETE', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/promotions/${PROMOTION_ID}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeParams = { params: Promise.resolve({ id: PROMOTION_ID }) };

const validPayload = {
  name: 'Happy Hour Miércoles',
  type: 'PERCENT',
  value: 20,
  starts_at: '2026-03-01T17:00:00.000Z',
  ends_at: '2026-12-31T20:00:00.000Z',
  is_active: true,
};

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

// ─── GET /api/admin/promotions ────────────────────────────────────────────────

describe('GET /api/admin/promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPromotionsCount.mockResolvedValue(0);
    mockPromotionsFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { items, pagination } shape', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('pagination');
    expect(body.items).toEqual([]);
  });

  it('queries promotions scoped by tenant_id from JWT', async () => {
    mockPromotionsCount.mockResolvedValue(1);
    mockPromotionsFindMany.mockResolvedValue([basePromotion]);
    await GET(makeRequest('GET'));
    expect(mockPromotionsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      })
    );
  });

  it('serves from cache on cache hit', async () => {
    const cached = {
      items: [basePromotion],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    };
    mockCacheGet.mockResolvedValueOnce(cached);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(mockPromotionsFindMany).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags: [promotions]', async () => {
    await GET(makeRequest('GET'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['promotions'] })
    );
  });
});

// ─── POST /api/admin/promotions ───────────────────────────────────────────────

describe('POST /api/admin/promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPromotionsCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      promotions: { create: vi.fn().mockResolvedValue(basePromotion) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('creates promotion with tenant_id from JWT', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);

    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      promotions: { create: vi.fn().mockResolvedValue(basePromotion) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.promotions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_id: TENANT_ID }),
      })
    );
  });

  it('invalidates promotions cache via deleteByTag after create', async () => {
    await POST(makeRequest('POST', validPayload));
    expect(mockDeleteByTag).toHaveBeenCalledWith('promotions');
  });

  it('returns 400 on invalid payload (missing required fields)', async () => {
    const res = await POST(makeRequest('POST', { name: 'Solo nombre' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid promotion type', async () => {
    const res = await POST(makeRequest('POST', { ...validPayload, type: 'INVALID_TYPE' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when ends_at is before starts_at', async () => {
    const res = await POST(makeRequest('POST', {
      ...validPayload,
      starts_at: '2026-12-31T20:00:00.000Z',
      ends_at: '2026-03-01T17:00:00.000Z',
    }));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/promotions/[id] ──────────────────────────────────────────

describe('GET /api/admin/promotions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPromotionsFindFirst.mockResolvedValue(basePromotion);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 200 with promotion data', async () => {
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(PROMOTION_ID);
  });

  it('queries with tenant_id from JWT', async () => {
    await GetById(makeDetailRequest('GET'), routeParams);
    expect(mockPromotionsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, id: PROMOTION_ID }),
      })
    );
  });

  it('returns 404 when promotion not found', async () => {
    mockPromotionsFindFirst.mockResolvedValue(null);
    const res = await GetById(makeDetailRequest('GET'), routeParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Promoción no encontrada');
  });
});

// ─── PUT /api/admin/promotions/[id] ──────────────────────────────────────────

describe('PUT /api/admin/promotions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPromotionsFindFirst.mockResolvedValue(basePromotion);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      promotions: { update: vi.fn().mockResolvedValue({ ...basePromotion, name: 'Updated' }) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeDetailRequest('PUT', validPayload), routeParams);
    expect(res.status).toBe(401);
  });

  it('updates promotion and returns 200', async () => {
    const res = await PUT(makeDetailRequest('PUT', validPayload), routeParams);
    expect(res.status).toBe(200);
  });

  it('invalidates cache via deleteByTag after update', async () => {
    await PUT(makeDetailRequest('PUT', validPayload), routeParams);
    expect(mockDeleteByTag).toHaveBeenCalledWith('promotions');
  });

  it('returns 404 when promotion not found', async () => {
    mockPromotionsFindFirst.mockResolvedValue(null);
    const res = await PUT(makeDetailRequest('PUT', validPayload), routeParams);
    expect(res.status).toBe(404);
  });

  it('returns 400 on invalid payload', async () => {
    const res = await PUT(makeDetailRequest('PUT', { name: '' }), routeParams);
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/admin/promotions/[id] ───────────────────────────────────────

describe('DELETE /api/admin/promotions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPromotionsFindFirst.mockResolvedValue(basePromotion);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      promotions: { update: vi.fn().mockResolvedValue({ ...basePromotion, is_active: false }) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(401);
  });

  it('soft-deletes and returns 204', async () => {
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(204);
  });

  it('invalidates cache via deleteByTag after delete', async () => {
    await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(mockDeleteByTag).toHaveBeenCalledWith('promotions');
  });

  it('returns 404 when promotion not found', async () => {
    mockPromotionsFindFirst.mockResolvedValue(null);
    const res = await DELETE(makeDetailRequest('DELETE'), routeParams);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Promoción no encontrada');
  });
});
