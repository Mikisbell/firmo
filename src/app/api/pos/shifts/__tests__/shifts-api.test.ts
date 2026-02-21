/**
 * POS Shifts API Tests
 *
 * @module app/api/pos/shifts/__tests__/shifts-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetActiveShift = vi.fn();
const mockGetShiftSummary = vi.fn();
const mockGetShiftHistory = vi.fn();

vi.mock('@/src/core/services/shift.service', () => ({
  ShiftService: class {
    getActiveShift = mockGetActiveShift;
    getShiftSummary = mockGetShiftSummary;
    getShiftHistory = mockGetShiftHistory;
  },
}));

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

const mockAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAuth(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authed() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-1', role: 'CASHIER', terminalId: 'term-1' },
  });
}

function unauthorized() {
  mockAuth.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
  });
}

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/pos/shifts');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/pos/shifts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe retornar turno activo por default', async () => {
    mockGetActiveShift.mockResolvedValue({
      success: true,
      data: { id: 'shift-1', status: 'OPEN', terminal_id: 'term-1' },
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ terminalId: 'term-1' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shift.id).toBe('shift-1');
  });

  it('debe retornar resumen de turno', async () => {
    mockGetShiftSummary.mockResolvedValue({
      success: true,
      data: {
        shiftId: 'shift-1',
        ordersCount: 15,
        totalSalesCents: 125000,
        paymentBreakdown: { CASH: { count: 10, totalCents: 80000 } },
      },
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ action: 'summary', shiftId: 'shift-1' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ordersCount).toBe(15);
    expect(data.totalSalesCents).toBe(125000);
  });

  it('debe retornar historial de turnos', async () => {
    mockGetShiftHistory.mockResolvedValue({
      success: true,
      data: [
        { id: 'shift-3', status: 'CLOSED' },
        { id: 'shift-2', status: 'CLOSED' },
      ],
    });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ action: 'history', terminalId: 'term-1' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shifts).toHaveLength(2);
  });

  it('debe rechazar summary sin shiftId', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest({ action: 'summary' }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('shiftId');
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ terminalId: 'term-1' }));

    expect(res.status).toBe(401);
  });

  it('debe rechazar action inválido', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeRequest({ action: 'invalid' }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('action');
  });
});
