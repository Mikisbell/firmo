/**
 * Tests for:
 * - GET  /api/admin/loyalty/config
 * - PUT  /api/admin/loyalty/config
 * - GET  /api/admin/loyalty/customers/[id]
 * - GET  /api/admin/loyalty/customers/[id]/history
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id always from JWT
 * - LoyaltyService instantiated with new
 * - PUT: result pattern { success, data } | { success: false, error }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetLoyaltyConfig,
  mockUpdateLoyaltyConfig,
  mockGetBalance,
  mockGetHistory,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetLoyaltyConfig: vi.fn(),
  mockUpdateLoyaltyConfig: vi.fn(),
  mockGetBalance: vi.fn(),
  mockGetHistory: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/services/loyalty.service', () => ({
  LoyaltyService: vi.fn().mockImplementation(function (this: any) {
    this.getLoyaltyConfig = mockGetLoyaltyConfig;
    this.updateLoyaltyConfig = mockUpdateLoyaltyConfig;
    this.getBalance = mockGetBalance;
    this.getHistory = mockGetHistory;
  }),
}));

import { GET as GETConfig, PUT as PUTConfig } from '../config/route';
import { GET as GETCustomer } from '../customers/[id]/route';
import { GET as GETHistory } from '../customers/[id]/history/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const CUSTOMER_ID = 'cus00000-0000-0000-0000-000000000001';

const baseConfig = {
  enabled: true,
  points_per_sol: 1,
  redemption_rate: 100,
  tier_thresholds: { bronze: 0, silver: 500, gold: 1500 },
};

const baseBalance = {
  customer_id: CUSTOMER_ID,
  points: 250,
  tier: 'BRONZE',
  lifetime_points: 250,
};

const baseHistory = {
  entries: [
    { id: 'e-1', type: 'EARN', points: 50, created_at: new Date() },
  ],
  total: 1,
};

function makeRequest(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
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

// ─── GET /api/admin/loyalty/config ────────────────────────────────────────────

describe('GET /api/admin/loyalty/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetLoyaltyConfig.mockResolvedValue(baseConfig);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETConfig(makeRequest('/api/admin/loyalty/config'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with config', async () => {
    const res = await GETConfig(makeRequest('/api/admin/loyalty/config'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enabled).toBe(true);
    expect(body.points_per_sol).toBe(1);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETConfig(makeRequest('/api/admin/loyalty/config'));
    expect(mockGetLoyaltyConfig).toHaveBeenCalledWith(TENANT_ID);
  });

  it('returns 500 on service error', async () => {
    mockGetLoyaltyConfig.mockRejectedValue(new Error('DB error'));
    const res = await GETConfig(makeRequest('/api/admin/loyalty/config'));
    expect(res.status).toBe(500);
  });
});

// ─── PUT /api/admin/loyalty/config ────────────────────────────────────────────

describe('PUT /api/admin/loyalty/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockUpdateLoyaltyConfig.mockResolvedValue({ success: true, data: baseConfig });
  });

  const validPayload = { points_per_sol: 2, redemption_rate: 50 };

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUTConfig(makeRequest('/api/admin/loyalty/config', 'PUT', validPayload));
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await PUTConfig(makeRequest('/api/admin/loyalty/config', 'PUT', validPayload));
    expect(res.status).toBe(200);
  });

  it('passes tenant_id from JWT to service', async () => {
    await PUTConfig(makeRequest('/api/admin/loyalty/config', 'PUT', validPayload));
    expect(mockUpdateLoyaltyConfig).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
  });

  it('returns 400 on service failure', async () => {
    mockUpdateLoyaltyConfig.mockResolvedValue({ success: false, error: { message: 'Invalid config' } });
    const res = await PUTConfig(makeRequest('/api/admin/loyalty/config', 'PUT', validPayload));
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockUpdateLoyaltyConfig.mockRejectedValue(new Error('Boom'));
    const res = await PUTConfig(makeRequest('/api/admin/loyalty/config', 'PUT', validPayload));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/loyalty/customers/[id] ────────────────────────────────────

describe('GET /api/admin/loyalty/customers/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetBalance.mockResolvedValue(baseBalance);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETCustomer(makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}`), makeParams(CUSTOMER_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 with balance', async () => {
    const res = await GETCustomer(makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}`), makeParams(CUSTOMER_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points).toBe(250);
    expect(body.tier).toBe('BRONZE');
  });

  it('passes tenant_id from JWT and customer id to service', async () => {
    await GETCustomer(makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}`), makeParams(CUSTOMER_ID));
    expect(mockGetBalance).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID);
  });

  it('returns 500 on service error', async () => {
    mockGetBalance.mockRejectedValue(new Error('Not found'));
    const res = await GETCustomer(makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}`), makeParams(CUSTOMER_ID));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/loyalty/customers/[id]/history ────────────────────────────

describe('GET /api/admin/loyalty/customers/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetHistory.mockResolvedValue(baseHistory);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETHistory(
      makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}/history`),
      makeParams(CUSTOMER_ID),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with { data, total, page, limit, totalPages }', async () => {
    const res = await GETHistory(
      makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}/history`),
      makeParams(CUSTOMER_ID),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.totalPages).toBe(1);
  });

  it('passes tenant_id from JWT and customer id to service', async () => {
    await GETHistory(
      makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}/history`),
      makeParams(CUSTOMER_ID),
    );
    expect(mockGetHistory).toHaveBeenCalledWith(TENANT_ID, CUSTOMER_ID, 1, 20);
  });

  it('returns 500 on service error', async () => {
    mockGetHistory.mockRejectedValue(new Error('DB error'));
    const res = await GETHistory(
      makeRequest(`/api/admin/loyalty/customers/${CUSTOMER_ID}/history`),
      makeParams(CUSTOMER_ID),
    );
    expect(res.status).toBe(500);
  });
});
