/**
 * Tests for GET /api/admin/dashboard/stats
 *
 * Key behavior under test:
 * - Auth required
 * - tenant_id always from JWT
 * - cache hit skips all DB queries
 * - cache.set called with tags: ['dashboard'] and ttl: 30
 * - all DB queries scoped to tenant_id
 * - graceful fallback when DB is unavailable
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockQueryRaw,
  mockOrdersAggregate,
  mockOrdersCount,
  mockTerminalsCount,
  mockTerminalsFindMany,
  mockProductsCount,
  mockProductsFindMany,
  mockEventOutboxCount,
  mockCacheGet,
  mockCacheSet,
  mockGetDailyKPIs,
  mockGetRecentActivity,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockQueryRaw: vi.fn(async () => [{ '1': 1 }]),
  mockOrdersAggregate: vi.fn(async () => ({ _sum: { total_cents: 10000 } })),
  mockOrdersCount: vi.fn(async () => 3),
  mockTerminalsCount: vi.fn(async () => 2),
  mockTerminalsFindMany: vi.fn(async () => []),
  mockProductsCount: vi.fn(async () => 25),
  mockProductsFindMany: vi.fn(async () => []),
  mockEventOutboxCount: vi.fn(async () => 0),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockGetDailyKPIs: vi.fn(),
  mockGetRecentActivity: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    $queryRaw: mockQueryRaw,
    orders: { aggregate: mockOrdersAggregate, count: mockOrdersCount },
    terminals: { count: mockTerminalsCount, findMany: mockTerminalsFindMany },
    products: { count: mockProductsCount, findMany: mockProductsFindMany },
    event_outbox: { count: mockEventOutboxCount },
  },
}));

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: { get: mockCacheGet, set: mockCacheSet },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/services/dashboard.service', () => ({
  DashboardService: vi.fn().mockImplementation(function (this: any) {
    this.getDailyKPIs = mockGetDailyKPIs;
    this.getRecentActivity = mockGetRecentActivity;
  }),
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

vi.mock('@/src/core/utils/business-date', () => ({
  getBusinessDate: vi.fn(() => '2026-03-26'),
}));

import { GET } from '../stats/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/dashboard/stats', {
    method: 'GET',
    headers: { cookie: 'auth_token=test-token' },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/dashboard/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    mockOrdersAggregate.mockResolvedValue({ _sum: { total_cents: 10000 } });
    mockOrdersCount.mockResolvedValue(3);
    mockTerminalsCount.mockResolvedValue(2);
    mockTerminalsFindMany.mockResolvedValue([]);
    mockProductsCount.mockResolvedValue(25);
    mockProductsFindMany.mockResolvedValue([]);
    mockEventOutboxCount.mockResolvedValue(0);
    mockGetDailyKPIs.mockResolvedValue({ success: false });
    mockGetRecentActivity.mockResolvedValue({ success: false });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with dashboard stats', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.salesToday).toBe(10000);
    expect(body.activeOrders).toBe(3);
    expect(body.terminalsOnline).toBe(2);
    expect(body.totalProducts).toBe(25);
    expect(body.lastUpdated).toBeDefined();
    expect(Array.isArray(body.alerts)).toBe(true);
  });

  it('scopes all DB queries to tenant_id from JWT', async () => {
    await GET(makeRequest());
    expect(mockOrdersAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
    expect(mockProductsCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });

  it('serves from cache on cache hit', async () => {
    const cachedStats = { salesToday: 99999, activeOrders: 0, terminalsOnline: 0 };
    mockCacheGet.mockResolvedValueOnce(cachedStats);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockOrdersAggregate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.salesToday).toBe(99999);
  });

  it('stores stats in cache with tags: [dashboard] and ttl: 30', async () => {
    await GET(makeRequest());
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['dashboard'], ttl: 30 }),
    );
  });

  it('returns fallback stats when DB is unavailable', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB connection refused'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.salesToday).toBe(0);
    expect(body.activeOrders).toBe(0);
  });

  it('includes terminal offline alerts in stats', async () => {
    const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    mockTerminalsFindMany.mockResolvedValue([
      { terminal_id: 'POS-001', last_seen_at: twoHoursAgo },
    ]);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.alerts.some((a: any) => a.message.includes('POS-001'))).toBe(true);
  });

  it('includes sync warning when pending events > 10', async () => {
    mockEventOutboxCount.mockResolvedValue(15);
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.syncStatus.synced).toBe(false);
    expect(body.syncStatus.pendingEvents).toBe(15);
    expect(body.alerts.some((a: any) => a.id === 'sync-pending')).toBe(true);
  });

  it('calculates deltaPercent correctly', async () => {
    mockOrdersAggregate
      .mockResolvedValueOnce({ _sum: { total_cents: 12000 } }) // today
      .mockResolvedValueOnce({ _sum: { total_cents: 10000 } }); // yesterday
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(body.deltaPercent).toBe(20); // (12000-10000)/10000 * 100 = 20%
  });
});
