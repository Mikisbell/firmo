/**
 * Tests for /api/admin/reports/* (GET variants)
 *
 * Routes under test:
 * - GET /api/admin/reports                        — sales summary (period: daily/weekly/monthly)
 * - GET /api/admin/reports/profitability          — full profitability report
 * - GET /api/admin/reports/margin-analysis        — margin analysis by category
 * - GET /api/admin/reports/profit-by-product/[id] — single product analysis
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - Sales report: cache.set called with tags: ['reports']
 * - Sales report: cache hit skips DB query
 * - Profitability/Margin routes: ProfitabilityService instantiated per request
 * - Product route: 404 when product not found in tenant scope
 * - Date validation: startDate must be <= endDate
 * - Invalid period returns 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockOrdersFindMany,
  mockProductsFindFirst,
  mockCacheGet,
  mockCacheSet,
  mockProfitabilityGetReport,
  mockProfitabilityGetMarginAnalysis,
  mockProfitabilityGetProductAnalysis,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockOrdersFindMany: vi.fn(),
  mockProductsFindFirst: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockProfitabilityGetReport: vi.fn(),
  mockProfitabilityGetMarginAnalysis: vi.fn(),
  mockProfitabilityGetProductAnalysis: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    orders: { findMany: mockOrdersFindMany },
    products: { findFirst: mockProductsFindFirst },
  },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    deleteByTag: vi.fn(async () => {}),
    invalidatePattern: vi.fn(async () => {}),
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/services/profitability.service', () => ({
  ProfitabilityService: vi.fn().mockImplementation(function (this: any) {
    this.getProfitabilityReport = mockProfitabilityGetReport;
    this.getMarginAnalysis = mockProfitabilityGetMarginAnalysis;
    this.getProductAnalysis = mockProfitabilityGetProductAnalysis;
  }),
}));

vi.mock('@/src/core/middleware/request-logger', () => ({
  withRequestLogging: vi.fn((handler: any) => handler),
}));

vi.mock('@/src/core/observability/logger-pino', () => {
  const noop = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    createRequestLogger: vi.fn(() => noop),
    logPerformance: vi.fn(),
    logAudit: vi.fn(),
  };
});

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn(), set: vi.fn() },
  MetricNames: {},
}));

import { GET as GETSales } from '../route';
import { GET as GETProfitability } from '../profitability/route';
import { GET as GETMarginAnalysis } from '../margin-analysis/route';
import { GET as GETProductAnalysis } from '../profit-by-product/[id]/route';
import { NotFoundError, ValidationError } from '@/src/core/errors/profitability-errors';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const PRODUCT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const baseOrder = {
  total_cents: 5000,
  discount_cents: 500,
  checks: [],
};

const baseProfitabilityReport = {
  products: [
    { productId: PRODUCT_ID, productName: 'Pollo a la Brasa', unitsSold: 10, totalRevenueCents: 50000, totalProfitCents: 20000 },
  ],
  summary: { totalRevenueCents: 50000, totalCostCents: 30000, totalProfitCents: 20000, overallMargin: 0.4 },
};

const baseMarginAnalysis = {
  categories: [{ categoryId: '1', categoryName: 'Pollos', totalRevenueCents: 50000, totalProfitCents: 20000, marginPercent: 40 }],
  summary: { totalRevenueCents: 50000, totalCostCents: 30000, totalProfitCents: 20000, overallMargin: 0.4 },
};

const baseProductAnalysis = {
  productId: PRODUCT_ID,
  productName: 'Pollo a la Brasa',
  unitsSold: 10,
  totalRevenueCents: 50000,
  totalProfitCents: 20000,
};

const baseProduct = {
  id: PRODUCT_ID,
  tenant_id: TENANT_ID,
  name: 'Pollo a la Brasa',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
  });
}

function makeDetailRequest(id: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/reports/profit-by-product/${id}${query}`, {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
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

// ─── GET /api/admin/reports ───────────────────────────────────────────────────

describe('GET /api/admin/reports', () => {
  const salesUrl = 'http://localhost:3000/api/admin/reports?period=daily';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockOrdersFindMany.mockResolvedValue([baseOrder]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETSales(makeRequest(salesUrl));
    expect(res.status).toBe(401);
  });

  it('returns 200 with sales report', async () => {
    const res = await GETSales(makeRequest(salesUrl));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('daily');
    expect(body.sales_net).toBe(5000);
    expect(body.discounts).toBe(500);
    expect(body.order_count).toBe(1);
  });

  it('queries orders with tenant_id from JWT', async () => {
    await GETSales(makeRequest(salesUrl));
    expect(mockOrdersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('serves from cache on cache hit', async () => {
    const cachedReport = { period: 'daily', sales_net: 9999, discounts: 0, tips: 0, order_count: 1, by_payment_method: [] };
    mockCacheGet.mockResolvedValueOnce(cachedReport);
    const res = await GETSales(makeRequest(salesUrl));
    expect(res.status).toBe(200);
    expect(mockOrdersFindMany).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags: [reports]', async () => {
    await GETSales(makeRequest(salesUrl));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['reports'] }),
    );
  });

  it('stores response in cache with correct TTL', async () => {
    await GETSales(makeRequest(salesUrl));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ ttl: 300 }),
    );
  });

  it('returns 200 for weekly period', async () => {
    mockOrdersFindMany.mockResolvedValue([]);
    const res = await GETSales(makeRequest('http://localhost:3000/api/admin/reports?period=weekly'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('weekly');
  });

  it('returns 200 for monthly period', async () => {
    mockOrdersFindMany.mockResolvedValue([]);
    const res = await GETSales(makeRequest('http://localhost:3000/api/admin/reports?period=monthly'));
    expect(res.status).toBe(200);
  });

  it('returns 400 on invalid period', async () => {
    const res = await GETSales(makeRequest('http://localhost:3000/api/admin/reports?period=yearly'));
    expect(res.status).toBe(400);
  });

  it('returns 200 with defaults when no period specified', async () => {
    mockOrdersFindMany.mockResolvedValue([]);
    const res = await GETSales(makeRequest('http://localhost:3000/api/admin/reports'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('daily');
  });
});

// ─── GET /api/admin/reports/profitability ─────────────────────────────────────

describe('GET /api/admin/reports/profitability', () => {
  const url = 'http://localhost:3000/api/admin/reports/profitability';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockProfitabilityGetReport.mockResolvedValue(baseProfitabilityReport);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETProfitability(makeRequest(url));
    expect(res.status).toBe(401);
  });

  it('returns 200 with profitability report', async () => {
    const res = await GETProfitability(makeRequest(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.products).toHaveLength(1);
    expect(body.data.summary.totalRevenueCents).toBe(50000);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETProfitability(makeRequest(url));
    expect(mockProfitabilityGetReport).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  it('accepts optional date filters', async () => {
    const urlWithDates = `${url}?startDate=2026-01-01T00:00:00.000Z&endDate=2026-03-31T23:59:59.000Z`;
    const res = await GETProfitability(makeRequest(urlWithDates));
    expect(res.status).toBe(200);
    expect(mockProfitabilityGetReport).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      }),
    );
  });

  it('returns 400 when startDate > endDate', async () => {
    const urlWithBadDates = `${url}?startDate=2026-12-31T00:00:00.000Z&endDate=2026-01-01T00:00:00.000Z`;
    const res = await GETProfitability(makeRequest(urlWithBadDates));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid datetime format', async () => {
    const res = await GETProfitability(makeRequest(`${url}?startDate=2026-01-01`));
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws CalculationError', async () => {
    mockProfitabilityGetReport.mockRejectedValue(new Error('Calculation failed'));
    const res = await GETProfitability(makeRequest(url));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/reports/margin-analysis ───────────────────────────────────

describe('GET /api/admin/reports/margin-analysis', () => {
  const url = 'http://localhost:3000/api/admin/reports/margin-analysis';

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockProfitabilityGetMarginAnalysis.mockResolvedValue(baseMarginAnalysis);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETMarginAnalysis(makeRequest(url));
    expect(res.status).toBe(401);
  });

  it('returns 200 with margin analysis', async () => {
    const res = await GETMarginAnalysis(makeRequest(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.categories).toHaveLength(1);
    expect(body.data.summary.overallMargin).toBe(0.4);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETMarginAnalysis(makeRequest(url));
    expect(mockProfitabilityGetMarginAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  it('returns 400 when startDate > endDate', async () => {
    const urlWithBadDates = `${url}?startDate=2026-12-31T00:00:00.000Z&endDate=2026-01-01T00:00:00.000Z`;
    const res = await GETMarginAnalysis(makeRequest(urlWithBadDates));
    expect(res.status).toBe(400);
  });

  it('accepts categoryIds filter', async () => {
    const catId = 'bbbbbbbb-0000-0000-0000-000000000001';
    const res = await GETMarginAnalysis(makeRequest(`${url}?categoryIds=${catId}`));
    expect(res.status).toBe(200);
    expect(mockProfitabilityGetMarginAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: [catId] }),
    );
  });

  it('returns 500 on service error', async () => {
    mockProfitabilityGetMarginAnalysis.mockRejectedValue(new Error('DB error'));
    const res = await GETMarginAnalysis(makeRequest(url));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/reports/profit-by-product/[id] ────────────────────────────

describe('GET /api/admin/reports/profit-by-product/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockProductsFindFirst.mockResolvedValue(baseProduct);
    mockProfitabilityGetProductAnalysis.mockResolvedValue(baseProductAnalysis);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID), routeParams(PRODUCT_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 with product analysis', async () => {
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID), routeParams(PRODUCT_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.productName).toBe('Pollo a la Brasa');
    expect(body.data.unitsSold).toBe(10);
  });

  it('verifies product belongs to tenant (tenant_id from JWT)', async () => {
    await GETProductAnalysis(makeDetailRequest(PRODUCT_ID), routeParams(PRODUCT_ID));
    expect(mockProductsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, id: PRODUCT_ID }),
      }),
    );
  });

  it('returns 404 when product not found in tenant scope', async () => {
    mockProductsFindFirst.mockResolvedValue(null);
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID), routeParams(PRODUCT_ID));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('accepts optional date filters', async () => {
    const query = '?startDate=2026-01-01T00:00:00.000Z&endDate=2026-03-31T23:59:59.000Z';
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID, query), routeParams(PRODUCT_ID));
    expect(res.status).toBe(200);
    expect(mockProfitabilityGetProductAnalysis).toHaveBeenCalledWith(
      PRODUCT_ID,
      expect.objectContaining({ startDate: expect.any(Date), endDate: expect.any(Date) }),
      TENANT_ID,
    );
  });

  it('returns 400 when startDate > endDate', async () => {
    const query = '?startDate=2026-12-31T00:00:00.000Z&endDate=2026-01-01T00:00:00.000Z';
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID, query), routeParams(PRODUCT_ID));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid datetime format', async () => {
    const query = '?startDate=not-a-date';
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID, query), routeParams(PRODUCT_ID));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    mockProfitabilityGetProductAnalysis.mockRejectedValue(new Error('DB error'));
    const res = await GETProductAnalysis(makeDetailRequest(PRODUCT_ID), routeParams(PRODUCT_ID));
    expect(res.status).toBe(500);
  });
});
