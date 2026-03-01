/**
 * Promotions API Tests
 *
 * Tests for GET /api/promotions
 * Auth: requireAdminAuth (JWT + ADMIN_ROLES)
 *
 * @module app/api/promotions/__tests__/promotions-api.test
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
    promotions: {
      count: (...args: any[]) => mockCount(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

const mockAdminAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAdminAuth(...args),
}));

vi.mock('@/src/core/config/tenant', () => ({
  getTenantId: () => 'tenant-1',
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authed() {
  mockAdminAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-1', role: 'ADMIN', name: 'Admin', sessionId: 'sess-1' },
  });
}

function unauthorized() {
  mockAdminAuth.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'No autenticado. Por favor inicie sesión.' }), { status: 401 }),
  });
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/promotions');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests: GET /api/promotions
// ---------------------------------------------------------------------------

describe('GET /api/promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe rechazar sin auth (401)', async () => {
    unauthorized();

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
  });

  it('debe retornar promociones activas con paginación', async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([
      {
        id: 'promo-1',
        code: 'PROMO10',
        name: '10% Descuento',
        type: 'PERCENTAGE',
        value: 10,
        rules: {},
        starts_at: null,
        ends_at: null,
        is_active: true,
        stackable: false,
        priority: 1,
      },
      {
        id: 'promo-2',
        code: 'PROMO20',
        name: '20% Descuento',
        type: 'PERCENTAGE',
        value: 20,
        rules: { min_order: 5000 },
        starts_at: new Date('2025-01-01'),
        ends_at: new Date('2027-12-31'),
        is_active: true,
        stackable: true,
        priority: 2,
      },
    ]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.promotions).toHaveLength(2);
    expect(data.promotions[0].code).toBe('PROMO10');
    expect(data.count).toBe(2);
  });

  it('debe retornar lista vacía cuando no hay promociones', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.promotions).toHaveLength(0);
    expect(data.count).toBe(0);
  });

  it('debe soportar parámetros de paginación', async () => {
    mockCount.mockResolvedValue(50);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ page: '2', pageSize: '10' }));

    expect(res.status).toBe(200);
    // Verify findMany was called with correct skip/take
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it('debe retornar 500 en error de base de datos', async () => {
    mockCount.mockRejectedValue(new Error('DB connection lost'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error');
  });
});
