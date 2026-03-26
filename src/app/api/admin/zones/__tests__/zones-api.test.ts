/**
 * Tests for /api/admin/zones (GET + POST)
 *
 * Key behavior under test:
 * - getTenantLocationId() resolves real location from DB (not hardcoded env)
 * - POST inserts zone with correct tenant + location IDs
 * - GET returns 404 when tenant has no active location
 * - Tenant isolation: queries always scoped by tenant_id from JWT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockLocFindFirst,
  mockZonesFindMany,
  mockZonesCount,
  mockZonesFindFirst,
  mockTransaction,
  mockRequireAdminAuth,
} = vi.hoisted(() => ({
  mockLocFindFirst: vi.fn(),
  mockZonesFindMany: vi.fn(),
  mockZonesCount: vi.fn(),
  mockZonesFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    locations: { findFirst: mockLocFindFirst },
    zones: {
      findMany: mockZonesFindMany,
      count: mockZonesCount,
      findFirst: mockZonesFindFirst,
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
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
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

import { GET, POST } from '../route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = '9bc7e15f-ca13-43aa-a647-b1e4d46529fd';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/zones', {
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

describe('GET /api/admin/zones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockLocFindFirst.mockResolvedValue({ id: LOCATION_ID });
    mockZonesCount.mockResolvedValue(0);
    mockZonesFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when tenant has no active location', async () => {
    mockLocFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Sucursal no encontrada');
  });

  it('resolves location_id from DB scoped by tenant JWT', async () => {
    await GET(makeRequest('GET'));
    expect(mockLocFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, is_active: true }),
      })
    );
  });

  it('queries zones with real location_id', async () => {
    const zones = [
      { id: 'zone-1', code: 'SALON', name: 'Salón', color: '#4CAF50',
        is_outdoor: false, is_smoking: false, has_ac: true,
        sort_order: 1, is_active: true, _count: { tables: 5 } },
    ];
    mockZonesCount.mockResolvedValue(1);
    mockZonesFindMany.mockResolvedValue(zones);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);

    expect(mockZonesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
        }),
      })
    );
  });

  it('returns 200 with empty list when no zones exist', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});

// ─── POST Tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/zones', () => {
  const validPayload = {
    code: 'TERRAZA',
    name: 'Terraza',
    color: '#FF9800',
    is_outdoor: true,
    is_smoking: false,
    has_ac: false,
    sort_order: 3,
    is_active: true,
  };

  const createdZone = {
    id: 'zone-new-00001',
    tenant_id: TENANT_ID,
    location_id: LOCATION_ID,
    code: 'TERRAZA',
    name: 'Terraza',
    color: '#FF9800',
    is_outdoor: true,
    is_smoking: false,
    has_ac: false,
    sort_order: 3,
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockLocFindFirst.mockResolvedValue({ id: LOCATION_ID });
    mockZonesFindFirst.mockResolvedValue(null); // no duplicate
    mockZonesCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      zones: { create: vi.fn().mockResolvedValue(createdZone) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('returns 404 when tenant has no active location', async () => {
    mockLocFindFirst.mockResolvedValue(null);
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(404);
  });

  it('creates zone with real location_id from DB', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);

    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      zones: { create: vi.fn().mockResolvedValue(createdZone) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.zones.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,  // real location from DB
          code: 'TERRAZA',
        }),
      })
    );
  });

  it('returns 409 on duplicate zone code', async () => {
    mockZonesFindFirst.mockResolvedValue({ id: 'zone-existing', code: 'TERRAZA' });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('El código de zona ya existe');
  });

  it('checks duplicate using tenant_id from JWT and real location_id', async () => {
    await POST(makeRequest('POST', validPayload));
    expect(mockZonesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          code: 'TERRAZA',
        }),
      })
    );
  });

  it('never uses hardcoded default location_id', async () => {
    await POST(makeRequest('POST', validPayload));
    const call = mockZonesFindFirst.mock.calls[0]?.[0];
    expect(call?.where?.location_id).toBe(LOCATION_ID);
    expect(call?.where?.location_id).not.toBe('loc-00000000-0000-0000-0000-000000000001');
  });

  it('returns 400 on invalid payload', async () => {
    const res = await POST(makeRequest('POST', { code: '' }));
    expect(res.status).toBe(400);
  });
});
