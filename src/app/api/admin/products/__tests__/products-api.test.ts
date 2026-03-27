/**
 * Tests for /api/admin/products (GET + POST)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - Cache stored with tags: ['products'] for proper invalidation
 * - POST invalidates via deleteByTag('products')
 * - All 11 categories accepted by Zod schema
 * - SKU uniqueness scoped to tenant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockProductsFindMany,
  mockProductsCount,
  mockProductsFindFirst,
  mockCatalogMetaUpsert,
  mockTransaction,
  mockRequireAdminAuth,
  mockCacheGet,
  mockCacheSet,
  mockDeleteByTag,
} = vi.hoisted(() => ({
  mockProductsFindMany: vi.fn(),
  mockProductsCount: vi.fn(),
  mockProductsFindFirst: vi.fn(),
  mockCatalogMetaUpsert: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
  mockCacheGet: vi.fn<() => Promise<unknown>>(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockDeleteByTag: vi.fn(async () => {}),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    products: {
      findMany: mockProductsFindMany,
      count: mockProductsCount,
      findFirst: mockProductsFindFirst,
    },
    catalog_meta: { upsert: mockCatalogMetaUpsert },
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
  createPaginatedResponse: vi.fn((items: any[], total: number) => ({ items, total })),
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { GET, POST } from '../route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

const ALL_CATEGORIES = [
  'POLLOS', 'PARRILLAS', 'CRIOLLOS', 'SALCHIPAPAS', 'ALITAS',
  'PIQUEOS', 'BEBIDAS', 'GUARNICIONES', 'EXTRAS', 'POSTRES', 'COMBOS',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/products', {
    method,
    headers: {
      cookie: 'auth_token=test-token',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

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

// ─── GET Tests ────────────────────────────────────────────────────────────────

describe('GET /api/admin/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockProductsCount.mockResolvedValue(0);
    mockProductsFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when no products exist', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('queries products scoped by tenant_id from JWT', async () => {
    const product = {
      id: 'prod-1', sku: 'P001', name: 'Pollo a la Brasa', short_name: 'Pollo',
      price_cents: 2500, category: 'POLLOS', station: 'PARRILLA',
      type: 'SIMPLE', is_active: true, images: [],
    };
    mockProductsCount.mockResolvedValue(1);
    mockProductsFindMany.mockResolvedValue([product]);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe('Pollo a la Brasa');

    expect(mockProductsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      })
    );
  });

  it('serves from cache on cache hit', async () => {
    const cached = { items: [{ id: 'prod-1', name: 'Cached Product' }], total: 1 };
    mockCacheGet.mockResolvedValueOnce(cached);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].name).toBe('Cached Product');
    expect(mockProductsFindMany).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags: [products]', async () => {
    mockProductsFindMany.mockResolvedValue([]);
    await GET(makeRequest('GET'));

    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['products'] })
    );
  });

  it('filters by is_active=true by default', async () => {
    await GET(makeRequest('GET'));
    expect(mockProductsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_active: true }),
      })
    );
  });
});

// ─── POST Tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/products', () => {
  const validPayload = {
    sku: 'P-POLLO-001',
    name: 'Pollo a la Brasa 1/4',
    price_cents: 2500,
    category: 'POLLOS',
    station: 'PARRILLA',
  };

  const createdProduct = {
    id: 'prod-new-001',
    tenant_id: TENANT_ID,
    sku: 'P-POLLO-001',
    name: 'Pollo a la Brasa 1/4',
    short_name: null,
    price_cents: 2500,
    category: 'POLLOS',
    station: 'PARRILLA',
    type: 'SIMPLE',
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockProductsFindFirst.mockResolvedValue(null); // no duplicate SKU
    mockProductsCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      products: { create: vi.fn().mockResolvedValue(createdProduct) },
      catalog_meta: { upsert: vi.fn().mockResolvedValue({}) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('creates product with tenant_id from JWT', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);

    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      products: { create: vi.fn().mockResolvedValue(createdProduct) },
      catalog_meta: { upsert: vi.fn().mockResolvedValue({}) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.products.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          sku: 'P-POLLO-001',
          price_cents: 2500,
        }),
      })
    );
  });

  it('returns 409 on duplicate SKU within tenant', async () => {
    mockProductsFindFirst.mockResolvedValue({ id: 'prod-existing', sku: 'P-POLLO-001' });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('Este SKU ya está en uso');
  });

  it('checks SKU uniqueness scoped to tenant_id from JWT', async () => {
    await POST(makeRequest('POST', validPayload));
    expect(mockProductsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, sku: 'P-POLLO-001' }),
      })
    );
  });

  it('invalidates products cache via deleteByTag after create', async () => {
    await POST(makeRequest('POST', validPayload));
    expect(mockDeleteByTag).toHaveBeenCalledWith('products');
  });

  it('returns 400 on invalid payload (missing required fields)', async () => {
    const res = await POST(makeRequest('POST', { name: 'Solo nombre' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid category', async () => {
    const res = await POST(makeRequest('POST', { ...validPayload, category: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid station', async () => {
    const res = await POST(makeRequest('POST', { ...validPayload, station: 'INVALID' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on negative price', async () => {
    const res = await POST(makeRequest('POST', { ...validPayload, price_cents: -100 }));
    expect(res.status).toBe(400);
  });

  it.each(ALL_CATEGORIES)('accepts category %s', async (category) => {
    const payload = { ...validPayload, category };
    mockProductsFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest('POST', payload));
    // Should not be 400 (validation error) — might be 201 or 500 depending on tx mock
    expect(res.status).not.toBe(400);
  });
});
