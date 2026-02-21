/**
 * POS Invoice API Tests
 *
 * @module app/api/pos/invoices/__tests__/invoices-api.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEmitInvoice = vi.fn();

vi.mock('@/src/core/services/invoice.service', () => ({
  InvoiceService: class {
    emitInvoice = mockEmitInvoice;
  },
}));

vi.mock('@/src/core/db/prisma', () => ({ default: {} }));

const mockPosAuth = vi.fn();
vi.mock('@/src/core/middleware/pos-auth', () => ({
  requirePosAuth: (...args: any[]) => mockPosAuth(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authed() {
  mockPosAuth.mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', tenantId: 'tenant-1', role: 'CASHIER', terminalId: 'term-1' },
  });
}

function unauthorized() {
  mockPosAuth.mockResolvedValue({
    authorized: false,
    response: new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 }),
  });
}

const baseSummary = {
  subtotalCents: 10000,
  discountCents: 0,
  taxCents: 1800,
  totalCents: 11800,
  payments: [{ method: 'CASH', amountCents: 11800 }],
};

function makeRequest(body: any) {
  return new NextRequest('http://localhost/api/pos/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  } as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/pos/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authed();
  });

  it('debe emitir boleta exitosamente', async () => {
    mockEmitInvoice.mockResolvedValue({
      success: true,
      data: {
        invoiceId: 'inv-1',
        series: 'B001',
        number: '00000123',
        qrData: 'https://sunat.gob.pe/...',
      },
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.invoiceId).toBe('inv-1');
    expect(data.series).toBe('B001');
  });

  it('debe emitir factura con RUC', async () => {
    mockEmitInvoice.mockResolvedValue({
      success: true,
      data: { invoiceId: 'inv-2', series: 'F001', number: '00000001' },
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'FACTURA',
      customerDocType: 'RUC',
      customerDoc: '20123456789',
      customerName: 'Empresa SAC',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(201);
  });

  it('debe rechazar factura sin RUC', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'FACTURA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('RUC');
  });

  it('debe rechazar sin orderId', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('orderId');
  });

  it('debe rechazar tipo inválido', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'NOTA_CREDITO',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('invoiceType');
  });

  it('debe rechazar sin paymentSummary', async () => {
    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
    }));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('paymentSummary');
  });

  it('debe rechazar sin auth', async () => {
    unauthorized();

    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(401);
  });

  it('debe retornar error del servicio', async () => {
    mockEmitInvoice.mockResolvedValue({
      success: false,
      error: { message: 'Error de conexión con SUNAT' },
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(400);
  });

  it('debe retornar 409 si ya existe factura', async () => {
    mockEmitInvoice.mockResolvedValue({
      success: false,
      error: { message: 'Comprobante ya existe para este check' },
    });

    const { POST } = await import('../route');
    const res = await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(res.status).toBe(409);
  });

  it('debe pasar tenantId del usuario autenticado', async () => {
    mockEmitInvoice.mockResolvedValue({
      success: true,
      data: { invoiceId: 'inv-3' },
    });

    const { POST } = await import('../route');
    await POST(makeRequest({
      orderId: 'order-1',
      checkId: 'c1',
      invoiceType: 'BOLETA',
      paymentSummary: baseSummary,
    }));

    expect(mockEmitInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });
});
