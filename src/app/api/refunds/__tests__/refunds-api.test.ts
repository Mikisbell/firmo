/**
 * Refunds API Tests
 *
 * Tests for GET /api/refunds
 * Auth: requireAdminAuth (JWT + ADMIN_ROLES)
 *
 * @module app/api/refunds/__tests__/refunds-api.test
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
    refunds: {
      count: (...args: any[]) => mockCount(...args),
      findMany: (...args: any[]) => mockFindMany(...args),
    },
  },
}));

const mockAdminAuth = vi.fn();
vi.mock('@/src/core/middleware/admin-auth', () => ({
  requireAdminAuth: (...args: any[]) => mockAdminAuth(...args),
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
  const url = new URL('http://localhost/api/refunds');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

function makeRefund(overrides: Record<string, any> = {}) {
  return {
    id: 'ref-1',
    tenant_id: 'tenant-1',
    order_id: 'order-1',
    check_id: 'check-1',
    invoice_id: null,
    type: 'FULL',
    status: 'ISSUED',
    reason_code: 'CUSTOMER_REQUEST',
    reason_detail: 'Cliente cambió de opinión',
    original_amount: 5000,
    refund_amount: 5000,
    refund_method: 'CASH',
    items: null,
    credit_notes: [],
    created_at: new Date('2026-01-15T10:00:00Z'),
    issued_at: new Date('2026-01-15T10:01:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: GET /api/refunds
// ---------------------------------------------------------------------------

describe('GET /api/refunds', () => {
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

  it('debe retornar reembolsos con paginación', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeRefund()]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.refunds).toHaveLength(1);
    expect(data.refunds[0].id).toBe('ref-1');
    expect(data.refunds[0].order_id).toBe('order-1');
    expect(data.refunds[0].refund_amount).toBe(5000);
  });

  it('debe filtrar por order_id', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([makeRefund()]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ order_id: 'order-1' }));

    expect(res.status).toBe(200);
    // Verify the where clause includes order_id filter
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ order_id: 'order-1' }),
      }),
    );
  });

  it('debe filtrar por status', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ status: 'VOIDED' }));

    expect(res.status).toBe(200);
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'VOIDED' }),
      }),
    );
  });

  it('debe retornar lista vacía sin reembolsos', async () => {
    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.refunds).toHaveLength(0);
  });

  it('debe soportar paginación con page y pageSize', async () => {
    mockCount.mockResolvedValue(100);
    mockFindMany.mockResolvedValue([]);

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ page: '3', pageSize: '25' }));

    expect(res.status).toBe(200);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 50,
        take: 25,
      }),
    );
  });

  it('debe retornar 500 en error de base de datos', async () => {
    mockCount.mockRejectedValue(new Error('Connection refused'));

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('Error');
  });
});
