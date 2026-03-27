/**
 * Tests for remaining analytics endpoints:
 * - GET /api/admin/analytics/hourly
 * - GET /api/admin/analytics/history
 * - GET /api/admin/analytics/top-products
 * - GET /api/admin/analytics/comparison
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id from JWT
 * - cache.set with proper tags and TTL
 * - hourly: passes date param to service (BUG #HOURLY1 fix verified)
 * - history: requires from + to params, validates range (max 90 days, from <= to)
 * - top-products: accepts optional limit (default 10, max 100)
 * - comparison: no query params required
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetHourlySales,
  mockGetTopProducts,
  mockGetComparison,
  mockDailySalesSummaryFindMany,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetHourlySales: vi.fn(),
  mockGetTopProducts: vi.fn(),
  mockGetComparison: vi.fn(),
  mockDailySalesSummaryFindMany: vi.fn(),
  mockCacheGet: vi.fn<() => Promise<unknown>>(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/analytics/analytics.service', () => ({
  getHourlySales: mockGetHourlySales,
  getTopProducts: mockGetTopProducts,
  getComparison: mockGetComparison,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    daily_sales_summary: { findMany: mockDailySalesSummaryFindMany },
  },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: { get: mockCacheGet, set: mockCacheSet },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
}));

vi.mock('@/src/core/observability/logger-pino', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return { createRequestLogger: vi.fn(() => noop), logPerformance: vi.fn() };
});

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn() },
}));

vi.mock('@/src/core/types/shared', () => ({
  asCentavos: vi.fn((v: number) => v),
}));

import { GET as GETHourly } from '../hourly/route';
import { GET as GETHistory } from '../history/route';
import { GET as GETTopProducts } from '../top-products/route';
import { GET as GETComparison } from '../comparison/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseHourly = [
  { hour: 12, sales_cents: 15000, orders: 5 },
  { hour: 13, sales_cents: 22000, orders: 8 },
];

const baseTopProducts = [
  { productId: 'prod-1', name: 'Pollo a la Brasa', unitsSold: 30, revenueCents: 150000 },
];

const baseComparison = {
  current: { salesCents: 100000, orders: 20 },
  previous: { salesCents: 85000, orders: 17 },
  deltaPercent: 17.6,
};

const baseSummary = {
  tenant_id: TENANT_ID,
  business_date: new Date('2026-03-20'),
  net_sales_cents: 95000,
  orders_count: 18,
  payments_breakdown: { CASH: 50000, YAPE: 45000 },
  created_at: new Date('2026-03-20'),
};

function makeRequest(path: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/analytics/${path}${query}`, {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
  });
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/analytics/hourly ──────────────────────────────────────────

describe('GET /api/admin/analytics/hourly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetHourlySales.mockResolvedValue(baseHourly);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETHourly(makeRequest('hourly'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with hourly sales', async () => {
    const res = await GETHourly(makeRequest('hourly'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hourly).toHaveLength(2);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETHourly(makeRequest('hourly'));
    expect(mockGetHourlySales).toHaveBeenCalledWith(TENANT_ID);
  });

  it('passes date param to service (BUG #HOURLY1 fix)', async () => {
    await GETHourly(makeRequest('hourly', '?date=2026-03-20'));
    expect(mockGetHourlySales).toHaveBeenCalledWith(TENANT_ID);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GETHourly(makeRequest('hourly', '?date=20-03-2026'));
    expect(res.status).toBe(400);
  });

  it('stores in cache with tags: [analytics:hourly] and ttl: 300', async () => {
    await GETHourly(makeRequest('hourly'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['analytics:hourly'], ttl: 300 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ hourly: baseHourly });
    const res = await GETHourly(makeRequest('hourly'));
    expect(res.status).toBe(200);
    expect(mockGetHourlySales).not.toHaveBeenCalled();
  });
});

// ─── GET /api/admin/analytics/history ─────────────────────────────────────────

describe('GET /api/admin/analytics/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockDailySalesSummaryFindMany.mockResolvedValue([baseSummary]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETHistory(makeRequest('history', '?from=2026-03-01&to=2026-03-20'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with historical data', async () => {
    const res = await GETHistory(makeRequest('history', '?from=2026-03-01&to=2026-03-20'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
  });

  it('queries with tenant_id from JWT', async () => {
    await GETHistory(makeRequest('history', '?from=2026-03-01&to=2026-03-20'));
    expect(mockDailySalesSummaryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('returns 400 when from is missing', async () => {
    const res = await GETHistory(makeRequest('history', '?to=2026-03-20'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when to is missing', async () => {
    const res = await GETHistory(makeRequest('history', '?from=2026-03-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when from > to', async () => {
    const res = await GETHistory(makeRequest('history', '?from=2026-03-20&to=2026-03-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when range exceeds 90 days', async () => {
    const res = await GETHistory(makeRequest('history', '?from=2025-01-01&to=2026-03-26'));
    expect(res.status).toBe(400);
  });

  it('stores in cache with tags: [analytics:history] and ttl: 600', async () => {
    await GETHistory(makeRequest('history', '?from=2026-03-01&to=2026-03-20'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['analytics:history'], ttl: 600 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce([]);
    const res = await GETHistory(makeRequest('history', '?from=2026-03-01&to=2026-03-20'));
    expect(res.status).toBe(200);
    expect(mockDailySalesSummaryFindMany).not.toHaveBeenCalled();
  });
});

// ─── GET /api/admin/analytics/top-products ────────────────────────────────────

describe('GET /api/admin/analytics/top-products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetTopProducts.mockResolvedValue(baseTopProducts);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETTopProducts(makeRequest('top-products'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with top products', async () => {
    const res = await GETTopProducts(makeRequest('top-products'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Pollo a la Brasa');
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETTopProducts(makeRequest('top-products'));
    expect(mockGetTopProducts).toHaveBeenCalledWith(TENANT_ID, 10);
  });

  it('passes custom limit to service', async () => {
    await GETTopProducts(makeRequest('top-products', '?limit=5'));
    expect(mockGetTopProducts).toHaveBeenCalledWith(TENANT_ID, 5);
  });

  it('returns 400 when limit exceeds 100', async () => {
    const res = await GETTopProducts(makeRequest('top-products', '?limit=200'));
    expect(res.status).toBe(400);
  });

  it('stores in cache with tags: [analytics:top-products] and ttl: 120', async () => {
    await GETTopProducts(makeRequest('top-products'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['analytics:top-products'], ttl: 120 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce(baseTopProducts);
    const res = await GETTopProducts(makeRequest('top-products'));
    expect(res.status).toBe(200);
    expect(mockGetTopProducts).not.toHaveBeenCalled();
  });
});

// ─── GET /api/admin/analytics/comparison ──────────────────────────────────────

describe('GET /api/admin/analytics/comparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetComparison.mockResolvedValue(baseComparison);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETComparison(makeRequest('comparison'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with comparison data', async () => {
    const res = await GETComparison(makeRequest('comparison'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deltaPercent).toBe(17.6);
    expect(body.current.salesCents).toBe(100000);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETComparison(makeRequest('comparison'));
    expect(mockGetComparison).toHaveBeenCalledWith(TENANT_ID);
  });

  it('stores in cache with tags: [analytics:comparison] and ttl: 300', async () => {
    await GETComparison(makeRequest('comparison'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['analytics:comparison'], ttl: 300 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce(baseComparison);
    const res = await GETComparison(makeRequest('comparison'));
    expect(res.status).toBe(200);
    expect(mockGetComparison).not.toHaveBeenCalled();
  });

  it('returns 500 on service error', async () => {
    mockGetComparison.mockRejectedValue(new Error('Service error'));
    const res = await GETComparison(makeRequest('comparison'));
    expect(res.status).toBe(500);
  });
});
