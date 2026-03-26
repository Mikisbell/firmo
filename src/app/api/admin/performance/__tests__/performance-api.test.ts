/**
 * Tests for:
 * - GET  /api/admin/performance/metrics
 * - POST /api/admin/performance/metrics (reset)
 *
 * Key behavior:
 * - Auth required on both
 * - GET: returns cacheHitRate, avgResponseTime, cacheSize, etc.
 * - POST: resets metrics + clears cache, returns { success: true }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetMetrics,
  mockReset,
  mockCacheSize,
  mockCacheClear,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetMetrics: vi.fn(),
  mockReset: vi.fn(),
  mockCacheSize: vi.fn(),
  mockCacheClear: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/lib/performance-monitor', () => ({
  perfMonitor: { getMetrics: mockGetMetrics, reset: mockReset },
}));

vi.mock('@/src/lib/fetch-cache', () => ({
  requestCache: { size: mockCacheSize, clear: mockCacheClear },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from '../metrics/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const baseMetrics = {
  cacheHitRate: 0.85,
  avgResponseTime: 45,
  totalRequests: 1000,
  cachedRequests: 850,
  p95ResponseTime: 120,
  p99ResponseTime: 250,
};

function makeRequest(method = 'GET'): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/performance/metrics', {
    method,
    headers: { cookie: 'auth_token=test-token' },
  });
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'emp-1', role: 'ADMIN', tenantId: TENANT_ID },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/admin/performance/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetMetrics.mockReturnValue(baseMetrics);
    mockCacheSize.mockReturnValue(42);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with metrics', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cacheHitRate).toBe(0.85);
    expect(body.avgResponseTime).toBe(45);
    expect(body.cacheSize).toBe(42);
    expect(body.totalRequests).toBe(1000);
    expect(body.cacheHits).toBe(850);
    expect(body.cacheMisses).toBe(150);
    expect(body.p95ResponseTime).toBe(120);
  });

  it('returns 500 on error', async () => {
    mockGetMetrics.mockImplementation(() => { throw new Error('Boom'); });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/performance/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with success message', async () => {
    const res = await POST(makeRequest('POST'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('calls perfMonitor.reset and requestCache.clear', async () => {
    await POST(makeRequest('POST'));
    expect(mockReset).toHaveBeenCalledOnce();
    expect(mockCacheClear).toHaveBeenCalledOnce();
  });

  it('returns 500 on error', async () => {
    mockReset.mockImplementation(() => { throw new Error('Boom'); });
    const res = await POST(makeRequest('POST'));
    expect(res.status).toBe(500);
  });
});
