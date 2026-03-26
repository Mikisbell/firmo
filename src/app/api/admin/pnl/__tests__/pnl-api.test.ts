/**
 * Tests for GET /api/admin/pnl
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - Requires start + end date params (YYYY-MM-DD)
 * - Returns 400 on missing or invalid dates
 * - Returns 400 when service reports failure
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockRequireAdminAuth,
  mockGeneratePnL,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGeneratePnL: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

vi.mock('@/src/core/services/pnl-report.service', () => ({
  PnLReportService: vi.fn().mockImplementation(function (this: any) {
    this.generatePnL = mockGeneratePnL;
  }),
}));

import { GET } from '../route';

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const basePnL = {
  revenue: 500000,
  cogs: 200000,
  grossProfit: 300000,
  grossMargin: 0.6,
  period: { start: '2026-01-01', end: '2026-03-31' },
};

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/pnl${query}`, {
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

describe('GET /api/admin/pnl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGeneratePnL.mockResolvedValue({ success: true, data: basePnL });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('?start=2026-01-01&end=2026-03-31'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with P&L data', async () => {
    const res = await GET(makeRequest('?start=2026-01-01&end=2026-03-31'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenue).toBe(500000);
    expect(body.grossMargin).toBe(0.6);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest('?start=2026-01-01&end=2026-03-31'));
    expect(mockGeneratePnL).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    );
  });

  it('returns 400 on missing start param', async () => {
    const res = await GET(makeRequest('?end=2026-03-31'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing end param', async () => {
    const res = await GET(makeRequest('?start=2026-01-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GET(makeRequest('?start=01/01/2026&end=31/03/2026'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when service reports failure', async () => {
    mockGeneratePnL.mockResolvedValue({ success: false, error: { message: 'No hay datos para el período' } });
    const res = await GET(makeRequest('?start=2026-01-01&end=2026-03-31'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockGeneratePnL.mockRejectedValue(new Error('DB crash'));
    const res = await GET(makeRequest('?start=2026-01-01&end=2026-03-31'));
    expect(res.status).toBe(500);
  });
});
