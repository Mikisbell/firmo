/**
 * Inventory Route Integration Tests
 *
 * Tests GET /api/inventory (list inventory stock with pagination, search, low-stock filter).
 * Validates tenant isolation, search filtering, pagination, and error handling.
 *
 * @module app/api/inventory/__tests__/inventory-route.test
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
    inventory: {
      count: (...args: any[]) => mockCount(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
      fields: { min_stock: 'min_stock' },
    },
  },
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: () => 'tenant-inv-001',
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/inventory');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

const SAMPLE_ITEMS = [
  {
    id: 'inv-1',
    code: 'POLLO-001',
    name: 'Pollo Entero',
    stock: 50,
    min_stock: 10,
    unit: 'KG',
    location_id: null,
    last_count_at: null,
    updated_at: new Date('2026-01-15'),
  },
  {
    id: 'inv-2',
    code: 'ARROZ-001',
    name: 'Arroz Graneado',
    stock: 5,
    min_stock: 20,
    unit: 'KG',
    location_id: null,
    last_count_at: null,
    updated_at: new Date('2026-01-10'),
  },
];

// ---------------------------------------------------------------------------
// Tests: GET /api/inventory
// ---------------------------------------------------------------------------

describe('GET /api/inventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(SAMPLE_ITEMS);
  });

  it('debe listar inventario con paginacion', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ page: '1', pageSize: '10' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toHaveLength(2);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.total).toBe(2);
  });

  it('debe filtrar por tenant_id de config', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-inv-001' }),
      }),
    );
  });

  it('debe aplicar filtro de busqueda por codigo o nombre', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest({ search: 'pollo' }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_id: 'tenant-inv-001',
          OR: [
            { code: { contains: 'pollo', mode: 'insensitive' } },
            { name: { contains: 'pollo', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('debe convertir Decimal stock a number en respuesta', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([
      {
        id: 'inv-3',
        code: 'SAL-001',
        name: 'Sal',
        stock: 25.5,
        min_stock: 10,
        unit: 'KG',
        location_id: null,
        last_count_at: null,
        updated_at: new Date(),
      },
    ]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.items[0].stock).toBe('number');
    expect(data.items[0].stock).toBe(25.5);
  });

  it('debe manejar min_stock null correctamente', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([
      {
        id: 'inv-4',
        code: 'OTR-001',
        name: 'Otro Item',
        stock: 10,
        min_stock: null,
        unit: 'UND',
        location_id: null,
        last_count_at: null,
        updated_at: new Date(),
      },
    ]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items[0].min_stock).toBeNull();
  });

  it('debe usar paginacion por defecto sin parametros', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest());

    // Default: page=1, limit=10 -> skip=0, take=10
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
  });

  it('debe respetar parametros de paginacion custom', async () => {
    const { GET } = await import('../route');
    await GET(makeGetRequest({ page: '3', pageSize: '25' }));

    // page=3, limit=25 -> skip=50, take=25
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 25,
      }),
    );
  });

  it('debe retornar 500 ante error de base de datos', async () => {
    mockCount.mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error al obtener inventario');
  });
});
