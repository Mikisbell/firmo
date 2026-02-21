/**
 * Universal Export API Tests
 *
 * @module app/api/admin/export/__tests__/export-api.test
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

const mockExportEntity = vi.fn();

vi.mock('@/src/core/services/universal-export.service', () => ({
  UniversalExportService: class {
    exportEntity = mockExportEntity;
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
const mockAuth = requireAdminAuth as ReturnType<typeof vi.fn>;

function makeRequest(path: string, params: Record<string, string> = {}) {
  const url = new URL(`http://localhost:3000${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-1', tenantId: 'tenant-1' },
  });
});

// ============================================================================
// Tests
// ============================================================================

describe('GET /api/admin/export', () => {
  let GET: any;

  beforeEach(async () => {
    const mod = await import('../route');
    GET = mod.GET;
  });

  it('debe exportar entidad en xlsx', async () => {
    mockExportEntity.mockResolvedValue({
      success: true,
      data: {
        buffer: Buffer.from('xlsx-data'),
        filename: 'ventas_2025-12-15.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    const req = makeRequest('/api/admin/export', { entity: 'ventas', format: 'xlsx' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('ventas_2025-12-15.xlsx');
    expect(res.headers.get('Content-Type')).toContain('spreadsheetml');
  });

  it('debe exportar entidad en csv', async () => {
    mockExportEntity.mockResolvedValue({
      success: true,
      data: {
        buffer: Buffer.from('col1,col2\nval1,val2'),
        filename: 'ventas_2025-12-15.csv',
        contentType: 'text/csv; charset=utf-8',
      },
    });

    const req = makeRequest('/api/admin/export', { entity: 'ventas', format: 'csv' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
  });

  it('debe pasar filtros start/end', async () => {
    mockExportEntity.mockResolvedValue({
      success: true,
      data: {
        buffer: Buffer.from('data'),
        filename: 'ventas.xlsx',
        contentType: 'application/octet-stream',
      },
    });

    const req = makeRequest('/api/admin/export', {
      entity: 'ventas',
      format: 'xlsx',
      start: '2025-12-01',
      end: '2025-12-31',
    });
    await GET(req);

    expect(mockExportEntity).toHaveBeenCalledWith(
      'tenant-1',
      'ventas',
      'xlsx',
      expect.objectContaining({
        start: '2025-12-01',
        end: '2025-12-31',
      }),
    );
  });

  it('debe requerir entity', async () => {
    const req = makeRequest('/api/admin/export', { format: 'xlsx' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('requerido');
  });

  it('debe rechazar formato inválido', async () => {
    const req = makeRequest('/api/admin/export', { entity: 'ventas', format: 'xml' });
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('debe retornar error del servicio', async () => {
    mockExportEntity.mockResolvedValue({
      success: false,
      error: { message: 'Entidad no soportada: xyz' },
    });

    const req = makeRequest('/api/admin/export', { entity: 'xyz', format: 'xlsx' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('no soportada');
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/export', { entity: 'ventas' });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('debe usar xlsx como formato por defecto', async () => {
    mockExportEntity.mockResolvedValue({
      success: true,
      data: {
        buffer: Buffer.from('data'),
        filename: 'ventas.xlsx',
        contentType: 'application/octet-stream',
      },
    });

    const req = makeRequest('/api/admin/export', { entity: 'ventas' });
    await GET(req);

    expect(mockExportEntity).toHaveBeenCalledWith(
      'tenant-1',
      'ventas',
      'xlsx',
      expect.any(Object),
    );
  });
});
