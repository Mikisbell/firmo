/**
 * Tests for /api/admin/stations (GET + POST)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - Cache stored with tags for proper invalidation
 * - POST returns 409 on duplicate code
 * - POST returns 400 on invalid payload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockStationsFindMany,
  mockStationsCount,
  mockStationsFindFirst,
  mockTransaction,
  mockRequireAdminAuth,
  mockCacheGet,
  mockCacheSet,
} = vi.hoisted(() => ({
  mockStationsFindMany: vi.fn(),
  mockStationsCount: vi.fn(),
  mockStationsFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
  mockCacheGet: vi.fn<() => Promise<unknown>>(async () => null),
  mockCacheSet: vi.fn(async () => {}),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    stations: {
      findMany: mockStationsFindMany,
      count: mockStationsCount,
      findFirst: mockStationsFindFirst,
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

vi.mock('@/src/core/cache/redis.service', () => ({
  cache: {
    get: mockCacheGet,
    set: mockCacheSet,
    invalidatePattern: vi.fn(async () => {}),
    deleteByTag: vi.fn(async () => {}),
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn(), set: vi.fn() },
}));

vi.mock('@/src/lib/pagination', () => ({
  parsePaginationParams: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
  createPaginatedResponse: vi.fn((items: any[], total: number) => ({ items, total })),
}));

vi.mock('@/src/core/config/location', () => ({
  getTenantId: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { GET, POST } from '../route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/stations', {
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

describe('GET /api/admin/stations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockStationsCount.mockResolvedValue(0);
    mockStationsFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty list when no stations exist', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it('queries stations scoped by tenant_id from JWT', async () => {
    const station = {
      id: 'sta-1', code: 'PARRILLA', name: 'Parrilla', is_active: true,
      _count: { terminals: 2, printers: 1 },
    };
    mockStationsCount.mockResolvedValue(1);
    mockStationsFindMany.mockResolvedValue([station]);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].code).toBe('PARRILLA');
    expect(body.items[0].terminals_count).toBe(2);

    expect(mockStationsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      })
    );
  });

  it('serves from cache on cache hit', async () => {
    const cached = { items: [{ id: 'sta-1', code: 'BAR' }], total: 1 };
    mockCacheGet.mockResolvedValueOnce(cached);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0].code).toBe('BAR');
    // DB should NOT be queried on cache hit
    expect(mockStationsFindMany).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags', async () => {
    mockStationsFindMany.mockResolvedValue([]);
    await GET(makeRequest('GET'));

    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['stations'] })
    );
  });
});

// ─── POST Tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/stations', () => {
  const validPayload = { code: 'HORNO', name: 'Horno', is_active: true };

  const createdStation = {
    id: 'sta-new-001',
    tenant_id: TENANT_ID,
    code: 'HORNO',
    name: 'Horno',
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockStationsFindFirst.mockResolvedValue(null); // no duplicate
    mockStationsCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      stations: { create: vi.fn().mockResolvedValue(createdStation) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('creates station with tenant_id from JWT', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);

    // Verify the transaction used tenant_id from JWT
    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      stations: { create: vi.fn().mockResolvedValue(createdStation) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.stations.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          code: 'HORNO',
          name: 'Horno',
        }),
      })
    );
  });

  it('returns 409 on duplicate station code', async () => {
    mockStationsFindFirst.mockResolvedValue({ id: 'sta-existing', code: 'HORNO' });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('El código de estación ya existe');
  });

  it('checks duplicate scoped by tenant_id from JWT', async () => {
    await POST(makeRequest('POST', validPayload));
    expect(mockStationsFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, code: 'HORNO' }),
      })
    );
  });

  it('returns 400 on invalid payload', async () => {
    const res = await POST(makeRequest('POST', { code: '', name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POST(makeRequest('POST', {}));
    expect(res.status).toBe(400);
  });
});
