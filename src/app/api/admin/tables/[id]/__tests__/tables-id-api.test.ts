/**
 * Tests for /api/admin/tables/[id] (GET, PUT, DELETE)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockLocFindFirst,
  mockTablesFindFirst,
  mockTablesCount,
  mockZonesFindFirst,
  mockTransaction,
  mockRequireAdminAuth,
} = vi.hoisted(() => ({
  mockLocFindFirst: vi.fn(),
  mockTablesFindFirst: vi.fn(),
  mockTablesCount: vi.fn(),
  mockZonesFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    locations: { findFirst: mockLocFindFirst },
    tables: {
      findFirst: mockTablesFindFirst,
      count: mockTablesCount,
    },
    zones: { findFirst: mockZonesFindFirst },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
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
  metrics: { increment: vi.fn(), set: vi.fn(), gauge: vi.fn() },
}));

import { GET, PUT, DELETE } from '../route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const LOCATION_ID = '9bc7e15f-ca13-43aa-a647-b1e4d46529fd';
const TABLE_ID = 'c6b2eedb-3b3c-449a-a91d-eae3b0fb9494';
const ZONE_ID = 'zone-0000-0000-0000-000000000001';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

const mockTable = {
  id: TABLE_ID,
  tenant_id: TENANT_ID,
  location_id: LOCATION_ID,
  zone_id: ZONE_ID,
  number: '5',
  display_name: 'Mesa 5',
  capacity: 4,
  shape: 'SQUARE',
  status: 'AVAILABLE',
  current_order_id: null,
  occupied_since: null,
  is_merged: false,
  merged_table_ids: [],
  parent_table_id: null,
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  position_x: 0,
  position_y: 0,
  width: 60,
  height: 60,
  rotation: 0,
  zones: { id: ZONE_ID, code: 'A', name: 'Zona A', color: '#4CAF50' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'PUT' | 'DELETE', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/tables/${TABLE_ID}`, {
    method,
    headers: {
      cookie: 'auth_token=test-token',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id = TABLE_ID) {
  return { params: Promise.resolve({ id }) };
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

function mockTxUpdate(result: any) {
  mockTransaction.mockImplementation(async (fn: any) =>
    fn({
      tables: { update: vi.fn().mockResolvedValue(result) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── GET /api/admin/tables/[id] ───────────────────────────────────────────────

describe('GET /api/admin/tables/[id]', () => {
  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 200 with table data including zone alias', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(mockTable);
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(TABLE_ID);
    expect(body.number).toBe('5');
    expect(body.zone).toEqual({ id: ZONE_ID, code: 'A', name: 'Zona A', color: '#4CAF50' });
  });

  it('returns 200 with null zone when table has no zone', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue({ ...mockTable, zone_id: null, zones: null });
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zone).toBeNull();
  });

  it('returns 404 when table not found', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Mesa no encontrada');
  });

  it('returns 404 for table belonging to different tenant (tenant isolation)', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(null); // tenant_id scoped → not found
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(404);
    // Verify tenant_id filter was applied
    expect(mockTablesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) })
    );
  });

  it('returns 500 with JSON body when DB throws', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockRejectedValue(new Error('DB connection lost'));
    const res = await GET(makeRequest('GET'), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Error al obtener mesa');
  });
});

// ─── PUT /api/admin/tables/[id] ───────────────────────────────────────────────

describe('PUT /api/admin/tables/[id]', () => {
  const validPayload = { number: '10', capacity: 6 };
  const updatedTable = { ...mockTable, number: '10', capacity: 6 };

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeRequest('PUT', validPayload), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when table not found', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(null); // table not found
    const res = await PUT(makeRequest('PUT', validPayload), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Mesa no encontrada');
  });

  it('returns 409 on duplicate number', async () => {
    mockAuthOk();
    mockTablesFindFirst
      .mockResolvedValueOnce(mockTable)           // existing check: found
      .mockResolvedValueOnce({ id: 'other-id' }); // duplicate found in same location
    const res = await PUT(makeRequest('PUT', validPayload), makeParams());
    expect(res.status).toBe(409);
  });

  it('returns 200 on successful update', async () => {
    mockAuthOk();
    mockTablesFindFirst
      .mockResolvedValueOnce(mockTable) // existing check
      .mockResolvedValueOnce(null);     // no duplicate for number '10'
    mockTxUpdate(updatedTable);
    const res = await PUT(makeRequest('PUT', validPayload), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.number).toBe('10');
  });

  it('uses existing table location_id for duplicate check (not getTenantLocationId)', async () => {
    mockAuthOk();
    mockTablesFindFirst
      .mockResolvedValueOnce(mockTable)
      .mockResolvedValueOnce(null);
    mockTxUpdate(updatedTable);
    await PUT(makeRequest('PUT', validPayload), makeParams());
    // Duplicate check must use existing.location_id, not a separate DB call
    expect(mockLocFindFirst).not.toHaveBeenCalled();
    expect(mockTablesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ location_id: LOCATION_ID }),
      })
    );
  });

  it('returns 400 on invalid payload', async () => {
    mockAuthOk();
    const res = await PUT(makeRequest('PUT', { capacity: -1 }), makeParams());
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /api/admin/tables/[id] ────────────────────────────────────────────

describe('DELETE /api/admin/tables/[id]', () => {
  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await DELETE(makeRequest('DELETE'), makeParams());
    expect(res.status).toBe(401);
  });

  it('returns 404 when table not found', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(null);
    const res = await DELETE(makeRequest('DELETE'), makeParams());
    expect(res.status).toBe(404);
  });

  it('returns 400 when table has active order', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue({ ...mockTable, current_order_id: 'order-123' });
    const res = await DELETE(makeRequest('DELETE'), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No se puede eliminar mesa con orden activa');
  });

  it('returns 200 on successful soft delete', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(mockTable);
    mockTablesCount.mockResolvedValue(4);
    mockTransaction.mockImplementation(async (fn: any) =>
      fn({
        tables: { update: vi.fn().mockResolvedValue({}) },
        admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
      })
    );
    const res = await DELETE(makeRequest('DELETE'), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('scopes query by tenant_id from JWT', async () => {
    mockAuthOk();
    mockTablesFindFirst.mockResolvedValue(null);
    await DELETE(makeRequest('DELETE'), makeParams());
    expect(mockTablesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) })
    );
  });
});
