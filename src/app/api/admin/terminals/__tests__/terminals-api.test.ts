/**
 * Tests for:
 * - GET /api/admin/terminals
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - Returns { items, pagination } shape
 * - Filters: is_allowed, station_id
 * - cache.set with { tags: ['terminals'], ttl: 120 }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockTerminalsCount,
  mockTerminalsFindMany,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockTerminalsCount: vi.fn(),
  mockTerminalsFindMany: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    terminals: {
      count: mockTerminalsCount,
      findMany: mockTerminalsFindMany,
    },
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

import { GET } from '../route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const STATION_ID = 'sta00000-0000-0000-0000-000000000001';

const baseTerminals = [
  { id: 'term-1', terminal_id: 'TERM-001', station_id: STATION_ID, is_allowed: true, last_seen_at: new Date() },
  { id: 'term-2', terminal_id: 'TERM-002', station_id: STATION_ID, is_allowed: false, last_seen_at: new Date() },
];

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/terminals${query}`, {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/terminals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTerminalsCount.mockResolvedValue(2);
    mockTerminalsFindMany.mockResolvedValue(baseTerminals);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with { items, pagination } shape', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.items).toHaveLength(2);
  });

  it('queries terminals scoped by tenant_id from JWT', async () => {
    await GET(makeRequest());
    expect(mockTerminalsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('stores in cache with tags: [terminals] and ttl: 120', async () => {
    await GET(makeRequest());
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['terminals'], ttl: 120 }),
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce({ items: baseTerminals, pagination: { total: 2, page: 1, limit: 20, totalPages: 1 } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockTerminalsFindMany).not.toHaveBeenCalled();
  });

  it('filters by is_allowed when provided', async () => {
    await GET(makeRequest('?is_allowed=true'));
    expect(mockTerminalsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ is_allowed: true }),
      }),
    );
  });

  it('filters by station_id when provided', async () => {
    await GET(makeRequest(`?station_id=${STATION_ID}`));
    expect(mockTerminalsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ station_id: STATION_ID }),
      }),
    );
  });

  it('returns 200 with empty list when no terminals', async () => {
    mockTerminalsCount.mockResolvedValue(0);
    mockTerminalsFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(0);
    expect(body.pagination.total).toBe(0);
  });
});
