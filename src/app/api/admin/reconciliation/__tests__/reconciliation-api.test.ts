/**
 * Tests for:
 * - GET   /api/admin/reconciliation              (list settlements — optional status/method filters)
 * - POST  /api/admin/reconciliation              (generate settlement period — validates date format)
 * - PATCH /api/admin/reconciliation/[id]         (record actual received — validates receivedCents ≥ 0)
 * - GET   /api/admin/reconciliation/export       (XLSX export — requires start + end dates)
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id from JWT
 * - POST: start + end must match YYYY-MM-DD
 * - PATCH: receivedCents is int ≥ 0
 * - Export: returns application/vnd.openxmlformats... Content-Type
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetSettlements,
  mockGenerateSettlementPeriod,
  mockRecordActualReceived,
  mockGetDiscrepancyReport,
  mockGenerateExcel,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetSettlements: vi.fn(),
  mockGenerateSettlementPeriod: vi.fn(),
  mockRecordActualReceived: vi.fn(),
  mockGetDiscrepancyReport: vi.fn(),
  mockGenerateExcel: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/services/reconciliation.service', () => ({
  ReconciliationService: vi.fn().mockImplementation(function (this: any) {
    this.getSettlements = mockGetSettlements;
    this.generateSettlementPeriod = mockGenerateSettlementPeriod;
    this.recordActualReceived = mockRecordActualReceived;
    this.getDiscrepancyReport = mockGetDiscrepancyReport;
  }),
}));

vi.mock('@/src/core/services/export.service', () => ({
  exportService: { generateExcel: mockGenerateExcel },
}));

import { GET as GETList, POST } from '../route';
import { PATCH } from '../[id]/route';
import { GET as GETExport } from '../export/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const SETTLEMENT_ID = 'b0000000-0000-0000-0000-000000000001';

const baseSettlement = {
  id: SETTLEMENT_ID,
  method: 'CASH',
  expectedCents: 10000,
  receivedCents: null,
  status: 'PENDING',
};

const baseDiscrepancy = {
  byMethod: [
    { method: 'CASH', expectedCents: 10000, receivedCents: 9500, differenceCents: -500, status: 'PARTIAL' },
  ],
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

// ─── GET /api/admin/reconciliation ───────────────────────────────────────────

describe('GET /api/admin/reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetSettlements.mockResolvedValue({ success: true, data: [baseSettlement] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETList(makeRequest('/api/admin/reconciliation'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { settlements }', async () => {
    const res = await GETList(makeRequest('/api/admin/reconciliation'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settlements).toHaveLength(1);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETList(makeRequest('/api/admin/reconciliation'));
    expect(mockGetSettlements).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
  });

  it('passes status filter when provided', async () => {
    await GETList(makeRequest('/api/admin/reconciliation?status=PENDING'));
    expect(mockGetSettlements).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ status: 'PENDING' }),
    );
  });

  it('returns 400 on service failure', async () => {
    mockGetSettlements.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GETList(makeRequest('/api/admin/reconciliation'));
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/admin/reconciliation ──────────────────────────────────────────

describe('POST /api/admin/reconciliation', () => {
  const validBody = { start: '2026-03-01', end: '2026-03-26' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGenerateSettlementPeriod.mockResolvedValue({ success: true, data: [baseSettlement] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('/api/admin/reconciliation', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 201 with { settlements } on success', async () => {
    const res = await POST(makeRequest('/api/admin/reconciliation', 'POST', validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.settlements).toBeDefined();
  });

  it('passes tenant_id from JWT to service', async () => {
    await POST(makeRequest('/api/admin/reconciliation', 'POST', validBody));
    expect(mockGenerateSettlementPeriod).toHaveBeenCalledWith(
      TENANT_ID,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('returns 400 on invalid date format', async () => {
    const res = await POST(
      makeRequest('/api/admin/reconciliation', 'POST', { start: '01-03-2026', end: '26-03-2026' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing dates', async () => {
    const res = await POST(makeRequest('/api/admin/reconciliation', 'POST', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockGenerateSettlementPeriod.mockResolvedValue({ success: false, error: { message: 'Period already exists' } });
    const res = await POST(makeRequest('/api/admin/reconciliation', 'POST', validBody));
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/admin/reconciliation/[id] ────────────────────────────────────

describe('PATCH /api/admin/reconciliation/[id]', () => {
  const validBody = { receivedCents: 9500, notes: 'Checked manually' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockRecordActualReceived.mockResolvedValue({ success: true, data: { ...baseSettlement, receivedCents: 9500 } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', validBody),
      makeParams(SETTLEMENT_ID),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', validBody),
      makeParams(SETTLEMENT_ID),
    );
    expect(res.status).toBe(200);
  });

  it('passes tenant_id + employee_id + id to service', async () => {
    await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', validBody),
      makeParams(SETTLEMENT_ID),
    );
    expect(mockRecordActualReceived).toHaveBeenCalledWith(
      TENANT_ID,
      SETTLEMENT_ID,
      9500,
      EMPLOYEE_ID,
      'Checked manually',
    );
  });

  it('returns 400 on negative receivedCents', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', { receivedCents: -100 }),
      makeParams(SETTLEMENT_ID),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing receivedCents', async () => {
    const res = await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', { notes: 'ok' }),
      makeParams(SETTLEMENT_ID),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockRecordActualReceived.mockResolvedValue({ success: false, error: { message: 'Settlement not found' } });
    const res = await PATCH(
      makeRequest(`/api/admin/reconciliation/${SETTLEMENT_ID}`, 'PATCH', validBody),
      makeParams(SETTLEMENT_ID),
    );
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/reconciliation/export ────────────────────────────────────

describe('GET /api/admin/reconciliation/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetDiscrepancyReport.mockResolvedValue({ success: true, data: baseDiscrepancy });
    mockGenerateExcel.mockResolvedValue(Buffer.from('xlsx-data'));
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETExport(makeRequest('/api/admin/reconciliation/export?start=2026-03-01&end=2026-03-26'));
    expect(res.status).toBe(401);
  });

  it('returns XLSX content-type on success', async () => {
    const res = await GETExport(makeRequest('/api/admin/reconciliation/export?start=2026-03-01&end=2026-03-26'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETExport(makeRequest('/api/admin/reconciliation/export?start=2026-03-01&end=2026-03-26'));
    expect(mockGetDiscrepancyReport).toHaveBeenCalledWith(TENANT_ID, expect.any(Object));
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GETExport(makeRequest('/api/admin/reconciliation/export?start=01-03-2026&end=26-03-2026'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing dates', async () => {
    const res = await GETExport(makeRequest('/api/admin/reconciliation/export'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on service failure', async () => {
    mockGetDiscrepancyReport.mockResolvedValue({ success: false, error: { message: 'No data' } });
    const res = await GETExport(makeRequest('/api/admin/reconciliation/export?start=2026-03-01&end=2026-03-26'));
    expect(res.status).toBe(400);
  });
});
