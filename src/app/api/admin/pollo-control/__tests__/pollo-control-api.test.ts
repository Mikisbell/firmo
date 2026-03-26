/**
 * Tests for:
 * - GET  /api/admin/pollo-control           (dashboard: equivalents + summary)
 * - POST /api/admin/pollo-control/production
 * - PUT  /api/admin/pollo-control/production/[id]/complete
 * - GET  /api/admin/pollo-control/history
 *
 * Key behavior:
 * - Auth required on all
 * - tenant_id from JWT
 * - Dashboard: requires location_id (uuid) — missing → 400
 * - Production: requires location_id (uuid), raw_units > 0, raw_weight_kg > 0
 * - Complete: NOT_FOUND → 404, ALREADY_COMPLETED → 409
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetRealtimeEquivalents,
  mockGetDailySummary,
  mockLogProduction,
  mockCompleteProduction,
  mockGetProductionHistory,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetRealtimeEquivalents: vi.fn(),
  mockGetDailySummary: vi.fn(),
  mockLogProduction: vi.fn(),
  mockCompleteProduction: vi.fn(),
  mockGetProductionHistory: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/services/pollo-control.service', () => ({
  polloControlService: {
    getRealtimeEquivalents: mockGetRealtimeEquivalents,
    getDailySummary: mockGetDailySummary,
    logProduction: mockLogProduction,
    completeProduction: mockCompleteProduction,
    getProductionHistory: mockGetProductionHistory,
  },
}));

import { GET as GETDashboard } from '../route';
import { POST as POSTProduction } from '../production/route';
import { PUT as PUTComplete } from '../production/[id]/complete/route';
import { GET as GETHistory } from '../history/route';

// ─── Constants ─────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const LOCATION_ID = 'b0000000-0000-0000-0000-000000000001';
const BATCH_ID = 'ba000000-0000-0000-0000-000000000001';

const baseEquivalents = { total_units: 10, crudo: 5, cocinando: 3, cocido: 2, servido: 0 };
const baseSummary = { date: '2026-03-26', total_produced: 15, total_served: 10, waste: 1 };
const baseProduction = { id: BATCH_ID, status: 'CRUDO', raw_units: 20 };
const baseHistory = { items: [baseProduction], total: 1, page: 1, limit: 20 };

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

// ─── GET /api/admin/pollo-control ─────────────────────────────────────────────

describe('GET /api/admin/pollo-control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetRealtimeEquivalents.mockResolvedValue({ success: true, data: baseEquivalents });
    mockGetDailySummary.mockResolvedValue({ success: true, data: baseSummary });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETDashboard(makeRequest(`/api/admin/pollo-control?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(401);
  });

  it('returns 200 with { equivalents, summary }', async () => {
    const res = await GETDashboard(makeRequest(`/api/admin/pollo-control?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.equivalents).toBeDefined();
    expect(body.summary).toBeDefined();
  });

  it('passes tenant_id from JWT to service', async () => {
    await GETDashboard(makeRequest(`/api/admin/pollo-control?location_id=${LOCATION_ID}`));
    expect(mockGetRealtimeEquivalents).toHaveBeenCalledWith(TENANT_ID, LOCATION_ID);
  });

  it('returns 400 when location_id missing', async () => {
    const res = await GETDashboard(makeRequest('/api/admin/pollo-control'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when location_id is not a UUID', async () => {
    const res = await GETDashboard(makeRequest('/api/admin/pollo-control?location_id=not-a-uuid'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service failure', async () => {
    mockGetRealtimeEquivalents.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GETDashboard(makeRequest(`/api/admin/pollo-control?location_id=${LOCATION_ID}`));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/admin/pollo-control/production ─────────────────────────────────

describe('POST /api/admin/pollo-control/production', () => {
  const validBody = { location_id: LOCATION_ID, raw_units: 20, raw_weight_kg: 40 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockLogProduction.mockResolvedValue({ success: true, data: baseProduction });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await POSTProduction(makeRequest('/api/admin/pollo-control/production', 'POST', validBody));
    expect(res.status).toBe(401);
  });

  it('returns 201 on success', async () => {
    const res = await POSTProduction(makeRequest('/api/admin/pollo-control/production', 'POST', validBody));
    expect(res.status).toBe(201);
  });

  it('passes tenant_id + employee_id from JWT to service', async () => {
    await POSTProduction(makeRequest('/api/admin/pollo-control/production', 'POST', validBody));
    expect(mockLogProduction).toHaveBeenCalledWith(TENANT_ID, expect.any(Object), EMPLOYEE_ID);
  });

  it('returns 400 on missing location_id', async () => {
    const res = await POSTProduction(
      makeRequest('/api/admin/pollo-control/production', 'POST', { raw_units: 20, raw_weight_kg: 40 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on raw_units = 0', async () => {
    const res = await POSTProduction(
      makeRequest('/api/admin/pollo-control/production', 'POST', { ...validBody, raw_units: 0 }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on service failure', async () => {
    mockLogProduction.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await POSTProduction(makeRequest('/api/admin/pollo-control/production', 'POST', validBody));
    expect(res.status).toBe(500);
  });
});

// ─── PUT /api/admin/pollo-control/production/[id]/complete ────────────────────

describe('PUT /api/admin/pollo-control/production/[id]/complete', () => {
  const validBody = { cooked_units: 18, cooked_weight_kg: 32 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockCompleteProduction.mockResolvedValue({ success: true, data: { ...baseProduction, status: 'COCIDO' } });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', validBody),
      makeParams(BATCH_ID),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 on success', async () => {
    const res = await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', validBody),
      makeParams(BATCH_ID),
    );
    expect(res.status).toBe(200);
  });

  it('passes tenant_id + batch_id to service', async () => {
    await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', validBody),
      makeParams(BATCH_ID),
    );
    expect(mockCompleteProduction).toHaveBeenCalledWith(TENANT_ID, BATCH_ID, expect.any(Object));
  });

  it('returns 404 when error.code is NOT_FOUND', async () => {
    mockCompleteProduction.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
    const res = await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', validBody),
      makeParams(BATCH_ID),
    );
    expect(res.status).toBe(404);
  });

  it('returns 409 when error.code is ALREADY_COMPLETED', async () => {
    mockCompleteProduction.mockResolvedValue({ success: false, error: { code: 'ALREADY_COMPLETED', message: 'Already done' } });
    const res = await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', validBody),
      makeParams(BATCH_ID),
    );
    expect(res.status).toBe(409);
  });

  it('returns 400 on invalid body', async () => {
    const res = await PUTComplete(
      makeRequest(`/api/admin/pollo-control/production/${BATCH_ID}/complete`, 'PUT', {}),
      makeParams(BATCH_ID),
    );
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/pollo-control/history ─────────────────────────────────────

describe('GET /api/admin/pollo-control/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetProductionHistory.mockResolvedValue({ success: true, data: baseHistory });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GETHistory(makeRequest('/api/admin/pollo-control/history'));
    expect(res.status).toBe(401);
  });

  it('returns 200 with production history', async () => {
    const res = await GETHistory(makeRequest('/api/admin/pollo-control/history'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toBeDefined();
    expect(body.total).toBe(1);
  });

  it('passes tenant_id from JWT to service with default pagination', async () => {
    await GETHistory(makeRequest('/api/admin/pollo-control/history'));
    expect(mockGetProductionHistory).toHaveBeenCalledWith(TENANT_ID, undefined, 1, 20);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GETHistory(makeRequest('/api/admin/pollo-control/history?date=26-03-2026'));
    expect(res.status).toBe(400);
  });

  it('returns 500 on service failure', async () => {
    mockGetProductionHistory.mockResolvedValue({ success: false, error: { message: 'DB error' } });
    const res = await GETHistory(makeRequest('/api/admin/pollo-control/history'));
    expect(res.status).toBe(500);
  });
});
