/**
 * Tests for /api/admin/reservations (GET)
 * and /api/admin/reservations/[id] (GET + PATCH)
 *
 * Key behavior under test:
 * - Auth required on all endpoints
 * - tenant_id always from JWT (never from client)
 * - GET returns { success, data: { reservations, summary } }
 * - GET [id] returns { success, data: reservation }
 * - PATCH validates action enum (confirm|reject|arrive|seat|no_show|cancel)
 * - PATCH returns 404 on NotFoundError, 409 on ConflictError, 400 on invalid action
 * - Invalid UUID format returns 404 (not 500)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const {
  mockRequireAdminAuth,
  mockGetReservationsByDate,
  mockPerformAction,
  mockGetReservationById,
} = vi.hoisted(() => ({
  mockRequireAdminAuth: vi.fn(),
  mockGetReservationsByDate: vi.fn(),
  mockPerformAction: vi.fn(),
  mockGetReservationById: vi.fn(),
}));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: mockRequireAdminAuth,
}));

vi.mock('@/src/core/reservations/reservation.service', () => ({
  getReservationsByDate: mockGetReservationsByDate,
  performAction: mockPerformAction,
  getReservationById: mockGetReservationById,
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
}));

import { GET } from '../route';
import { GET as GETById, PATCH } from '../[id]/route';
import { NotFoundError, ConflictError } from '@/src/core/result';

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EMPLOYEE_ID = 'emp00000-0000-0000-0000-000000000001';
const RESERVATION_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const baseReservation = {
  id: RESERVATION_ID,
  customer_name: 'Juan Pérez',
  customer_phone: '987654321',
  customer_email: null,
  date: '2026-03-26',
  time: '12:30',
  duration_minutes: 90,
  party_size: 4,
  status: 'PENDING',
  confirmation_code: 'ABC123',
  table_id: null,
  table_number: null,
  zone_preference: null,
  special_requests: null,
  internal_notes: null,
  arrived_at: null,
  seated_at: null,
  no_show_at: null,
  cancelled_at: null,
  cancelled_reason: null,
  created_at: new Date().toISOString(),
};

const baseSummary = {
  total: 5,
  confirmed: 2,
  pending: 2,
  cancelled: 0,
  no_show: 0,
  arrived: 1,
  seated: 0,
  rejected: 0,
  completed: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDetailRequest(id: string, body?: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/admin/reservations/${id}`, {
    method: 'PATCH',
    headers: { cookie: 'auth_token=test-token', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

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

// ─── GET /api/admin/reservations ──────────────────────────────────────────────

describe('GET /api/admin/reservations', () => {
  const listUrl = `http://localhost:3000/api/admin/reservations?date=2026-03-26`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetReservationsByDate.mockResolvedValue({
      success: true,
      data: { reservations: [baseReservation], summary: baseSummary },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(401);
  });

  it('returns 200 with reservations and summary', async () => {
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservations).toHaveLength(1);
    expect(body.data.summary).toBeDefined();
    expect(body.data.summary.total).toBe(5);
  });

  it('queries with tenant_id from JWT', async () => {
    await GET(makeRequest('GET', listUrl));
    expect(mockGetReservationsByDate).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ date: '2026-03-26' }),
    );
  });

  it('returns 200 with empty list when no reservations', async () => {
    mockGetReservationsByDate.mockResolvedValue({
      success: true,
      data: { reservations: [], summary: { ...baseSummary, total: 0, pending: 0, arrived: 0, confirmed: 0 } },
    });
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reservations).toHaveLength(0);
  });

  it('returns 400 on invalid date format', async () => {
    const res = await GET(makeRequest('GET', 'http://localhost:3000/api/admin/reservations?date=26-03-2026'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid status', async () => {
    const res = await GET(makeRequest('GET', 'http://localhost:3000/api/admin/reservations?status=INVALID'));
    expect(res.status).toBe(400);
  });

  it('passes filters (status, zone_id) to service', async () => {
    const zoneId = 'bbbbbbbb-0000-0000-0000-000000000001';
    await GET(makeRequest('GET', `http://localhost:3000/api/admin/reservations?date=2026-03-26&status=PENDING&zone_id=${zoneId}`));
    expect(mockGetReservationsByDate).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ date: '2026-03-26', status: 'PENDING', zoneId: zoneId }),
    );
  });

  it('returns 400 when service fails', async () => {
    mockGetReservationsByDate.mockResolvedValue({
      success: false,
      error: { message: 'Error al obtener reservas' },
    });
    const res = await GET(makeRequest('GET', listUrl));
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/admin/reservations/[id] ─────────────────────────────────────────

describe('GET /api/admin/reservations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockGetReservationById.mockResolvedValue({
      success: true,
      data: baseReservation,
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const req = new NextRequest(`http://localhost:3000/api/admin/reservations/${RESERVATION_ID}`, {
      method: 'GET',
      headers: { cookie: 'auth_token=test-token' },
    });
    const res = await GETById(req, routeParams(RESERVATION_ID));
    expect(res.status).toBe(401);
  });

  it('returns 200 with reservation data', async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/reservations/${RESERVATION_ID}`, {
      method: 'GET',
      headers: { cookie: 'auth_token=test-token' },
    });
    const res = await GETById(req, routeParams(RESERVATION_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(RESERVATION_ID);
    expect(body.data.customer_name).toBe('Juan Pérez');
  });

  it('returns 404 on invalid UUID format', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/reservations/not-a-uuid', {
      method: 'GET',
      headers: { cookie: 'auth_token=test-token' },
    });
    const res = await GETById(req, routeParams('not-a-uuid'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when reservation not found', async () => {
    mockGetReservationById.mockResolvedValue({
      success: false,
      error: new NotFoundError('Reserva', RESERVATION_ID),
    });
    const req = new NextRequest(`http://localhost:3000/api/admin/reservations/${RESERVATION_ID}`, {
      method: 'GET',
      headers: { cookie: 'auth_token=test-token' },
    });
    const res = await GETById(req, routeParams(RESERVATION_ID));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('queries with tenant_id from JWT', async () => {
    const req = new NextRequest(`http://localhost:3000/api/admin/reservations/${RESERVATION_ID}`, {
      method: 'GET',
      headers: { cookie: 'auth_token=test-token' },
    });
    await GETById(req, routeParams(RESERVATION_ID));
    expect(mockGetReservationById).toHaveBeenCalledWith(TENANT_ID, RESERVATION_ID);
  });
});

// ─── PATCH /api/admin/reservations/[id] ───────────────────────────────────────

describe('PATCH /api/admin/reservations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
    mockPerformAction.mockResolvedValue({
      success: true,
      data: { ...baseReservation, status: 'CONFIRMED' },
    });
  });

  it('returns 401 without auth', async () => {
    mockAuthFail();
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'confirm' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(401);
  });

  it('confirms reservation and returns 200', async () => {
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'confirm' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('CONFIRMED');
  });

  it('rejects reservation and returns 200', async () => {
    mockPerformAction.mockResolvedValue({
      success: true,
      data: { ...baseReservation, status: 'REJECTED' },
    });
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'reject', reason: 'Sin disponibilidad' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(200);
  });

  it('marks as no_show and returns 200', async () => {
    mockPerformAction.mockResolvedValue({
      success: true,
      data: { ...baseReservation, status: 'NO_SHOW' },
    });
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'no_show' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(200);
  });

  it('seats reservation with table_id and returns 200', async () => {
    const tableId = 'cccccccc-0000-0000-0000-000000000001';
    mockPerformAction.mockResolvedValue({
      success: true,
      data: { ...baseReservation, status: 'SEATED', table_id: tableId },
    });
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'seat', table_id: tableId }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(200);
  });

  it('calls performAction with tenant_id from JWT', async () => {
    await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'confirm' }), routeParams(RESERVATION_ID));
    expect(mockPerformAction).toHaveBeenCalledWith(
      TENANT_ID,
      RESERVATION_ID,
      'confirm',
      EMPLOYEE_ID,
      expect.any(Object),
    );
  });

  it('returns 404 on invalid UUID format', async () => {
    const res = await PATCH(makeDetailRequest('not-a-uuid', { action: 'confirm' }), routeParams('not-a-uuid'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when reservation not found', async () => {
    mockPerformAction.mockResolvedValue({
      success: false,
      error: new NotFoundError('Reserva', RESERVATION_ID),
    });
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'confirm' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 409 on invalid state transition (ConflictError)', async () => {
    mockPerformAction.mockResolvedValue({
      success: false,
      error: new ConflictError('No se puede cambiar de REJECTED a CONFIRMED', 'status'),
    });
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'confirm' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 400 on invalid action', async () => {
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, { action: 'INVALID' }), routeParams(RESERVATION_ID));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.details).toBeDefined();
  });

  it('returns 400 on missing action', async () => {
    const res = await PATCH(makeDetailRequest(RESERVATION_ID, {}), routeParams(RESERVATION_ID));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid table_id UUID', async () => {
    const res = await PATCH(
      makeDetailRequest(RESERVATION_ID, { action: 'confirm', table_id: 'not-a-uuid' }),
      routeParams(RESERVATION_ID),
    );
    expect(res.status).toBe(400);
  });
});
