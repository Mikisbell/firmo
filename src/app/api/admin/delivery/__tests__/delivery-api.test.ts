/**
 * Tests for:
 * - GET /api/admin/delivery/metrics
 * - GET /api/admin/delivery/driver-metrics
 * - GET /api/admin/delivery/history
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id from JWT (NEVER from client)
 * - driver-metrics: cache key includes tenantId (BUG #DRV1 fix verified)
 * - driver-metrics: invalid date format → 400
 * - history: queries delivery_orders + enriches with driver names
 * - cache.set with { tags, ttl } on all
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetTodayMetrics,
  mockGetDriverMetrics,
  mockDeliveryOrdersFindMany,
  mockDeliveryOrdersCount,
  mockDriversFindMany,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetTodayMetrics: vi.fn(),
  mockGetDriverMetrics: vi.fn(),
  mockDeliveryOrdersFindMany: vi.fn(),
  mockDeliveryOrdersCount: vi.fn(),
  mockDriversFindMany: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/delivery', () => ({
  DeliveryMetricsService: {
    getTodayMetrics: mockGetTodayMetrics,
    getDriverMetrics: mockGetDriverMetrics,
  },
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    delivery_orders: {
      findMany: mockDeliveryOrdersFindMany,
      count: mockDeliveryOrdersCount,
    },
    drivers: { findMany: mockDriversFindMany },
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
  metrics: { increment: vi.fn(), set: vi.fn() },
}));

import { GET as GETMetrics } from '../metrics/route';
import { GET as GETDriverMetrics } from '../driver-metrics/route';
import { GET as GETHistory } from '../history/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseTodayMetrics = {
  totalOrders: 12,
  completedOrders: 10,
  pendingOrders: 2,
  avgDeliveryTimeMins: 28,
};

const baseDriverMetrics = [
  { driverId: 'drv-1', name: 'Juan', deliveries: 5, avgTimeMins: 25 },
  { driverId: 'drv-2', name: 'Pedro', deliveries: 3, avgTimeMins: 32 },
];

const baseDeliveries = [
  { id: 'ord-1', tenant_id: TENANT_ID, driver_id: 'drv-1', status: 'DELIVERED', created_at: new Date() },
  { id: 'ord-2', tenant_id: TENANT_ID, driver_id: null, status: 'PENDING', created_at: new Date() },
];

const baseDrivers = [
  { id: 'drv-1', name: 'Juan Pérez' },
];

function makeRequest(path: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/delivery/${path}${query}`, {
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

// ─── GET /api/admin/delivery/metrics ──────────────────────────────────────────

describe('GET /api/admin/delivery/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetTodayMetrics.mockResolvedValue(baseTodayMetrics);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETMetrics(makeRequest('metrics'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with delivery metrics', async () => {
    const res = await GETMetrics(makeRequest('metrics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalOrders).toBe(12);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETMetrics(makeRequest('metrics'));
    expect(mockGetTodayMetrics).toHaveBeenCalledWith(TENANT_ID);
  });

  it('stores in cache with tags: [delivery:metrics] and ttl: 120', async () => {
    await GETMetrics(makeRequest('metrics'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['delivery:metrics'], ttl: 120 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce(baseTodayMetrics);
    const res = await GETMetrics(makeRequest('metrics'));
    expect(res.status).toBe(200);
    expect(mockGetTodayMetrics).not.toHaveBeenCalled();
  });

  it('returns 500 on service error', async () => {
    mockGetTodayMetrics.mockRejectedValue(new Error('Service error'));
    const res = await GETMetrics(makeRequest('metrics'));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/delivery/driver-metrics ───────────────────────────────────

describe('GET /api/admin/delivery/driver-metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetDriverMetrics.mockResolvedValue(baseDriverMetrics);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with driver metrics', async () => {
    const res = await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metrics).toHaveLength(2);
    expect(body.dateFrom).toBeDefined();
    expect(body.dateTo).toBeDefined();
  });

  it('passes tenant_id from JWT to service (BUG #DRV1 fix)', async () => {
    await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(mockGetDriverMetrics).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(String),
      expect.any(String),
    );
  });

  it('includes tenantId in cache key (tenant isolation fix)', async () => {
    await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.stringContaining(TENANT_ID),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('stores in cache with tags: [delivery:driver-metrics] and ttl: 300', async () => {
    await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['delivery:driver-metrics'], ttl: 300 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ metrics: baseDriverMetrics, dateFrom: '2026-03-01', dateTo: '2026-03-26' });
    const res = await GETDriverMetrics(makeRequest('driver-metrics'));
    expect(res.status).toBe(200);
    expect(mockGetDriverMetrics).not.toHaveBeenCalled();
  });

  it('passes custom date range to service', async () => {
    await GETDriverMetrics(makeRequest('driver-metrics', '?dateFrom=2026-03-01&dateTo=2026-03-20'));
    expect(mockGetDriverMetrics).toHaveBeenCalledWith(TENANT_ID, '2026-03-01', '2026-03-20');
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GETDriverMetrics(makeRequest('driver-metrics', '?dateFrom=20-03-2026'));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/delivery/history ─────────────────────────────────────────

describe('GET /api/admin/delivery/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockDeliveryOrdersFindMany.mockResolvedValue(baseDeliveries);
    mockDeliveryOrdersCount.mockResolvedValue(2);
    mockDriversFindMany.mockResolvedValue(baseDrivers);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETHistory(makeRequest('history'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with deliveries array', async () => {
    const res = await GETHistory(makeRequest('history'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.deliveries)).toBe(true);
    expect(body.total).toBe(2);
  });

  it('queries delivery_orders scoped by tenant_id from JWT', async () => {
    await GETHistory(makeRequest('history'));
    expect(mockDeliveryOrdersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('enriches deliveries with driver names', async () => {
    const res = await GETHistory(makeRequest('history'));
    const body = await res.json();
    const withDriver = body.deliveries.find((d: any) => d.id === 'ord-1');
    const noDriver = body.deliveries.find((d: any) => d.id === 'ord-2');
    expect(withDriver.driver_name).toBe('Juan Pérez');
    expect(noDriver.driver_name).toBeNull();
  });

  it('queries drivers scoped by tenant_id from JWT (no cross-tenant driver names)', async () => {
    await GETHistory(makeRequest('history'));
    expect(mockDriversFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('stores in cache with tags: [delivery:history] and ttl: 120', async () => {
    await GETHistory(makeRequest('history'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['delivery:history'], ttl: 120 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ deliveries: [], total: 0, limit: 50, offset: 0, hasMore: false });
    const res = await GETHistory(makeRequest('history'));
    expect(res.status).toBe(200);
    expect(mockDeliveryOrdersFindMany).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid dateFrom format', async () => {
    const res = await GETHistory(makeRequest('history', '?dateFrom=20-03-2026'));
    expect(res.status).toBe(400);
  });

  it('filters by status when provided', async () => {
    await GETHistory(makeRequest('history', '?status=DELIVERED'));
    expect(mockDeliveryOrdersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });
});
