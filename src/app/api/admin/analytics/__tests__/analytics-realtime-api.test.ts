/**
 * Tests for GET /api/admin/analytics/realtime
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - cache.set with tags: ['analytics:realtime'] and ttl: 10
 * - optional shift_id (UUID) filter
 * - invalid shift_id UUID returns 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockRequireAdminAuth,
  mockGetRealtimeMetrics,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetRealtimeMetrics: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/analytics/analytics.service', () => ({
  getRealtimeMetrics: mockGetRealtimeMetrics,
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

import { GET } from '../realtime/route';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const SHIFT_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

const baseMetrics = {
  totalSalesCents: 150000,
  orderCount: 12,
  avgTicketCents: 12500,
  activeOrders: 3,
  topProducts: [],
};

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/analytics/realtime${query}`, {
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

describe('GET /api/admin/analytics/realtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetRealtimeMetrics.mockResolvedValue(baseMetrics);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with realtime metrics', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalSalesCents).toBe(150000);
    expect(body.orderCount).toBe(12);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest());
    expect(mockGetRealtimeMetrics).toHaveBeenCalledWith(TENANT_ID, undefined);
  });

  it('passes shift_id when provided', async () => {
    await GET(makeRequest(`?shift_id=${SHIFT_ID}`));
    expect(mockGetRealtimeMetrics).toHaveBeenCalledWith(TENANT_ID, SHIFT_ID);
  });

  it('returns 400 on invalid shift_id (not UUID)', async () => {
    const res = await GET(makeRequest('?shift_id=not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce(baseMetrics);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockGetRealtimeMetrics).not.toHaveBeenCalled();
  });

  it('stores metrics in cache with tags: [analytics:realtime] and ttl: 10', async () => {
    await GET(makeRequest());
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['analytics:realtime'], ttl: 10 }),
    );
  });

  it('returns 500 on service error', async () => {
    mockGetRealtimeMetrics.mockRejectedValue(new Error('Service unavailable'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
