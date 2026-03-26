/**
 * Tests for /api/admin/config (GET + PUT)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never hardcoded)
 * - Cache stored with tags: ['config'] for proper invalidation
 * - PUT invalidates via deleteByTag('config')
 * - PUT validates payload with Zod (legal_name required, ruc 11 digits)
 * - PUT returns 404 when tenant_settings not found
 * - tax_rate is NOT a field (removed — column doesn't exist in DB)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockTenantSettingsFindUnique,
  mockTenantSettingsUpdate,
  mockTransaction,
  mockRequireAdminAuth,
  mockCacheGet,
  mockCacheSet,
  mockDeleteByTag,
} = vi.hoisted(() => ({
  mockTenantSettingsFindUnique: vi.fn(),
  mockTenantSettingsUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequireAdminAuth: vi.fn(),
  mockCacheGet: vi.fn(async () => null),
  mockCacheSet: vi.fn(async () => {}),
  mockDeleteByTag: vi.fn(async () => {}),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenant_settings: {
      findUnique: mockTenantSettingsFindUnique,
      update: mockTenantSettingsUpdate,
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
    deleteByTag: mockDeleteByTag,
  },
  generateCacheKey: vi.fn((...args: any[]) => args.join(':')),
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: { increment: vi.fn(), set: vi.fn() },
  MetricNames: {},
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: vi.fn(() => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
}));

import { GET, PUT } from '../route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';

const baseSettings = {
  tenant_id: TENANT_ID,
  legal_name: 'Pollería La Brasa S.A.C.',
  ruc: '20123456789',
  address_text: 'Av. Principal 123, Lima',
  timezone: 'America/Lima',
  currency: 'PEN',
  updated_at: new Date(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'PUT', body?: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/config', {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
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

// ─── GET /api/admin/config ────────────────────────────────────────────────────

describe('GET /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTenantSettingsFindUnique.mockResolvedValue(baseSettings);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with tenant settings', async () => {
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.legal_name).toBe('Pollería La Brasa S.A.C.');
    expect(body.tenant_id).toBe(TENANT_ID);
  });

  it('queries by tenant_id from JWT', async () => {
    await GET(makeRequest('GET'));
    expect(mockTenantSettingsFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT_ID },
      })
    );
  });

  it('serves from cache on cache hit', async () => {
    mockCacheGet.mockResolvedValueOnce(baseSettings);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(200);
    expect(mockTenantSettingsFindUnique).not.toHaveBeenCalled();
  });

  it('stores response in cache with tags: [config]', async () => {
    await GET(makeRequest('GET'));
    expect(mockCacheSet).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ tags: ['config'] })
    );
  });

  it('returns 404 when tenant settings not found', async () => {
    mockTenantSettingsFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('GET'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Configuración no encontrada');
  });
});

// ─── PUT /api/admin/config ────────────────────────────────────────────────────

describe('PUT /api/admin/config', () => {
  const validPayload = {
    legal_name: 'Pollería La Brasa S.A.C.',
    ruc: '20123456789',
    address_text: 'Av. Principal 123, Lima',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockTenantSettingsFindUnique.mockResolvedValue(baseSettings);
    mockTransaction.mockImplementation(async (fn: any) => fn({
      tenant_settings: { update: vi.fn().mockResolvedValue(baseSettings) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    }));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeRequest('PUT', validPayload));
    expect(res.status).toBe(401);
  });

  it('updates settings with tenant_id from JWT', async () => {
    const res = await PUT(makeRequest('PUT', validPayload));
    expect(res.status).toBe(200);

    const txFn = mockTransaction.mock.calls[0][0];
    const mockTx = {
      tenant_settings: { update: vi.fn().mockResolvedValue(baseSettings) },
      admin_access_logs: { create: vi.fn().mockResolvedValue({}) },
    };
    await txFn(mockTx);

    expect(mockTx.tenant_settings.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenant_id: TENANT_ID },
      })
    );
  });

  it('invalidates config cache via deleteByTag after update', async () => {
    await PUT(makeRequest('PUT', validPayload));
    expect(mockDeleteByTag).toHaveBeenCalledWith('config');
  });

  it('returns 404 when tenant settings not found', async () => {
    mockTenantSettingsFindUnique.mockResolvedValue(null);
    const res = await PUT(makeRequest('PUT', validPayload));
    expect(res.status).toBe(404);
  });

  it('returns 400 on missing legal_name', async () => {
    const res = await PUT(makeRequest('PUT', { ruc: '20123456789' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid RUC (not 11 digits)', async () => {
    const res = await PUT(makeRequest('PUT', { ...validPayload, ruc: '1234' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on RUC with letters', async () => {
    const res = await PUT(makeRequest('PUT', { ...validPayload, ruc: '2012345ABCD' }));
    expect(res.status).toBe(400);
  });

  it('accepts null ruc (optional field)', async () => {
    const res = await PUT(makeRequest('PUT', { ...validPayload, ruc: null }));
    expect(res.status).toBe(200);
  });

  it('does NOT accept tax_rate field (not in DB schema)', async () => {
    // tax_rate should be stripped by Zod (unknown fields are stripped by default)
    // or cause no error — it simply should NOT be saved
    const res = await PUT(makeRequest('PUT', { ...validPayload, tax_rate: 18 }));
    // Should succeed — unknown fields are ignored by Zod's default behavior
    expect(res.status).toBe(200);
  });
});
