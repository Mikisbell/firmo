/**
 * HR Reports API Unit Tests
 *
 * Tests GET /api/hr/reports — stub endpoint returning report structure.
 * Query params: type (attendance|hours|payroll|vacation|performance|turnover|labor-cost)
 *               period (YYYY-MM)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── vi.hoisted() ensures these exist BEFORE vi.mock factory runs ───
const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ─── NOW import route handler (after all mocks) ───
import { GET } from '../route';

// ─── Helpers ───

const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function authorizedUser() {
  mockAuth.mockResolvedValue({
    authorized: true,
    user: {
      id: 'admin-1',
      role: 'ADMIN',
      name: 'Test Admin',
      tenantId: TENANT_ID,
      sessionId: 'sess-1',
    },
  });
}

function unauthorizedUser() {
  const { NextResponse } = require('next/server');
  mockAuth.mockResolvedValue({
    authorized: false,
    response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }),
  });
}

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

const REPORT_TYPES = [
  { type: 'attendance', title: 'Reporte de Asistencia' },
  { type: 'hours', title: 'Reporte de Horas Trabajadas' },
  { type: 'payroll', title: 'Reporte de Planilla' },
  { type: 'vacation', title: 'Reporte de Vacaciones' },
  { type: 'performance', title: 'Reporte de Desempeño' },
  { type: 'turnover', title: 'Reporte de Rotación' },
  { type: 'labor-cost', title: 'Reporte de Costos Laborales' },
] as const;

// ─── Tests ───

describe('HR Reports API — GET /api/hr/reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedUser();
  });

  // ── Success per report type ──
  it.each(REPORT_TYPES)(
    'should return stub report for type=$type',
    async ({ type, title }) => {
      const req = makeRequest(`http://localhost:3000/api/hr/reports?type=${type}&period=2026-03`);
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.type).toBe(type);
      expect(data.title).toBe(title);
      expect(data.period).toBe('2026-03');
      expect(data.tenantId).toBe(TENANT_ID);
      expect(data.rows).toEqual([]);
      expect(data.totals).toEqual({});
      expect(data.generatedAt).toBeDefined();
    },
  );

  // ── Default type when missing ──
  it('should default to attendance when type param is missing', async () => {
    const req = makeRequest('http://localhost:3000/api/hr/reports?period=2026-02');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.type).toBe('attendance');
    expect(data.title).toBe('Reporte de Asistencia');
    expect(data.period).toBe('2026-02');
  });

  // ── Default period when missing ──
  it('should default to current month when period param is missing', async () => {
    const req = makeRequest('http://localhost:3000/api/hr/reports?type=payroll');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.type).toBe('payroll');
    // Period should be current YYYY-MM
    expect(data.period).toMatch(/^\d{4}-\d{2}$/);
  });

  // ── Unknown type returns generic title ──
  it('should return generic title for unknown report type', async () => {
    const req = makeRequest('http://localhost:3000/api/hr/reports?type=unknown-type');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.type).toBe('unknown-type');
    expect(data.title).toBe('Reporte');
  });

  // ── Unauthorized ──
  it('should return 401 when not authorized', async () => {
    unauthorizedUser();

    const req = makeRequest('http://localhost:3000/api/hr/reports?type=attendance');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  // ── Auth is called ──
  it('should call requireAdminAuth with the request', async () => {
    const req = makeRequest('http://localhost:3000/api/hr/reports');
    await GET(req);

    expect(mockAuth).toHaveBeenCalledWith(req);
  });
});
