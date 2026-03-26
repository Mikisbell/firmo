/**
 * Tests for:
 * - POST /api/admin/petty-cash/[id]/approve
 * - POST /api/admin/petty-cash/reconcile
 *
 * Key behavior:
 * - Auth required on both
 * - tenant_id + employee_id from JWT
 * - approve: result pattern { success } | { success: false, error }
 * - reconcile: Zod validates locationId (uuid) + countedAmount (int ≥ 0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockApproveTransaction,
  mockReconcile,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockApproveTransaction: vi.fn(),
  mockReconcile: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/services/petty-cash.service', () => ({
  PettyCashService: vi.fn().mockImplementation(function (this: any) {
    this.approveTransaction = mockApproveTransaction;
    this.reconcile = mockReconcile;
  }),
}));

import { POST as POSTApprove } from '../[id]/approve/route';
import { POST as POSTReconcile } from '../reconcile/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const TX_ID = 'tx000000-0000-0000-0000-000000000001';
const LOCATION_ID = 'b0000000-0000-0000-0000-000000000001';

function makeRequest(url: string, method = 'POST', body?: object): NextRequest {
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

// ─── POST /api/admin/petty-cash/[id]/approve ──────────────────────────────────

describe('POST /api/admin/petty-cash/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockApproveTransaction.mockResolvedValue({ success: true });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTApprove(makeRequest(`/api/admin/petty-cash/${TX_ID}/approve`), makeParams(TX_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTApprove(makeRequest(`/api/admin/petty-cash/${TX_ID}/approve`), makeParams(TX_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('passes tenant_id + employee_id + tx_id from JWT to service', async () => {
    await POSTApprove(makeRequest(`/api/admin/petty-cash/${TX_ID}/approve`), makeParams(TX_ID));
    expect(mockApproveTransaction).toHaveBeenCalledWith(TENANT_ID, TX_ID, EMPLOYEE_ID);
  });

  it('returns 400 on service failure', async () => {
    mockApproveTransaction.mockResolvedValue({ success: false, error: { message: 'Transaction not found' } });
    const res = await POSTApprove(makeRequest(`/api/admin/petty-cash/${TX_ID}/approve`), makeParams(TX_ID));
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/petty-cash/reconcile ────────────────────────────────────

describe('POST /api/admin/petty-cash/reconcile', () => {
  const validBody = { locationId: LOCATION_ID, countedAmount: 25000 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockReconcile.mockResolvedValue({ success: true, data: { reconciled: true } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTReconcile(makeRequest('/api/admin/petty-cash/reconcile', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTReconcile(makeRequest('/api/admin/petty-cash/reconcile', 'POST', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reconciled).toBe(true);
  });

  it('passes tenant_id + employee_id from JWT to service', async () => {
    await POSTReconcile(makeRequest('/api/admin/petty-cash/reconcile', 'POST', validBody));
    expect(mockReconcile).toHaveBeenCalledWith(TENANT_ID, LOCATION_ID, 25000, EMPLOYEE_ID);
  });

  it('returns 400 on invalid locationId (not a UUID)', async () => {
    const res = await POSTReconcile(
      makeRequest('/api/admin/petty-cash/reconcile', 'POST', { locationId: 'not-a-uuid', countedAmount: 1000 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on negative countedAmount', async () => {
    const res = await POSTReconcile(
      makeRequest('/api/admin/petty-cash/reconcile', 'POST', { locationId: LOCATION_ID, countedAmount: -100 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockReconcile.mockResolvedValue({ success: false, error: { message: 'Balance not found' } });
    const res = await POSTReconcile(makeRequest('/api/admin/petty-cash/reconcile', 'POST', validBody));
    expect(res.status).toBe(400);
  });

  it('returns 500 on unexpected error', async () => {
    mockReconcile.mockRejectedValue(new Error('DB error'));
    const res = await POSTReconcile(makeRequest('/api/admin/petty-cash/reconcile', 'POST', validBody));
    expect(res.status).toBe(500);
  });
});
