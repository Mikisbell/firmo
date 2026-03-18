/**
 * Tests for /api/admin/tables (GET + POST)
 *
 * Key behavior under test:
 * - getTenantLocationId() resolves real location from DB (not hardcoded env)
 * - POST inserts table with correct tenant + location IDs
 * - GET returns 404 when tenant has no active location
 * - Tenant isolation: queries always scoped by tenant_id from JWT
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockLocFindFirst,
  mockTablesFindMany,
  mockTablesCount,
  mockTablesFindFirst,
  mockZonesFindFirst,
  mockTransaction,
  mockRequireAdminAuth,
} = vi.hoisted(() => ({
  mockLocFindFirst: vi.fn(),
  mockTablesFindMany: vi.fn(),
  mockTablesCount: vi.fn(),
  mockTablesFindFirst: vi.fn(),
  mockZonesFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    locations: { findFirst: mockLocFindFirst },
    tables: {
      findMany: mockTablesFindMany,
      count: mockTablesCount,
      findFirst: mockTablesFindFirst,
    },
    zones: { findFirst: mockZonesFindFirst },
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
  return new NextRequest('http://localhost:3000/api/admin/tables', {
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

function mockLocationFound() {
  mockLocFindFirst.mockResolvedValue({ id: LOCATION_ID });
}

function mockLocationNotFound() {
  mockLocFindFirst.mockResolvedValue(null);
}

// ─── GET Tests ────────────────────────────────────────────────────────────────

describe('GET /api/admin/tables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockLocationFound();
    mockTablesCount.mockResolvedValue(0);
    mockTablesFindMany.mockResolvedValue([]);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when tenant has no active location', async () => {
    mockLocationNotFound();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Sucursal no encontrada');
  });

  it('resolves location_id from DB (not hardcoded env)', async () => {
    mockTablesFindMany.mockResolvedValue([]);
    await GET(makeRequest('GET'));

    // Verify locations.findFirst was called with tenant_id from JWT
    expect(mockLocFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID, is_active: true }),
      })
    );
  });

  it('queries tables scoped by tenant_id and real location_id', async () => {
    const tables = [
      { id: 'tbl-1', number: '1', display_name: 'Mesa 1', capacity: 4, shape: 'SQUARE',
        status: 'AVAILABLE', is_active: true, zone_id: null, zones: null,
        position_x: 0, position_y: 0, width: 60, height: 60, rotation: 0 },
    ];
    mockTablesCount.mockResolvedValue(1);
    mockTablesFindMany.mockResolvedValue(tables);

    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].number).toBe('1');

    expect(mockTablesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,  // real location from DB, not default
        }),
      })
    );
  });

  it('returns 200 with empty list when no tables exist', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });
});

// ─── POST Tests ───────────────────────────────────────────────────────────────

describe('POST /api/admin/tables', () => {
  const validPayload = {
    number: '5',
    capacity: 4,
    shape: 'SQUARE',
    position_x: 100,
    position_y: 200,
    width: 60,
    height: 60,
    rotation: 0,
    is_active: true,
  };

  const createdTable = {
    id: 'tbl-new-00001',
    tenant_id: TENANT_ID,
    location_id: LOCATION_ID,
    number: '5',
    display_name: 'Mesa 5',
    capacity: 4,
    shape: 'SQUARE',
    status: 'AVAILABLE',
    is_active: true,
    zone_id: null,
    zones: null,
    position_x: 100,
    position_y: 200,
    width: 60,
    height: 60,
    rotation: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockLocationFound();
    mockTablesFindFirst.mockResolvedValue(null); // no duplicate
    mockTablesCount.mockResolvedValue(0);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      tables: { create: vi.fn().mockResolvedValue(createdTable) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(401);
  });

  it('returns 404 when tenant has no active location', async () => {
    mockLocationNotFound();
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Sucursal no encontrada');
  });

  it('creates table with real location_id from DB', async () => {
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(201);

    // Verify the transaction received correct tenant + location IDs
    expect(mockTransaction).toHaveBeenCalled();
    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      tables: { create: vi.fn().mockResolvedValue(createdTable) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.tables.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,  // real location, not loc-00000000...
          number: '5',
          capacity: 4,
        }),
      })
    );
  });

  it('returns 409 on duplicate table number', async () => {
    mockTablesFindFirst.mockResolvedValue({ id: 'tbl-existing', number: '5' });
    const res = await POST(makeRequest('POST', validPayload));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('El número de mesa ya existe');
  });

  it('checks duplicate using tenant_id from JWT and real location_id', async () => {
    mockTablesFindFirst.mockResolvedValue(null);
    await POST(makeRequest('POST', validPayload));

    expect(mockTablesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: TENANT_ID,
          location_id: LOCATION_ID,
          number: '5',
        }),
      })
    );
  });

  it('returns 400 on invalid payload', async () => {
    const res = await POST(makeRequest('POST', { number: '' })); // invalid: empty string
    expect(res.status).toBe(400);
  });

  it('duplicate check never uses hardcoded default location', async () => {
    await POST(makeRequest('POST', validPayload));

    const call = mockTablesFindFirst.mock.calls[0]?.[0];
    expect(call?.where?.location_id).toBe(LOCATION_ID);
    expect(call?.where?.location_id).not.toBe('loc-00000000-0000-0000-0000-000000000001');
  });
});
