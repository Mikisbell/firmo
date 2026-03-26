/**
 * Tests for:
 * - GET /api/admin/settings/yape-plin  (read Yape/Plin config — returns empty object if not set)
 * - PUT /api/admin/settings/yape-plin  (update — validates phone format 9XXXXXXXX, name ≤ 100 chars)
 *
 * Key behavior:
 * - Auth required on both
 * - tenant_id from JWT
 * - GET: returns nulls when settings not found
 * - PUT: peruPhoneSchema requires 9 digits starting with 9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockFindUnique,
  mockUpdate,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    tenant_settings: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

import { GET, PUT } from '../yape-plin/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseSettings = {
  yape_merchant_phone: '912345678',
  yape_merchant_name: 'Mi Pollería',
  plin_merchant_phone: '987654321',
  plin_merchant_name: 'Mi Pollería PLIN',
};

function makeRequest(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/settings/yape-plin ───────────────────────────────────────

describe('GET /api/admin/settings/yape-plin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockFindUnique.mockResolvedValue(baseSettings);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('/api/admin/settings/yape-plin'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with settings', async () => {
    const res = await GET(makeRequest('/api/admin/settings/yape-plin'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yape_merchant_phone).toBe('912345678');
  });

  it('returns nulls when settings not found', async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(makeRequest('/api/admin/settings/yape-plin'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yape_merchant_phone).toBeNull();
    expect(body.plin_merchant_phone).toBeNull();
  });

  it('queries by tenant_id from JWT', async () => {
    await GET(makeRequest('/api/admin/settings/yape-plin'));
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_ID } }),
    );
  });
});

// ─── PUT /api/admin/settings/yape-plin ───────────────────────────────────────

describe('PUT /api/admin/settings/yape-plin', () => {
  const validBody = { yape_merchant_phone: '912345678', yape_merchant_name: 'Mi Pollería' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockUpdate.mockResolvedValue(baseSettings);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUT(makeRequest('/api/admin/settings/yape-plin', 'PUT', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 200 with updated settings', async () => {
    const res = await PUT(makeRequest('/api/admin/settings/yape-plin', 'PUT', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.yape_merchant_phone).toBeDefined();
  });

  it('updates by tenant_id from JWT', async () => {
    await PUT(makeRequest('/api/admin/settings/yape-plin', 'PUT', validBody));
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: TENANT_ID } }),
    );
  });

  it('returns 400 on invalid phone format (not 9 digits starting with 9)', async () => {
    const res = await PUT(
      makeRequest('/api/admin/settings/yape-plin', 'PUT', { yape_merchant_phone: '712345678' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on phone too short', async () => {
    const res = await PUT(
      makeRequest('/api/admin/settings/yape-plin', 'PUT', { yape_merchant_phone: '91234567' }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts null phone (clear setting)', async () => {
    const res = await PUT(
      makeRequest('/api/admin/settings/yape-plin', 'PUT', { yape_merchant_phone: null }),
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 on name exceeding 100 chars', async () => {
    const res = await PUT(
      makeRequest('/api/admin/settings/yape-plin', 'PUT', { yape_merchant_name: 'A'.repeat(101) }),
    );
    expect(res.status).toBe(400);
  });
});
