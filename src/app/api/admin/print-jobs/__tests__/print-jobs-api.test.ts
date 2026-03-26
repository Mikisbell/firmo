/**
 * Tests for:
 * - GET   /api/admin/print-jobs           (pending jobs, optional printer_id filter)
 * - POST  /api/admin/print-jobs           (create job — validates jobType enum)
 * - PATCH /api/admin/print-jobs/[id]/status (SENT | PRINTED | FAILED → different service methods)
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id from JWT
 * - GET: optional printer_id filter
 * - POST: jobType must be RECEIPT | KITCHEN_TICKET | PRE_CHECK | INVOICE
 * - PATCH: status drives which service method is called (markJobSent/Printed/Failed)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetPendingJobs,
  mockCreatePrintJob,
  mockMarkJobSent,
  mockMarkJobPrinted,
  mockMarkJobFailed,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetPendingJobs: vi.fn(),
  mockCreatePrintJob: vi.fn(),
  mockMarkJobSent: vi.fn(),
  mockMarkJobPrinted: vi.fn(),
  mockMarkJobFailed: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/services/print-job.service', () => ({
  PrintJobService: vi.fn().mockImplementation(function (this: any) {
    this.getPendingJobs = mockGetPendingJobs;
    this.createPrintJob = mockCreatePrintJob;
    this.markJobSent = mockMarkJobSent;
    this.markJobPrinted = mockMarkJobPrinted;
    this.markJobFailed = mockMarkJobFailed;
  }),
}));

import { GET, POST } from '../route';
import { PATCH } from '../[id]/status/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const JOB_ID = 'b0000000-0000-0000-0000-000000000001';
const PRINTER_ID = 'c0000000-0000-0000-0000-000000000001';

const baseJob = { id: JOB_ID, jobType: 'RECEIPT', status: 'PENDING', tenantId: TENANT_ID };

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

// ─── GET /api/admin/print-jobs ────────────────────────────────────────────────

describe('GET /api/admin/print-jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetPendingJobs.mockResolvedValue({ success: true, data: [baseJob] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('/api/admin/print-jobs'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { jobs }', async () => {
    const res = await GET(makeRequest('/api/admin/print-jobs'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobs).toHaveLength(1);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GET(makeRequest('/api/admin/print-jobs'));
    expect(mockGetPendingJobs).toHaveBeenCalledWith(TENANT_ID, undefined);
  });

  it('passes printer_id filter when provided', async () => {
    await GET(makeRequest(`/api/admin/print-jobs?printer_id=${PRINTER_ID}`));
    expect(mockGetPendingJobs).toHaveBeenCalledWith(TENANT_ID, PRINTER_ID);
  });

  it('returns 400 on service failure', async () => {
    mockGetPendingJobs.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GET(makeRequest('/api/admin/print-jobs'));
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/print-jobs ───────────────────────────────────────────────

describe('POST /api/admin/print-jobs', () => {
  const validBody = { jobType: 'RECEIPT', payload: { orderId: '123' } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCreatePrintJob.mockResolvedValue({ success: true, data: baseJob });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('/api/admin/print-jobs', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 201 on success', async () => {
    const res = await POST(makeRequest('/api/admin/print-jobs', 'POST', validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.job).toBeDefined();
  });

  it('passes tenant_id + employee_id from JWT to service', async () => {
    await POST(makeRequest('/api/admin/print-jobs', 'POST', validBody));
    expect(mockCreatePrintJob).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID, actorId: EMPLOYEE_ID, jobType: 'RECEIPT' }),
    );
  });

  it('returns 400 on invalid jobType', async () => {
    const res = await POST(
      makeRequest('/api/admin/print-jobs', 'POST', { jobType: 'INVALID_TYPE' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing jobType', async () => {
    const res = await POST(makeRequest('/api/admin/print-jobs', 'POST', { payload: {} }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockCreatePrintJob.mockResolvedValue({ success: false, error: { message: 'Printer offline' } });
    const res = await POST(makeRequest('/api/admin/print-jobs', 'POST', validBody));
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/admin/print-jobs/[id]/status ──────────────────────────────────

describe('PATCH /api/admin/print-jobs/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockMarkJobSent.mockResolvedValue({ success: true });
    mockMarkJobPrinted.mockResolvedValue({ success: true });
    mockMarkJobFailed.mockResolvedValue({ success: true });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'SENT' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 and calls markJobSent for SENT status', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'SENT' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(200);
    expect(mockMarkJobSent).toHaveBeenCalledWith(TENANT_ID, JOB_ID);
  });

  it('calls markJobPrinted for PRINTED status', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'PRINTED' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(200);
    expect(mockMarkJobPrinted).toHaveBeenCalledWith(TENANT_ID, JOB_ID);
  });

  it('calls markJobFailed for FAILED status', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'FAILED' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(200);
    expect(mockMarkJobFailed).toHaveBeenCalledWith(TENANT_ID, JOB_ID);
  });

  it('returns 400 on invalid status', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'INVALID' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockMarkJobSent.mockResolvedValue({ success: false, error: { message: 'Job not found' } });
    const res = await PATCH(
      makeRequest(`/api/admin/print-jobs/${JOB_ID}/status`, 'PATCH', { status: 'SENT' }),
      makeParams(JOB_ID),
    );
    expect(res.status).toBe(400);
  });
});
