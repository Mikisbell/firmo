/**
 * POS Payments API Tests
 *
 * @module app/api/pos/payments/__tests__/payments-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockProcessPayment = vi.fn();
const mockGetPaymentsByShift = vi.fn();
const mockGetPaymentsByOrder = vi.fn();

vi.mock('@/src/core/services/payment.service', () => ({
  PaymentService: class {
    processPayment = mockProcessPayment;
    getPaymentsByShift = mockGetPaymentsByShift;
    getPaymentsByOrder = mockGetPaymentsByOrder;
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

function makePostRequest(body: any) {
  return new NextRequest('http://localhost/api/pos/payments', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/pos/payments');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url.toString(), { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests: POST /api/pos/payments
// ---------------------------------------------------------------------------

describe('POST /api/pos/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe registrar pago exitosamente', async () => {
    mockProcessPayment.mockResolvedValue({
      success: true,
      data: {
        paymentId: 'pay-1',
        orderId: 'order-1',
        checkId: 'c1',
        amountCents: 5000,
        method: 'CASH',
        status: 'COMPLETED',
        processedAt: new Date(),
        changeCents: 0,
      },
    });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 5000,
      method: 'CASH',
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.paymentId).toBe('pay-1');
    expect(data.method).toBe('CASH');
  });

  it('debe rechazar sin orderId', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      checkId: 'c1',
      amountCents: 5000,
      method: 'CASH',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('orderId');
  });

  it('debe rechazar sin checkId', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      amountCents: 5000,
      method: 'CASH',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('checkId');
  });

  it('debe rechazar amountCents <= 0', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 0,
      method: 'CASH',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('amountCents');
  });

  it('debe rechazar método inválido', async () => {
    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 5000,
      method: 'BITCOIN',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('method');
  });

  it('debe aceptar pago YAPE con referencia', async () => {
    mockProcessPayment.mockResolvedValue({
      success: true,
      data: {
        paymentId: 'pay-2',
        orderId: 'order-1',
        checkId: 'c1',
        amountCents: 8500,
        method: 'YAPE',
        reference: 'YPE-123',
        status: 'COMPLETED',
        processedAt: new Date(),
        changeCents: 0,
      },
    });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 8500,
      method: 'YAPE',
      reference: 'YPE-123',
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.method).toBe('YAPE');
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 5000,
      method: 'CASH',
    }));

    expect(res.status).toBe(401);
  });

  it('debe retornar error del servicio', async () => {
    mockProcessPayment.mockResolvedValue({
      success: false,
      error: { message: 'Failed to process payment' },
    });

    const { POST } = await import('../route');
    const res = await POST(makePostRequest({
      orderId: 'order-1',
      checkId: 'c1',
      amountCents: 5000,
      method: 'CASH',
    }));

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /api/pos/payments
// ---------------------------------------------------------------------------

describe('GET /api/pos/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe retornar pagos por shiftId', async () => {
    mockGetPaymentsByShift.mockResolvedValue({
      success: true,
      data: [
        { id: 'p1', amount_cents: 5000, payment_method: 'CASH' },
      ],
    });

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ shiftId: 'shift-1' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payments).toHaveLength(1);
  });

  it('debe retornar pagos por orderId', async () => {
    mockGetPaymentsByOrder.mockResolvedValue({
      success: true,
      data: [
        { id: 'p1', amount_cents: 3000, payment_method: 'YAPE' },
      ],
    });

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ orderId: 'order-1' }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.payments).toHaveLength(1);
  });

  it('debe rechazar sin shiftId ni orderId', async () => {
    const { GET } = await import('../route');
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('shiftId');
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { GET } = await import('../route');
    const res = await GET(makeGetRequest({ shiftId: 'shift-1' }));

    expect(res.status).toBe(401);
  });
});
