/**
 * Webhook API Tests
 *
 * @module app/api/webhooks/__tests__/webhook-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/db/prisma', () => ({
  default: {},
}));

const mockHandleIncomingOrder = vi.fn();

vi.mock('@/src/core/services/platform-order.service', () => ({
  PlatformOrderService: class {
    handleIncomingOrder = mockHandleIncomingOrder;
  },
}));

function makeRequest(
  path: string,
  options?: { method?: string; body?: string; headers?: Record<string, string> },
) {
  const url = new URL(`http://localhost:3000${path}`);
  return new NextRequest(url.toString(), options as any);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// PedidosYa Webhook
// ============================================================================

describe('POST /api/webhooks/pedidosya', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../pedidosya/route');
    POST = mod.POST;
  });

  it('debe procesar webhook válido', async () => {
    mockHandleIncomingOrder.mockResolvedValue({
      success: true,
      data: { id: 'order-1' },
    });

    const req = makeRequest('/api/webhooks/pedidosya?tenant_id=t1', {
      method: 'POST',
      body: JSON.stringify({ id: 'PY-123' }),
      headers: {
        'Content-Type': 'application/json',
        'x-pedidosya-signature': 'sig',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(data.orderId).toBe('order-1');
  });

  it('debe rechazar sin tenant_id', async () => {
    const req = makeRequest('/api/webhooks/pedidosya', {
      method: 'POST',
      body: JSON.stringify({ id: 'PY-123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe rechazar JSON inválido', async () => {
    const req = makeRequest('/api/webhooks/pedidosya?tenant_id=t1', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe retornar 401 si firma inválida', async () => {
    mockHandleIncomingOrder.mockResolvedValue({
      success: false,
      error: { message: 'Invalid webhook signature' },
    });

    const req = makeRequest('/api/webhooks/pedidosya?tenant_id=t1', {
      method: 'POST',
      body: JSON.stringify({ id: 'PY-123' }),
      headers: {
        'Content-Type': 'application/json',
        'x-pedidosya-signature': 'wrong',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('debe retornar 400 si servicio falla', async () => {
    mockHandleIncomingOrder.mockResolvedValue({
      success: false,
      error: { message: 'Platform not configured' },
    });

    const req = makeRequest('/api/webhooks/pedidosya?tenant_id=t1', {
      method: 'POST',
      body: JSON.stringify({ id: 'PY-123' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// LlamaFood Webhook
// ============================================================================

describe('POST /api/webhooks/llamafood', () => {
  let POST: any;

  beforeEach(async () => {
    const mod = await import('../llamafood/route');
    POST = mod.POST;
  });

  it('debe procesar webhook válido', async () => {
    mockHandleIncomingOrder.mockResolvedValue({
      success: true,
      data: { id: 'order-lf' },
    });

    const req = makeRequest('/api/webhooks/llamafood?tenant_id=t1', {
      method: 'POST',
      body: JSON.stringify({ pedido_id: 'LF-001' }),
      headers: {
        'Content-Type': 'application/json',
        'x-llamafood-signature': 'sig',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
  });

  it('debe rechazar sin tenant_id', async () => {
    const req = makeRequest('/api/webhooks/llamafood', {
      method: 'POST',
      body: JSON.stringify({ pedido_id: 'LF-001' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('debe pasar signature de header', async () => {
    mockHandleIncomingOrder.mockResolvedValue({
      success: true,
      data: { id: 'order-lf' },
    });

    const req = makeRequest('/api/webhooks/llamafood?tenant_id=t1', {
      method: 'POST',
      body: JSON.stringify({ pedido_id: 'LF-001' }),
      headers: {
        'Content-Type': 'application/json',
        'x-llamafood-signature': 'sha256=abc',
      },
    });

    await POST(req);
    expect(mockHandleIncomingOrder).toHaveBeenCalledWith(
      't1',
      'LLAMAFOOD',
      expect.any(Object),
      'sha256=abc',
    );
  });
});
