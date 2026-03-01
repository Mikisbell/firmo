/**
 * Orders API Integration Tests
 *
 * Tests GET /api/orders (list orders with pagination, status filter, terminal filter).
 * Validates tenant isolation, filtering, pagination, and error handling.
 *
 * @module app/api/orders/__tests__/orders-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCount = vi.fn();
const mockFindMany = vi.fn();

vi.mock('@/src/core/db/prisma', () => ({
  default: {
    orders: {
      count: (...args: any[]) => mockCount(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: () => 'tenant-ord-001',
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/orders');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

const SAMPLE_ORDERS = [
  {
    id: 'ord-1',
    order_number: 'ORD-001',
    order_status: 'SUBMITTED',
    total_cents: 5000,
    terminal_id: 'term-1',
    created_at: new Date('2026-02-28T10:00:00Z'),
    updated_at: new Date('2026-02-28T10:00:00Z'),
  },
  {
    id: 'ord-2',
    order_number: 'ORD-002',
    order_status: 'PAID',
    total_cents: 12500,
    terminal_id: 'term-2',
    created_at: new Date('2026-02-28T11:00:00Z'),
    updated_at: new Date('2026-02-28T11:00:00Z'),
  },
];

// ---------------------------------------------------------------------------
// Tests: GET /api/orders
// ---------------------------------------------------------------------------

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(SAMPLE_ORDERS);
  });

  it('debe listar ordenes con paginacion', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  it('debe filtrar por tenant_id de config (aislamiento de tenant)', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-ord-001' }),
      }),
    );
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-ord-001' }),
      }),
    );
  });

  it('debe filtrar por orderStatus', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([SAMPLE_ORDERS[0]]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ orderStatus: 'SUBMITTED' }));

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ order_status: 'SUBMITTED' }),
      }),
    );
  });

  it('debe filtrar por terminalId', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([SAMPLE_ORDERS[1]]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ terminalId: 'term-2' }));

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ terminal_id: 'term-2' }),
      }),
    );
  });

  it('debe combinar filtros orderStatus y terminalId', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ orderStatus: 'PAID', terminalId: 'term-1' }));

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: 'tenant-ord-001',
          order_status: 'PAID',
          terminal_id: 'term-1',
        }),
      }),
    );
  });

  it('debe respetar parametros de paginacion custom', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest({ page: '2', pageSize: '50' }));

    // page=2, limit=50 -> skip=50, take=50
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 50,
      }),
    );
  });

  it('debe ordenar por created_at descendente', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { created_at: 'desc' },
      }),
    );
  });

  it('debe retornar items vacios cuando no hay ordenes', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toEqual([]);
    expect(data.pagination.total).toBe(0);
  });

  it('debe retornar 500 ante error de base de datos', async () => {
    mockCount.mockRejectedValue(new Error('Connection timeout'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error al obtener');
  });

  it('debe incluir campos select correctos', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          order_number: true,
          order_status: true,
          total_cents: true,
          terminal_id: true,
          created_at: true,
          updated_at: true,
        },
      }),
    );
  });
});
