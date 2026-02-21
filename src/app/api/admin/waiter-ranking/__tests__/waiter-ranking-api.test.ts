/**
 * Waiter Ranking API Tests
 *
 * Tests for ranking and export endpoints.
 *
 * @module app/api/admin/waiter-ranking/__tests__/waiter-ranking-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: vi.fn(),
}));

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

const mockGetRankings = vi.fn();

vi.mock('@/src/core/services/waiter-ranking.service', () => ({
  WaiterRankingService: class {
    getRankings = mockGetRankings;
  },
}));

vi.mock('@/src/core/services/export.service', () => ({
  exportService: {
    generateExcel: vi.fn().mockResolvedValue(Buffer.from('xlsx-data')),
    generateCSV: vi.fn().mockReturnValue('header\ndata'),
    generatePDFHtml: vi.fn().mockReturnValue('<html>pdf</html>'),
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { GET } from '../route';
import { GET as GET_EXPORT } from '../export/route';

const mockAuth = requireAdminAuth as ReturnType<typeof vi.fn>;

function makeRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

const mockRankingResult = {
  success: true,
  data: {
    rankings: [
      {
        employeeId: 'w-1',
        employeeName: 'Juan',
        role: 'mesero',
        totalOrders: 10,
        totalSalesCents: 50000,
        averageTicketCents: 5000,
        averageServiceMinutes: 25,
        totalTipsCents: 2000,
        ordersByType: { DINE_IN: 7, TAKEOUT: 2, DELIVERY: 1 },
        periodStart: '2026-02-01',
        periodEnd: '2026-02-28',
      },
    ],
    summary: {
      totalWaiters: 1,
      totalOrdersAll: 10,
      totalSalesAllCents: 50000,
      averageTicketAllCents: 5000,
      bestPerformerId: 'w-1',
      bestPerformerName: 'Juan',
    },
    period: { start: '2026-02-01', end: '2026-02-28' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-1', tenantId: 'tenant-1' },
  });
});

// ============================================================================
// GET /api/admin/waiter-ranking
// ============================================================================

describe('GET /api/admin/waiter-ranking', () => {
  it('debe retornar ranking con parámetros válidos', async () => {
    mockGetRankings.mockResolvedValue(mockRankingResult);

    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.rankings).toHaveLength(1);
    expect(data.rankings[0].employeeName).toBe('Juan');
    expect(data.summary.totalWaiters).toBe(1);
  });

  it('debe pasar sort parameter al servicio', async () => {
    mockGetRankings.mockResolvedValue(mockRankingResult);

    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
      sort: 'tips',
    });

    await GET(req);
    expect(mockGetRankings).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({}),
      'tips',
    );
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('debe rechazar fecha con formato inválido', async () => {
    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026/02/01',
      end: '2026-02-28',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin parámetro start', async () => {
    const req = makeRequest('/api/admin/waiter-ranking', {
      end: '2026-02-28',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar sort inválido', async () => {
    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
      sort: 'invalid',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('debe manejar error del servicio', async () => {
    mockGetRankings.mockResolvedValue({
      success: false,
      error: { message: 'Error de prueba' },
    });

    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Error de prueba');
  });

  it('debe usar sort por defecto "sales" cuando no se especifica', async () => {
    mockGetRankings.mockResolvedValue(mockRankingResult);

    const req = makeRequest('/api/admin/waiter-ranking', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    await GET(req);
    expect(mockGetRankings).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({}),
      'sales',
    );
  });
});

// ============================================================================
// GET /api/admin/waiter-ranking/export
// ============================================================================

describe('GET /api/admin/waiter-ranking/export', () => {
  beforeEach(() => {
    mockGetRankings.mockResolvedValue(mockRankingResult);
  });

  it('debe exportar como XLSX por defecto', async () => {
    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    const res = await GET_EXPORT(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toContain('.xlsx');
  });

  it('debe exportar como CSV', async () => {
    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
      format: 'csv',
    });

    const res = await GET_EXPORT(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('debe exportar como PDF (HTML)', async () => {
    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
      format: 'pdf',
    });

    const res = await GET_EXPORT(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('debe rechazar formato inválido', async () => {
    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
      format: 'docx',
    });

    const res = await GET_EXPORT(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
    });

    const res = await GET_EXPORT(req);
    expect(res.status).toBe(401);
  });

  it('debe incluir filename con fechas en Content-Disposition', async () => {
    const req = makeRequest('/api/admin/waiter-ranking/export', {
      start: '2026-02-01',
      end: '2026-02-28',
      format: 'xlsx',
    });

    const res = await GET_EXPORT(req);
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toContain('ranking-meseros-2026-02-01-2026-02-28');
  });
});
