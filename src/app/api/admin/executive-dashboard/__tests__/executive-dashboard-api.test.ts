/**
 * Tests for:
 * - GET /api/admin/executive-dashboard
 *
 * Key behavior:
 * - requireAdminPermission('view_reports') — not just auth
 * - tenant_id from JWT
 * - Zod validation: preset, start, end required
 * - start > end → 400
 * - diffDays > 90 → 400
 * - Returns service data on success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminPermission,
  mockGetData,
} = vi.hoisted(() => ({
  mockRequireAdminPermission: vi.fn(),
  mockGetData: vi.fn(),
}));

vi.mock('@/src/core/middleware', () => ({
  requireAdminPermission: mockRequireAdminPermission,
}));

vi.mock('@/src/core/services/executive-dashboard.service', () => ({
  ExecutiveDashboardService: vi.fn().mockImplementation(function (this: any) {
    this.getData = mockGetData;
  }),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

import { GET } from '../route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseDashboardData = {
  revenue: { total: 150000, previous: 120000, change: 25 },
  orders: { total: 300, previous: 250, change: 20 },
  topProducts: [],
};

function makeRequest(query = ''): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/admin/executive-dashboard${query}`,
    { method: 'GET', headers: { cookie: 'auth_token=test-token' } },
  );
}

function mockAuthOk() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

const VALID_QUERY = '?preset=today&start=2026-03-01&end=2026-03-26';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/executive-dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetData.mockResolvedValue(baseDashboardData);
  });

  it('returns 403 without permission', async () => {
    mockAuthFail();
    const res = await GET(makeRequest(VALID_QUERY));
    expect(res.status).toBe(403);
  });

  it('calls requireAdminPermission with view_reports', async () => {
    await GET(makeRequest(VALID_QUERY));
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(
      expect.any(Object),
      'view_reports',
    );
  });

  it('returns 200 with dashboard data', async () => {
    const res = await GET(makeRequest(VALID_QUERY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenue).toBeDefined();
    expect(body.orders).toBeDefined();
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest(VALID_QUERY));
    expect(mockGetData).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ preset: 'today' }),
    );
  });

  it('returns 400 on missing query params (Zod)', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GET(makeRequest('?preset=today&start=01-03-2026&end=26-03-2026'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when start > end', async () => {
    const res = await GET(makeRequest('?preset=custom&start=2026-03-26&end=2026-03-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when range exceeds 90 days', async () => {
    const res = await GET(makeRequest('?preset=custom&start=2026-01-01&end=2026-04-10'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service error', async () => {
    mockGetData.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest(VALID_QUERY));
    expect(res.status).toBe(500);
  });
});
