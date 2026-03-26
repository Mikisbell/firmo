/**
 * Tests for:
 * - GET /api/admin/mesas/qr
 *
 * Key behavior:
 * - Auth required
 * - tenant_id from JWT
 * - Falls back to getTenantLocationId if location_id not provided
 * - 404 if no location found
 * - result pattern: { success, data } | { success: false, error }
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetTenantLocationId,
  mockGenerateAllTableQRs,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetTenantLocationId: vi.fn(),
  mockGenerateAllTableQRs: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/locations/location.helpers', () => ({
  getTenantLocationId: mockGetTenantLocationId,
}));

vi.mock('@/src/core/tables/table-qr.service', () => ({
  tableQrService: { generateAllTableQRs: mockGenerateAllTableQRs },
}));

import { GET } from '../qr/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const LOCATION_ID = 'loc00000-0000-0000-0000-000000000001';

const baseQRs = [
  { tableId: 'tbl-1', tableNumber: 1, qrDataUrl: 'data:image/png;base64,abc' },
  { tableId: 'tbl-2', tableNumber: 2, qrDataUrl: 'data:image/png;base64,def' },
];

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/mesas/qr${query}`, {
    method: 'GET',
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

describe('GET /api/admin/mesas/qr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetTenantLocationId.mockResolvedValue(LOCATION_ID);
    mockGenerateAllTableQRs.mockResolvedValue({ success: true, data: baseQRs });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with { items }', async () => {
    const res = await GET(makeRequest(`?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
  });

  it('uses location_id from query param when provided', async () => {
    await GET(makeRequest(`?location_id=${LOCATION_ID}`));
    expect(mockGetTenantLocationId).not.toHaveBeenCalled();
    expect(mockGenerateAllTableQRs).toHaveBeenCalledWith(TENANT_ID, LOCATION_ID, expect.any(String));
  });

  it('falls back to getTenantLocationId when location_id not provided', async () => {
    await GET(makeRequest());
    expect(mockGetTenantLocationId).toHaveBeenCalledWith(TENANT_ID);
    expect(mockGenerateAllTableQRs).toHaveBeenCalledWith(TENANT_ID, LOCATION_ID, expect.any(String));
  });

  it('returns 404 when no location found', async () => {
    mockGetTenantLocationId.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(404);
  });

  it('returns 400 on service failure', async () => {
    mockGenerateAllTableQRs.mockResolvedValue({ success: false, error: { message: 'No tables found' } });
    const res = await GET(makeRequest(`?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockGenerateAllTableQRs.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeRequest(`?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(500);
  });
});
