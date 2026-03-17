/**
 * Invoice Customer Auto-Link - Tests
 *
 * Tests that emitInvoice auto-creates/links customers
 * when customerDoc is provided.
 *
 * @module core/services/__tests__/invoice-customer-link.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '../invoice.service';
import type { EmitInvoiceInput, PaymentSummary } from '../invoice.service';

// Mock dependencies
vi.mock('@/src/core/db/transaction', () => ({
  withTransaction: vi.fn(async (_prisma: any, fn: any) => {
    try {
      const result = await fn(_prisma);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error };
    }
  }),
}));

vi.mock('@/src/core/observability/logger-pino', () => {
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), child: vi.fn() };
  logger.child.mockReturnValue(logger);
  return { pinoLogger: logger };
});

vi.mock('@/src/core/cache/redis.service', () => {
  class MockCacheService {
    get = vi.fn().mockResolvedValue(null);
    set = vi.fn().mockResolvedValue(undefined);
    del = vi.fn().mockResolvedValue(undefined);
    deletePattern = vi.fn().mockResolvedValue(undefined);
  }
  return { CacheService: MockCacheService };
});

// ============================================================================
// Helpers
// ============================================================================

function createMockPrisma() {
  return {
    invoices: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    invoice_queue: {
      create: vi.fn().mockResolvedValue({}),
    },
    orders: {
      findFirst: vi.fn(),
    },
    customers: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    events: {
      create: vi.fn().mockResolvedValue({}),
    },
    tenant_settings: {
      findUnique: vi.fn().mockResolvedValue({ loyalty_enabled: false }),
    },
    customer_profile: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
    },
    loyalty_ledger: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  } as any;
}

function createPaymentSummary(totalCents = 10000): PaymentSummary {
  return {
    subtotalCents: Math.round(totalCents / 1.18),
    discountCents: 0,
    taxCents: totalCents - Math.round(totalCents / 1.18),
    totalCents,
    payments: [{ method: 'CASH', amountCents: totalCents }],
  };
}

function createEmitInput(overrides: Partial<EmitInvoiceInput> = {}): EmitInvoiceInput {
  return {
    tenantId: 'tenant-123',
    orderId: 'order-456',
    checkId: 'check-789',
    invoiceType: 'BOLETA',
    customerDocType: 'DNI',
    customerDoc: '43708661',
    customerName: 'MIGUEL ANGEL RIVERA',
    paymentSummary: createPaymentSummary(),
    issuedBy: 'user-001',
    terminalId: 'terminal-001',
    ...overrides,
  };
}

function setupOrderExists(prisma: any) {
  prisma.orders.findFirst.mockResolvedValueOnce({
    id: 'order-456',
    tenant_id: 'tenant-123',
    status: 'PAID',
    checks: [{ check_id: 'check-789', payment: { status: 'PAID' } }],
  });
}

function setupSeriesGeneration(prisma: any) {
  prisma.$transaction.mockResolvedValueOnce({ series: 'B001', invoiceNumber: '00000001' });
}

function setupInvoiceCreate(prisma: any) {
  prisma.invoices.create.mockResolvedValueOnce({
    id: 'inv-001',
    tenant_id: 'tenant-123',
    order_id: 'order-456',
    invoice_type: 'BOLETA',
    series: 'B001',
    invoice_number: '00000001',
    total_cents: 10000,
    status: 'ISSUED',
    customer_doc: '43708661',
    customer_doc_type: 'DNI',
    customer_name: 'MIGUEL ANGEL RIVERA',
    created_at: new Date(),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('Invoice Customer Auto-Link', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new InvoiceService(prisma);
  });

  it('creates new customer when customerDoc provided and not in DB', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    // No existing customer
    prisma.customers.findFirst.mockResolvedValue(null);
    prisma.customers.create.mockResolvedValue({
      id: 'new-cust-001',
      tenant_id: 'tenant-123',
      phone: 'DOC-43708661',
      name: 'MIGUEL ANGEL RIVERA',
      doc_type: 'DNI',
      doc_number: '43708661',
    });

    const result = await service.emitInvoice(createEmitInput());

    expect(result.success).toBe(true);

    // Should have created the customer
    expect(prisma.customers.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenant_id: 'tenant-123',
        phone: 'DOC-43708661',
        name: 'MIGUEL ANGEL RIVERA',
        doc_type: 'DNI',
        doc_number: '43708661',
      }),
    });

    // Should have linked invoice to customer (invoice ID is generated via uuidv4)
    expect(prisma.invoices.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: { customer_id: 'new-cust-001' },
    });
  });

  it('links existing customer without creating duplicate', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    // Customer already exists
    prisma.customers.findFirst.mockResolvedValue({
      id: 'existing-cust-001',
      name: 'MIGUEL ANGEL RIVERA',
    });

    const result = await service.emitInvoice(createEmitInput());

    expect(result.success).toBe(true);
    expect(prisma.customers.create).not.toHaveBeenCalled();

    // Should link to existing customer (invoice ID is generated via uuidv4)
    expect(prisma.invoices.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: { customer_id: 'existing-cust-001' },
    });
  });

  it('updates customer name if existing customer has no name', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    // Customer exists but without name
    prisma.customers.findFirst.mockResolvedValue({
      id: 'existing-cust-002',
      name: null,
    });

    await service.emitInvoice(createEmitInput({ customerName: 'NUEVO NOMBRE' }));

    expect(prisma.customers.update).toHaveBeenCalledWith({
      where: { id: 'existing-cust-002' },
      data: { name: 'NUEVO NOMBRE' },
    });
  });

  it('does NOT update customer name if customer already has one', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    prisma.customers.findFirst.mockResolvedValue({
      id: 'existing-cust-003',
      name: 'ALREADY HAS NAME',
    });

    await service.emitInvoice(createEmitInput({ customerName: 'DIFFERENT NAME' }));

    // Should NOT have updated the customer name
    expect(prisma.customers.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-cust-003' },
        data: expect.objectContaining({ name: 'DIFFERENT NAME' }),
      }),
    );
  });

  it('skips customer creation when no customerDoc provided', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    const result = await service.emitInvoice(createEmitInput({ customerDoc: undefined }));

    expect(result.success).toBe(true);
    expect(prisma.customers.findFirst).not.toHaveBeenCalled();
    expect(prisma.customers.create).not.toHaveBeenCalled();
  });

  it('uses DOC- prefix for placeholder phone', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    prisma.customers.findFirst.mockResolvedValue(null);
    prisma.customers.create.mockResolvedValue({
      id: 'new-cust-ruc',
      tenant_id: 'tenant-123',
      phone: 'DOC-20100047218',
    });

    await service.emitInvoice(createEmitInput({
      invoiceType: 'FACTURA',
      customerDocType: 'RUC',
      customerDoc: '20100047218',
      customerName: 'EMPRESA SAC',
    }));

    expect(prisma.customers.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: 'DOC-20100047218',
        doc_type: 'RUC',
        doc_number: '20100047218',
        name: 'EMPRESA SAC',
      }),
    });
  });

  it('handles customerDoc with no customerName gracefully', async () => {
    setupOrderExists(prisma);
    setupSeriesGeneration(prisma);
    setupInvoiceCreate(prisma);

    prisma.customers.findFirst.mockResolvedValue(null);
    prisma.customers.create.mockResolvedValue({ id: 'new-anon' });

    await service.emitInvoice(createEmitInput({
      customerDoc: '11111111',
      customerName: undefined,
    }));

    expect(prisma.customers.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: null,
        doc_number: '11111111',
      }),
    });
  });
});
