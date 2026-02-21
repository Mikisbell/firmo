/**
 * Platform Orders Admin API Tests
 *
 * @module app/api/admin/platform-orders/__tests__/platform-orders-api.test
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

const mockGetOrders = vi.fn();
const mockAcceptOrder = vi.fn();
const mockRejectOrder = vi.fn();
const mockGetConfig = vi.fn();
const mockUpdateConfig = vi.fn();

vi.mock('@/src/core/services/platform-order.service', () => ({
  PlatformOrderService: class {
    getOrders = mockGetOrders;
    acceptOrder = mockAcceptOrder;
    rejectOrder = mockRejectOrder;
    getConfig = mockGetConfig;
    updateConfig = mockUpdateConfig;
  },
}));

import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

const mockAuth = requireAdminAuth as ReturnType<typeof vi.fn>;

function makeRequest(
  path: string,
  params: Record<string, string> = {},
  options?: { method?: string; body?: string; headers?: Record<string, string> },
) {
  const url = new URL(`http://localhost:3000${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), options as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'admin-1', tenantId: 'tenant-1' },
  });
});

// ============================================================================
// GET /api/admin/platform-orders
// ============================================================================

describe('GET /api/admin/platform-orders', () => {
  let GET: any;

  beforeEach(async () => {
    const mod = await import('../route');
    GET = mod.GET;
  });

  it('debe retornar lista de pedidos', async () => {
    mockGetOrders.mockResolvedValue({
      success: true,
      data: [{ id: 'o-1', platform: 'PEDIDOSYA' }],
    });

    const req = makeRequest('/api/admin/platform-orders');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.orders).toHaveLength(1);
  });

  it('debe pasar filtros', async () => {
    mockGetOrders.mockResolvedValue({ success: true, data: [] });

    const req = makeRequest('/api/admin/platform-orders', {
      platform: 'LLAMAFOOD',
      status: 'RECEIVED',
      limit: '20',
    });
    await GET(req);

    expect(mockGetOrders).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        platform: 'LLAMAFOOD',
        status: 'RECEIVED',
        limit: 20,
      }),
    );
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/platform-orders');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// POST /api/admin/platform-orders/[id]/accept
// ============================================================================

describe('POST /api/admin/platform-orders/[id]/accept', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/accept/route');
    POST = mod.POST;
  });

  it('debe aceptar pedido', async () => {
    mockAcceptOrder.mockResolvedValue({
      success: true,
      data: { id: 'o-1', status: 'ACCEPTED' },
    });

    const req = makeRequest('/api/admin/platform-orders/o-1/accept', {}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'o-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.status).toBe('ACCEPTED');
  });

  it('debe retornar error si no se puede aceptar', async () => {
    mockAcceptOrder.mockResolvedValue({
      success: false,
      error: { message: 'Cannot accept' },
    });

    const req = makeRequest('/api/admin/platform-orders/o-1/accept', {}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'o-1' }) });
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// POST /api/admin/platform-orders/[id]/reject
// ============================================================================

describe('POST /api/admin/platform-orders/[id]/reject', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../[id]/reject/route');
    POST = mod.POST;
  });

  it('debe rechazar pedido con razón', async () => {
    mockRejectOrder.mockResolvedValue({
      success: true,
      data: { id: 'o-1', status: 'REJECTED', rejectionReason: 'Sin stock' },
    });

    const req = makeRequest('/api/admin/platform-orders/o-1/reject', {}, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Sin stock' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'o-1' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.order.rejectionReason).toBe('Sin stock');
  });

  it('debe requerir razón', async () => {
    const req = makeRequest('/api/admin/platform-orders/o-1/reject', {}, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'o-1' }) });
    expect(res.status).toBe(400);
  });

  it('debe rechazar sin auth', async () => {
    mockAuth.mockResolvedValue({
      authorized: false,
      response: new Response('Unauthorized', { status: 401 }),
    });

    const req = makeRequest('/api/admin/platform-orders/o-1/reject', {}, {
      method: 'POST',
      body: JSON.stringify({ reason: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req, { params: Promise.resolve({ id: 'o-1' }) });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// GET/PATCH /api/admin/platform-config
// ============================================================================

describe('GET /api/admin/platform-config', () => {
  let GET: any;

  beforeEach(async () => {
    const mod = await import('../../platform-config/route');
    GET = mod.GET;
  });

  it('debe retornar configs', async () => {
    mockGetConfig.mockResolvedValue({
      success: true,
      data: [{ platform: 'PEDIDOSYA', isActive: true }],
    });

    const req = makeRequest('/api/admin/platform-config');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.configs).toHaveLength(1);
  });
});

describe('PATCH /api/admin/platform-config', () => {
  let PATCH: any;

  beforeEach(async () => {
    const mod = await import('../../platform-config/route');
    PATCH = mod.PATCH;
  });

  it('debe actualizar config', async () => {
    mockUpdateConfig.mockResolvedValue({
      success: true,
      data: { platform: 'PEDIDOSYA', autoAccept: true },
    });

    const req = makeRequest('/api/admin/platform-config', {}, {
      method: 'PATCH',
      body: JSON.stringify({ platform: 'PEDIDOSYA', autoAccept: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it('debe rechazar plataforma inválida', async () => {
    const req = makeRequest('/api/admin/platform-config', {}, {
      method: 'PATCH',
      body: JSON.stringify({ platform: 'UBER_EATS', autoAccept: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar commissionRate fuera de rango', async () => {
    const req = makeRequest('/api/admin/platform-config', {}, {
      method: 'PATCH',
      body: JSON.stringify({ platform: 'PEDIDOSYA', commissionRate: 2.0 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
