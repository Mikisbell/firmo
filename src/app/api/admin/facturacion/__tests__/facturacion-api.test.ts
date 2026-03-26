/**
 * Tests for:
 * - GET  /api/admin/facturacion           (list invoices)
 * - GET  /api/admin/facturacion/stats
 * - GET  /api/admin/facturacion/[id]      (invoice detail + CDR)
 * - POST /api/admin/facturacion/[id]/void
 * - GET  /api/admin/facturacion/[id]/pdf
 * - GET  /api/admin/facturacion/resumenes-diarios
 * - POST /api/admin/facturacion/resumenes-diarios
 *
 * Key behavior:
 * - Auth required on all (requireAdminAuth or requireAdminPermission)
 * - tenant_id always from JWT
 * - Void: error.code maps to HTTP status (NOT_FOUND→404, CONFLICT→409, FORBIDDEN→403)
 * - Detail: enriches with sunat_status + cdr object
 * - Resumenes: 409 if summary already ACCEPTED
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockRequireAdminPermission,
  mockInvoicesFindMany,
  mockInvoicesCount,
  mockInvoicesFindFirst,
  mockInvoiceCdrFindFirst,
  mockTenantSettingsFindUnique,
  mockOrdersFindFirst,
  mockDailySummaryFindMany,
  mockDailySummaryCount,
  mockDailySummaryFindFirst,
  mockDailySummaryUpdate,
  mockGetInvoiceStats,
  mockVoidInvoice,
  mockGenerateHtml,
  mockGenerateQR,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockRequireAdminPermission: vi.fn(),
  mockInvoicesFindMany: vi.fn(),
  mockInvoicesCount: vi.fn(),
  mockInvoicesFindFirst: vi.fn(),
  mockInvoiceCdrFindFirst: vi.fn(),
  mockTenantSettingsFindUnique: vi.fn(),
  mockOrdersFindFirst: vi.fn(),
  mockDailySummaryFindMany: vi.fn(),
  mockDailySummaryCount: vi.fn(),
  mockDailySummaryFindFirst: vi.fn(),
  mockDailySummaryUpdate: vi.fn(async () => ({})),
  mockGetInvoiceStats: vi.fn(),
  mockVoidInvoice: vi.fn(),
  mockGenerateHtml: vi.fn(() => '<html>invoice</html>'),
  mockGenerateQR: vi.fn(async () => ({ success: true, data: 'data:image/png;base64,abc' })),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/middleware/admin-permission', () => ({
  requireAdminPermission: mockRequireAdminPermission,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    invoices: { findMany: mockInvoicesFindMany, count: mockInvoicesCount, findFirst: mockInvoicesFindFirst },
    invoice_cdr: { findFirst: mockInvoiceCdrFindFirst },
    tenant_settings: { findUnique: mockTenantSettingsFindUnique },
    orders: { findFirst: mockOrdersFindFirst },
    sunat_daily_summary: {
      findMany: mockDailySummaryFindMany,
      count: mockDailySummaryCount,
      findFirst: mockDailySummaryFindFirst,
      update: mockDailySummaryUpdate,
    },
  },
}));

vi.mock('@/src/core/services/invoice.service', () => ({
  invoiceService: {
    getInvoiceStats: mockGetInvoiceStats,
    voidInvoice: mockVoidInvoice,
  },
}));

vi.mock('@/src/core/integrations/sunat/invoice-pdf', () => ({
  generateInvoicePDFHtml: mockGenerateHtml,
}));

vi.mock('@/src/core/integrations/sunat/receipt-qr', () => ({
  generateSunatReceiptQR: mockGenerateQR,
}));

vi.mock('@/src/core/observability', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { GET as GETList } from '../route';
import { GET as GETStats } from '../stats/route';
import { GET as GETDetail } from '../[invoiceId]/route';
import { POST as POSTVoid } from '../[invoiceId]/void/route';
import { GET as GETPdf } from '../[invoiceId]/pdf/route';
import { GET as GETResumenes, POST as POSTResumenes } from '../resumenes-diarios/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const INVOICE_ID = 'inv00000-0000-0000-0000-000000000001';
const SUMMARY_ID = 'a0000000-0000-0000-0000-000000000001';

const baseInvoice = {
  id: INVOICE_ID,
  tenant_id: TENANT_ID,
  invoice_type: 'BOLETA',
  series: 'B001',
  invoice_number: '00000001',
  customer_doc: '12345678',
  customer_doc_type: 'DNI',
  total_cents: 10000,
  status: 'ISSUED',
  created_at: new Date('2026-03-01'),
  order_id: 'order-1',
  payment_summary: { subtotalCents: 8475, taxCents: 1525 },
  credit_notes: [],
};

const baseCdr = {
  id: 'cdr-1',
  tenant_id: TENANT_ID,
  invoice_id: INVOICE_ID,
  response_code: '0',
  response_message: 'La Boleta número B001-00000001 ha sido aceptada',
  hash: 'abc123hash',
  received_at: new Date('2026-03-01'),
};

const baseSummary = {
  id: SUMMARY_ID,
  tenant_id: TENANT_ID,
  summary_date: new Date('2026-03-01'),
  summary_number: 'RC-20260301-001',
  boletas_count: 5,
  boletas_total: 50000,
  ticket_number: 'TICKET-001',
  sunat_status: 'ACCEPTED',
  last_error: null,
  created_at: new Date('2026-03-01'),
};

function makeRequest(url: string, method = 'GET', body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeContext(invoiceId: string) {
  return { params: Promise.resolve({ invoiceId }) };
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

function mockPermissionOk() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'OWNER', tenantId: TENANT_ID },
  });
}

function mockPermissionFail() {
  mockRequireAdminPermission.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  });
}

// ─── GET /api/admin/facturacion ───────────────────────────────────────────────

describe('GET /api/admin/facturacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockInvoicesFindMany.mockResolvedValue([baseInvoice]);
    mockInvoicesCount.mockResolvedValue(1);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETList(makeRequest('/api/admin/facturacion'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { items, pagination }', async () => {
    const res = await GETList(makeRequest('/api/admin/facturacion'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  it('queries invoices scoped by tenant_id from JWT', async () => {
    await GETList(makeRequest('/api/admin/facturacion'));
    expect(mockInvoicesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });

  it('filters by type when provided', async () => {
    await GETList(makeRequest('/api/admin/facturacion?type=BOLETA'));
    expect(mockInvoicesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ invoice_type: 'BOLETA' }) }),
    );
  });

  it('filters by status when provided', async () => {
    await GETList(makeRequest('/api/admin/facturacion?status=ISSUED'));
    expect(mockInvoicesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'ISSUED' }) }),
    );
  });

  it('returns 500 on DB error', async () => {
    mockInvoicesFindMany.mockRejectedValue(new Error('DB error'));
    const res = await GETList(makeRequest('/api/admin/facturacion'));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/facturacion/stats ─────────────────────────────────────────

describe('GET /api/admin/facturacion/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetInvoiceStats.mockResolvedValue({ success: true, data: { total: 10, issued: 8 } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETStats(makeRequest('/api/admin/facturacion/stats'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with stats data', async () => {
    const res = await GETStats(makeRequest('/api/admin/facturacion/stats'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(10);
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETStats(makeRequest('/api/admin/facturacion/stats'));
    expect(mockGetInvoiceStats).toHaveBeenCalledWith(TENANT_ID, undefined, undefined);
  });

  it('returns 500 on service failure', async () => {
    mockGetInvoiceStats.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GETStats(makeRequest('/api/admin/facturacion/stats'));
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/admin/facturacion/[invoiceId] ───────────────────────────────────

describe('GET /api/admin/facturacion/[invoiceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockInvoicesFindFirst.mockResolvedValue(baseInvoice);
    mockInvoiceCdrFindFirst.mockResolvedValue(baseCdr);
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when invoice not found', async () => {
    mockInvoicesFindFirst.mockResolvedValue(null);
    const res = await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    expect(res.status).toBe(404);
  });

  it('returns 200 with invoice + sunat_status + cdr', async () => {
    const res = await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sunat_status).toBe('ACCEPTED');
    expect(body.cdr).toBeDefined();
    expect(body.cdr.response_code).toBe('0');
  });

  it('returns sunat_status PENDING when no CDR', async () => {
    mockInvoiceCdrFindFirst.mockResolvedValue(null);
    const res = await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    const body = await res.json();
    expect(body.sunat_status).toBe('PENDING');
    expect(body.cdr).toBeNull();
  });

  it('returns sunat_status REJECTED when response_code != 0', async () => {
    mockInvoiceCdrFindFirst.mockResolvedValue({ ...baseCdr, response_code: '2335' });
    const res = await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    const body = await res.json();
    expect(body.sunat_status).toBe('REJECTED');
  });

  it('queries with tenant_id from JWT (not from client)', async () => {
    await GETDetail(makeRequest(`/api/admin/facturacion/${INVOICE_ID}`), makeContext(INVOICE_ID));
    expect(mockInvoicesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});

// ─── POST /api/admin/facturacion/[invoiceId]/void ─────────────────────────────

describe('POST /api/admin/facturacion/[invoiceId]/void', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockVoidInvoice.mockResolvedValue({ success: true, data: { ...baseInvoice, status: 'VOIDED' } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error en datos' }),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error en datos' }),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(200);
  });

  it('passes tenant_id from JWT to service', async () => {
    await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error' }),
      makeContext(INVOICE_ID),
    );
    expect(mockVoidInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID, invoiceId: INVOICE_ID }),
    );
  });

  it('returns 404 when error.code is NOT_FOUND', async () => {
    mockVoidInvoice.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error' }),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when error.code is CONFLICT', async () => {
    mockVoidInvoice.mockResolvedValue({ success: false, error: { code: 'CONFLICT', message: 'Already voided' } });
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error' }),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(409);
  });

  it('returns 403 when error.code is FORBIDDEN', async () => {
    mockVoidInvoice.mockResolvedValue({ success: false, error: { code: 'FORBIDDEN', message: 'Not allowed' } });
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', { reason: 'Error' }),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(403);
  });

  it('returns 400 on missing reason (Zod)', async () => {
    const res = await POSTVoid(
      makeRequest(`/api/admin/facturacion/${INVOICE_ID}/void`, 'POST', {}),
      makeContext(INVOICE_ID),
    );
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/facturacion/[invoiceId]/pdf ───────────────────────────────

describe('GET /api/admin/facturacion/[invoiceId]/pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockInvoicesFindFirst.mockResolvedValue(baseInvoice);
    mockTenantSettingsFindUnique.mockResolvedValue({
      legal_name: 'Pollería Test SAC',
      address_text: 'Jr. Test 123',
      ruc: '20123456789',
      logo_url: null,
    });
    mockInvoiceCdrFindFirst.mockResolvedValue(baseCdr);
    mockOrdersFindFirst.mockResolvedValue({ items: [] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETPdf(makeRequest(`/api/admin/facturacion/${INVOICE_ID}/pdf`), makeContext(INVOICE_ID));
    expect(res.status).toBe(401);
  });

  it('returns 404 when invoice not found', async () => {
    mockInvoicesFindFirst.mockResolvedValue(null);
    const res = await GETPdf(makeRequest(`/api/admin/facturacion/${INVOICE_ID}/pdf`), makeContext(INVOICE_ID));
    expect(res.status).toBe(404);
  });

  it('returns 200 HTML response', async () => {
    const res = await GETPdf(makeRequest(`/api/admin/facturacion/${INVOICE_ID}/pdf`), makeContext(INVOICE_ID));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('queries invoice with tenant_id from JWT', async () => {
    await GETPdf(makeRequest(`/api/admin/facturacion/${INVOICE_ID}/pdf`), makeContext(INVOICE_ID));
    expect(mockInvoicesFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});

// ─── GET /api/admin/facturacion/resumenes-diarios ─────────────────────────────

describe('GET /api/admin/facturacion/resumenes-diarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionOk();
    mockDailySummaryFindMany.mockResolvedValue([baseSummary]);
    mockDailySummaryCount.mockResolvedValue(1);
  });

  it('returns 403 without permission', async () => {
    mockPermissionFail();
    const res = await GETResumenes(makeRequest('/api/admin/facturacion/resumenes-diarios'));
    expect(res.status).toBe(403);
  });

  it('calls requireAdminPermission with manage_fiscal', async () => {
    await GETResumenes(makeRequest('/api/admin/facturacion/resumenes-diarios'));
    expect(mockRequireAdminPermission).toHaveBeenCalledWith(expect.any(Object), 'manage_fiscal');
  });

  it('returns 200 with { items, pagination }', async () => {
    const res = await GETResumenes(makeRequest('/api/admin/facturacion/resumenes-diarios'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.pagination).toBeDefined();
  });

  it('queries scoped by tenant_id from JWT', async () => {
    await GETResumenes(makeRequest('/api/admin/facturacion/resumenes-diarios'));
    expect(mockDailySummaryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});

// ─── POST /api/admin/facturacion/resumenes-diarios ────────────────────────────

describe('POST /api/admin/facturacion/resumenes-diarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissionOk();
    mockDailySummaryFindFirst.mockResolvedValue({ ...baseSummary, sunat_status: 'FAILED' });
  });

  it('returns 403 without permission', async () => {
    mockPermissionFail();
    const res = await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: SUMMARY_ID }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 and schedules resend', async () => {
    const res = await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: SUMMARY_ID }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when summary not found', async () => {
    mockDailySummaryFindFirst.mockResolvedValue(null);
    const res = await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: SUMMARY_ID }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when summary already ACCEPTED', async () => {
    mockDailySummaryFindFirst.mockResolvedValue({ ...baseSummary, sunat_status: 'ACCEPTED' });
    const res = await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: SUMMARY_ID }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid summaryId (Zod)', async () => {
    const res = await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: 'not-a-uuid' }),
    );
    expect(res.status).toBe(400);
  });

  it('queries summary scoped by tenant_id from JWT', async () => {
    await POSTResumenes(
      makeRequest('/api/admin/facturacion/resumenes-diarios', 'POST', { summaryId: SUMMARY_ID }),
    );
    expect(mockDailySummaryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenant_id: TENANT_ID }) }),
    );
  });
});
