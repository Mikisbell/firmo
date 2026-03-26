/**
 * Tests for GET /api/admin/facturacion/stats
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - Invalid query params (bad date format) → 400 (not 500)
 * - Service error → 500
 * - Success → 200 with stats data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockRequireAdminAuth, mockGetInvoiceStats } = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetInvoiceStats: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/services/invoice.service', () => ({
  invoiceService: { getInvoiceStats: mockGetInvoiceStats },
}));

import { GET } from '../stats/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';

const baseStats = { total: 10, emitidas: 8, pendientes: 2, anuladas: 0, totalCents: 150000 };

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/facturacion/stats${query}`, {
    headers: { cookie: 'auth_token=test-token' },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/admin/facturacion/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetInvoiceStats.mockResolvedValue({ success: true, data: baseStats });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with stats data', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(10);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest());
    expect(mockGetInvoiceStats).toHaveBeenCalled();
    expect(mockGetInvoiceStats.mock.calls[0][0]).toBe(TENANT_ID);
  });

  it('returns 400 on invalid date format (ZodError → 400, not 500)', async () => {
    const res = await GET(makeRequest('?from=26-03-2026'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service failure', async () => {
    mockGetInvoiceStats.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
