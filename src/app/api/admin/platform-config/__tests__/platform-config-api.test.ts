/**
 * Tests for:
 * - GET   /api/admin/platform-config
 * - PATCH /api/admin/platform-config
 *
 * Key behavior:
 * - Auth required on both
 * - tenant_id from JWT
 * - PATCH: validates platform enum (PEDIDOSYA|LLAMAFOOD|RAPPI)
 * - PATCH: commissionRate/markupRate must be 0-1
 * - result pattern: { success, data } | { success: false, error }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetConfig,
  mockUpdateConfig,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetConfig: vi.fn(),
  mockUpdateConfig: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/services/platform-order.service', () => ({
  PlatformOrderService: vi.fn().mockImplementation(function (this: any) {
    this.getConfig = mockGetConfig;
    this.updateConfig = mockUpdateConfig;
  }),
}));

import { GET, PATCH } from '../route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const baseConfigs = [
  { platform: 'PEDIDOSYA', isActive: true, storeId: 'store-123', commissionRate: 0.15 },
  { platform: 'RAPPI', isActive: false, storeId: null, commissionRate: 0.18 },
];

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

describe('GET /api/admin/platform-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetConfig.mockResolvedValue({ success: true, data: baseConfigs });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('/api/admin/platform-config'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { configs }', async () => {
    const res = await GET(makeRequest('/api/admin/platform-config'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configs).toHaveLength(2);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest('/api/admin/platform-config'));
    expect(mockGetConfig).toHaveBeenCalledWith(TENANT_ID, undefined);
  });

  it('filters by platform when provided', async () => {
    await GET(makeRequest('/api/admin/platform-config?platform=PEDIDOSYA'));
    expect(mockGetConfig).toHaveBeenCalledWith(TENANT_ID, 'PEDIDOSYA');
  });

  it('returns 400 on service failure', async () => {
    mockGetConfig.mockResolvedValue({ success: false, error: { message: 'Config not found' } });
    const res = await GET(makeRequest('/api/admin/platform-config'));
    expect(res.status).toBe(400);
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/platform-config', () => {
  const validBody = { platform: 'PEDIDOSYA', isActive: true, commissionRate: 0.15 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockUpdateConfig.mockResolvedValue({ success: true, data: baseConfigs[0] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(makeRequest('/api/admin/platform-config', 'PATCH', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { config } on success', async () => {
    const res = await PATCH(makeRequest('/api/admin/platform-config', 'PATCH', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toBeDefined();
  });

  it('passes tenant_id from JWT to service', async () => {
    await PATCH(makeRequest('/api/admin/platform-config', 'PATCH', validBody));
    expect(mockUpdateConfig).toHaveBeenCalledWith(TENANT_ID, 'PEDIDOSYA', expect.any(Object));
  });

  it('returns 400 on invalid platform', async () => {
    const res = await PATCH(makeRequest('/api/admin/platform-config', 'PATCH', { platform: 'UBER_EATS' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on commissionRate > 1', async () => {
    const res = await PATCH(
      makeRequest('/api/admin/platform-config', 'PATCH', { platform: 'RAPPI', commissionRate: 1.5 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockUpdateConfig.mockResolvedValue({ success: false, error: { message: 'Update failed' } });
    const res = await PATCH(makeRequest('/api/admin/platform-config', 'PATCH', validBody));
    expect(res.status).toBe(400);
  });
});
