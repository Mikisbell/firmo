/**
 * Tests for:
 * - GET /api/admin/audit/alerts
 * - GET /api/admin/audit/events
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT (used in filters + cache key)
 * - cache.set with { tags, ttl }
 * - alerts: invalid severity → 400
 * - events: invalid event_type → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockQueryAlerts,
  mockQueryEvents,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockQueryAlerts: vi.fn(),
  mockQueryEvents: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/auth/audit-logger', () => ({
  queryAlerts: mockQueryAlerts,
  queryEvents: mockQueryEvents,
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

import { GET as GETAlerts } from '../alerts/route';
import { GET as GETEvents } from '../events/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseAlerts = [
  { id: 'alert-1', severity: 'critical', acknowledged: false, tenant_id: TENANT_ID },
  { id: 'alert-2', severity: 'high', acknowledged: true, tenant_id: TENANT_ID },
];

const baseEvents = [
  { id: 'evt-1', event_type: 'login_success', tenant_id: TENANT_ID },
  { id: 'evt-2', event_type: 'login_failed', tenant_id: TENANT_ID },
];

function makeRequest(path: string, query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/audit/${path}${query}`, {
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

// ─── GET /api/admin/audit/alerts ──────────────────────────────────────────────

describe('GET /api/admin/audit/alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockQueryAlerts.mockResolvedValue(baseAlerts);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETAlerts(makeRequest('alerts'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with alerts and count', async () => {
    const res = await GETAlerts(makeRequest('alerts'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  it('passes tenant_id from JWT to queryAlerts', async () => {
    await GETAlerts(makeRequest('alerts'));
    expect(mockQueryAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT_ID }),
    );
  });

  it('includes tenantId in cache key (tenant isolation)', async () => {
    await GETAlerts(makeRequest('alerts'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.stringContaining(TENANT_ID),
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('stores in cache with tags: [audit:alerts] and ttl: 60', async () => {
    await GETAlerts(makeRequest('alerts'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['audit:alerts'], ttl: 60 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ alerts: baseAlerts, count: 2, filters: {} });
    const res = await GETAlerts(makeRequest('alerts'));
    expect(res.status).toBe(200);
    expect(mockQueryAlerts).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid severity', async () => {
    const res = await GETAlerts(makeRequest('alerts', '?severity=INVALID'));
    expect(res.status).toBe(400);
  });

  it('passes severity filter to queryAlerts', async () => {
    await GETAlerts(makeRequest('alerts', '?severity=critical'));
    expect(mockQueryAlerts).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'critical' }),
    );
  });

  it('returns 500 on service error', async () => {
    mockQueryAlerts.mockRejectedValue(new Error('DB error'));
    const res = await GETAlerts(makeRequest('alerts'));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/audit/events ──────────────────────────────────────────────

describe('GET /api/admin/audit/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockQueryEvents.mockResolvedValue(baseEvents);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETEvents(makeRequest('events'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with events and count', async () => {
    const res = await GETEvents(makeRequest('events'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(2);
    expect(body.count).toBe(2);
  });

  it('passes tenant_id from JWT to queryEvents', async () => {
    await GETEvents(makeRequest('events'));
    expect(mockQueryEvents).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT_ID }),
    );
  });

  it('stores in cache with tags: [audit:events] and ttl: 120', async () => {
    await GETEvents(makeRequest('events'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['audit:events'], ttl: 120 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ events: baseEvents, count: 2, filters: {} });
    const res = await GETEvents(makeRequest('events'));
    expect(res.status).toBe(200);
    expect(mockQueryEvents).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid event_type', async () => {
    const res = await GETEvents(makeRequest('events', '?event_type=INVALID_TYPE'));
    expect(res.status).toBe(400);
  });

  it('passes event_type filter to queryEvents', async () => {
    await GETEvents(makeRequest('events', '?event_type=login_success'));
    expect(mockQueryEvents).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'login_success' }),
    );
  });

  it('returns 500 on service error', async () => {
    mockQueryEvents.mockRejectedValue(new Error('DB error'));
    const res = await GETEvents(makeRequest('events'));
    expect(res.status).toBe(500);
  });
});
