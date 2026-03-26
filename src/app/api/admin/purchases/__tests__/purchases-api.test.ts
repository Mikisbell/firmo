/**
 * Tests for /api/admin/purchases (GET + POST)
 * and /api/admin/purchases/[id] (PATCH)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT
 * - GET requires locationId query param
 * - POST validates payload (items, supplierId, locationId)
 * - PATCH validates status enum (CONFIRMED | RECEIVED | CANCELLED)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetPurchaseOrders,
  mockCreatePurchaseOrder,
  mockUpdatePOStatus,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetPurchaseOrders: vi.fn(),
  mockCreatePurchaseOrder: vi.fn(),
  mockUpdatePOStatus: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

vi.mock('@/src/core/services/purchases.service', () => ({
  PurchasesService: vi.fn().mockImplementation(function (this: any) {
    this.getPurchaseOrders = mockGetPurchaseOrders;
    this.createPurchaseOrder = mockCreatePurchaseOrder;
    this.updatePOStatus = mockUpdatePOStatus;
  }),
}));

import { GET, POST } from '../route';
import { PATCH } from '../[id]/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp-00000000-0000-0000-0000-000000000001';
const LOCATION_ID = 'eeeeeeee-0000-0000-0000-000000000001';
const SUPPLIER_ID = 'ffffffff-0000-0000-0000-000000000001';
const PO_ID = 'cccccccc-0000-0000-0000-000000000001';

const basePO = {
  id: PO_ID,
  tenant_id: TENANT_ID,
  orderNumber: 'PO-2026-001',
  status: 'DRAFT',
  supplierName: 'Proveedor Test',
  subtotalCents: 10000,
  taxCents: 1800,
  totalCents: 11800,
  createdAt: new Date().toISOString(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'GET' | 'POST', url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDetailRequest(body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/purchases/${PO_ID}`, {
    method: 'PATCH',
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeParams = { params: Promise.resolve({ id: PO_ID }) };

function mockAuthOk() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: EMPLOYEE_ID, role: 'ADMIN', name: 'Test Admin', tenantId: TENANT_ID, sessionId: 'sess-1' },
  });
}

function mockAuthFail() {
  mockRequireAdminAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  });
}

// ─── GET /api/admin/purchases ─────────────────────────────────────────────────

describe('GET /api/admin/purchases', () => {
  const listUrl = `http://localhost:3000/api/admin/purchases?locationId=${LOCATION_ID}`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetPurchaseOrders.mockResolvedValue({ success: true, data: [] });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(401);
  });

  it('returns 400 when locationId is missing', async () => {
    const res = await GET(makeRequest('GET', 'http://localhost:3000/api/admin/purchases'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('locationId requerido');
  });

  it('returns 200 with orders list', async () => {
    mockGetPurchaseOrders.mockResolvedValue({ success: true, data: [basePO] });
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
  });

  it('queries with tenant_id from JWT', async () => {
    await GET(makeRequest('GET', listUrl));
    expect(mockGetPurchaseOrders).toHaveBeenCalledWith(
      TENANT_ID,
      LOCATION_ID,
      expect.any(Object),
    );
  });
});

// ─── POST /api/admin/purchases ────────────────────────────────────────────────

describe('POST /api/admin/purchases', () => {
  const postUrl = 'http://localhost:3000/api/admin/purchases';
  const validPayload = {
    locationId: LOCATION_ID,
    supplierId: SUPPLIER_ID,
    items: [{ inventoryCode: 'POLLO-001', quantityOrdered: 10, unit: 'KG', unitCostCents: 1500 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCreatePurchaseOrder.mockResolvedValue({ success: true, data: basePO });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POST(makeRequest('POST', postUrl, validPayload));
    expect(res.status).toBe(401);
  });

  it('creates purchase order with tenant_id from JWT', async () => {
    const res = await POST(makeRequest('POST', postUrl, validPayload));
    expect(res.status).toBe(201);
    expect(mockCreatePurchaseOrder).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
    );
  });

  it('returns 400 on invalid payload (missing items)', async () => {
    const res = await POST(makeRequest('POST', postUrl, { locationId: LOCATION_ID, supplierId: SUPPLIER_ID }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on empty items array', async () => {
    const res = await POST(makeRequest('POST', postUrl, { ...validPayload, items: [] }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when service fails', async () => {
    mockCreatePurchaseOrder.mockResolvedValue({
      success: false,
      error: { message: 'Proveedor no encontrado' },
    });
    const res = await POST(makeRequest('POST', postUrl, validPayload));
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/admin/purchases/[id] ─────────────────────────────────────────

describe('PATCH /api/admin/purchases/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockUpdatePOStatus.mockResolvedValue({ success: true, data: { ...basePO, status: 'CONFIRMED' } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(makeDetailRequest({ status: 'CONFIRMED' }), routeParams);
    expect(res.status).toBe(401);
  });

  it('updates to CONFIRMED and returns 200', async () => {
    const res = await PATCH(makeDetailRequest({ status: 'CONFIRMED' }), routeParams);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('updates to RECEIVED and returns 200', async () => {
    const res = await PATCH(makeDetailRequest({ status: 'RECEIVED' }), routeParams);
    expect(res.status).toBe(200);
  });

  it('updates to CANCELLED and returns 200', async () => {
    const res = await PATCH(makeDetailRequest({ status: 'CANCELLED' }), routeParams);
    expect(res.status).toBe(200);
  });

  it('calls updatePOStatus with tenant_id from JWT', async () => {
    await PATCH(makeDetailRequest({ status: 'CONFIRMED' }), routeParams);
    expect(mockUpdatePOStatus).toHaveBeenCalledWith(TENANT_ID, PO_ID, 'CONFIRMED');
  });

  it('returns 400 on invalid status', async () => {
    const res = await PATCH(makeDetailRequest({ status: 'DRAFT' }), routeParams);
    expect(res.status).toBe(400);
  });

  it('returns 400 when service fails (e.g., invalid transition)', async () => {
    mockUpdatePOStatus.mockResolvedValue({
      success: false,
      error: { message: 'Transición de estado inválida' },
    });
    const res = await PATCH(makeDetailRequest({ status: 'RECEIVED' }), routeParams);
    expect(res.status).toBe(400);
  });
});
