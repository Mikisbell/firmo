/**
 * Invoice Service - Tests
 *
 * Tests for emission, void, credit notes, series, and stats.
 *
 * @module core/services/__tests__/invoice.service.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from '../invoice.service';
import type { EmitInvoiceInput, VoidInvoiceInput, PaymentSummary } from '../invoice.service';

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
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    invoice_queue: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    invoice_cdr: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    credit_notes: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    orders: {
      findFirst: vi.fn(),
    },
    customers: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'auto-cust-001' }),
      update: vi.fn().mockResolvedValue({}),
    },
    events: {
      create: vi.fn(),
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
    customerDoc: '12345678',
    paymentSummary: createPaymentSummary(),
    issuedBy: 'user-001',
    terminalId: 'terminal-001',
    ...overrides,
  };
}

function createMockInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-001',
    tenant_id: 'tenant-123',
    order_id: 'order-456',
    check_id: 'check-789',
    invoice_type: 'BOLETA',
    series: 'B001',
    invoice_number: '00000001',
    customer_doc_type: 'DNI',
    customer_doc: '12345678',
    total_cents: 10000,
    payment_summary: createPaymentSummary(),
    status: 'ISSUED',
    void_reason: null,
    voided_by: null,
    voided_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('InvoiceService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: InvoiceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new InvoiceService(prisma);
  });

  // ========================================================================
  // emitInvoice
  // ========================================================================

  describe('emitInvoice', () => {
    it('debe emitir una boleta exitosamente', async () => {
      const input = createEmitInput();

      // Mock: order exists and has paid check
      prisma.orders.findFirst.mockResolvedValueOnce({
        id: 'order-456',
        tenant_id: 'tenant-123',
        status: 'PAID',
        checks: [{ check_id: 'check-789', payment: { status: 'PAID' } }],
      });

      // Mock: no existing invoice for this check
      prisma.invoices.findFirst.mockResolvedValueOnce(null);

      // Mock: series generation ($transaction) - returns series result directly
      prisma.$transaction.mockResolvedValueOnce({ series: 'B001', invoiceNumber: '00000001' });

      // Mock: transaction creates invoice
      const mockInvoice = createMockInvoice();
      prisma.invoices.create.mockResolvedValueOnce(mockInvoice);
      prisma.events.create.mockResolvedValueOnce({});
      prisma.invoice_queue.create.mockResolvedValueOnce({});

      const result = await service.emitInvoice(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.invoiceType).toBe('BOLETA');
        expect(result.data.series).toBe('B001');
        expect(result.data.status).toBe('ISSUED');
      }
    });

    it('debe rechazar si la orden no existe', async () => {
      prisma.orders.findFirst.mockResolvedValueOnce(null);

      const result = await service.emitInvoice(createEmitInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('order');
      }
    });

    it('debe rechazar duplicado de check', async () => {
      prisma.orders.findFirst.mockResolvedValueOnce({
        id: 'order-456', tenant_id: 'tenant-123', status: 'PAID',
        checks: [{ check_id: 'check-789', payment: { status: 'PAID' } }],
      });
      prisma.invoices.findFirst.mockResolvedValueOnce(createMockInvoice());

      const result = await service.emitInvoice(createEmitInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toContain('CONFLICT');
      }
    });

    it('debe validar RUC de 11 dígitos para factura', async () => {
      const input = createEmitInput({
        invoiceType: 'FACTURA',
        customerDocType: 'RUC',
        customerDoc: '1234', // Invalid - needs 11 digits
      });

      const result = await service.emitInvoice(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toMatch(/RUC|11|dígitos/i);
      }
    });

    it('debe validar DNI de 8 dígitos', async () => {
      const input = createEmitInput({
        customerDocType: 'DNI',
        customerDoc: '123', // Invalid - needs 8 digits
      });

      const result = await service.emitInvoice(input);

      expect(result.success).toBe(false);
    });

    it('debe requerir RUC para FACTURA', async () => {
      const input = createEmitInput({
        invoiceType: 'FACTURA',
        customerDocType: 'DNI',
        customerDoc: '12345678',
      });

      const result = await service.emitInvoice(input);

      expect(result.success).toBe(false);
    });

    it('debe manejar DNI opcional en boleta', async () => {
      const input = createEmitInput({
        invoiceType: 'BOLETA',
        customerDocType: undefined,
        customerDoc: undefined,
      });

      prisma.orders.findFirst.mockResolvedValueOnce({
        id: 'order-456', tenant_id: 'tenant-123', status: 'PAID',
        checks: [{ check_id: 'check-789', payment: { status: 'PAID' } }],
      });
      prisma.invoices.findFirst.mockResolvedValueOnce(null);

      // Mock: series generation ($transaction) - returns series result directly
      prisma.$transaction.mockResolvedValueOnce({ series: 'B001', invoiceNumber: '00000001' });

      const mockInvoice = createMockInvoice({
        customer_doc_type: null, customer_doc: null,
      });
      prisma.invoices.create.mockResolvedValueOnce(mockInvoice);
      prisma.events.create.mockResolvedValueOnce({});
      prisma.invoice_queue.create.mockResolvedValueOnce({});

      const result = await service.emitInvoice(input);

      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // voidInvoice
  // ========================================================================

  describe('voidInvoice', () => {
    function createVoidInput(overrides: Partial<VoidInvoiceInput> = {}): VoidInvoiceInput {
      return {
        tenantId: 'tenant-123',
        invoiceId: 'inv-001',
        reason: 'Error en el monto cobrado al cliente',
        voidedBy: 'user-001',
        approvedBy: 'supervisor-001',
        terminalId: 'terminal-001',
        ...overrides,
      };
    }

    it('debe anular una factura del mismo día', async () => {
      const todayInvoice = createMockInvoice({ created_at: new Date() });
      prisma.invoices.findFirst.mockResolvedValueOnce(todayInvoice);

      // Transaction mocks
      prisma.invoices.update.mockResolvedValueOnce({
        ...todayInvoice, status: 'VOIDED', void_reason: 'Error en monto',
      });
      prisma.events.create.mockResolvedValueOnce({});
      prisma.invoice_cdr.findFirst.mockResolvedValueOnce(null);

      const result = await service.voidInvoice(createVoidInput());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('VOIDED');
      }
    });

    it('debe rechazar anulación de día anterior', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const oldInvoice = createMockInvoice({ created_at: yesterday });
      prisma.invoices.findFirst.mockResolvedValueOnce(oldInvoice);

      const result = await service.voidInvoice(createVoidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('same day');
      }
    });

    it('debe rechazar anulación de factura ya anulada', async () => {
      const voidedInvoice = createMockInvoice({ status: 'VOIDED' });
      prisma.invoices.findFirst.mockResolvedValueOnce(voidedInvoice);

      const result = await service.voidInvoice(createVoidInput());

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('already voided');
      }
    });

    it('debe requerir razón de al menos 5 caracteres', async () => {
      const result = await service.voidInvoice(createVoidInput({ reason: 'abc' }));

      expect(result.success).toBe(false);
    });

    it('debe retornar error si factura no existe', async () => {
      prisma.invoices.findFirst.mockResolvedValueOnce(null);

      const result = await service.voidInvoice(createVoidInput({ invoiceId: 'no-existe' }));

      expect(result.success).toBe(false);
    });

    it('debe crear cola VOID_IN_SUNAT si factura fue aceptada', async () => {
      const todayInvoice = createMockInvoice({ created_at: new Date() });
      prisma.invoices.findFirst.mockResolvedValueOnce(todayInvoice);

      prisma.invoices.update.mockResolvedValueOnce({
        ...todayInvoice, status: 'VOIDED',
      });
      prisma.events.create.mockResolvedValueOnce({});
      prisma.invoice_cdr.findFirst.mockResolvedValueOnce({
        response_code: '0', // Accepted by SUNAT
      });
      prisma.invoice_queue.create.mockResolvedValueOnce({});

      const result = await service.voidInvoice(createVoidInput());

      expect(result.success).toBe(true);
      expect(prisma.invoice_queue.create).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // getInvoice
  // ========================================================================

  describe('getInvoice', () => {
    it('debe retornar factura existente', async () => {
      const mockInvoice = createMockInvoice();
      prisma.invoices.findFirst.mockResolvedValueOnce(mockInvoice);

      const result = await service.getInvoice('tenant-123', 'inv-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('inv-001');
      }
    });

    it('debe retornar error si no existe', async () => {
      prisma.invoices.findFirst.mockResolvedValueOnce(null);

      const result = await service.getInvoice('tenant-123', 'no-existe');

      expect(result.success).toBe(false);
    });
  });

  // ========================================================================
  // querySunatStatus
  // ========================================================================

  describe('querySunatStatus', () => {
    it('debe retornar ACCEPTED si CDR tiene código 0', async () => {
      prisma.invoices.findFirst.mockResolvedValueOnce(createMockInvoice());
      prisma.invoice_cdr.findFirst.mockResolvedValueOnce({
        response_code: '0',
        response_message: 'Aceptado',
        hash: 'HASHTEST',
        received_at: new Date(),
      });

      const result = await service.querySunatStatus('tenant-123', 'inv-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ACCEPTED');
        expect(result.data.hash).toBe('HASHTEST');
      }
    });

    it('debe retornar REJECTED si CDR tiene código no-0', async () => {
      prisma.invoices.findFirst.mockResolvedValueOnce(createMockInvoice());
      prisma.invoice_cdr.findFirst.mockResolvedValueOnce({
        response_code: '2033',
        response_message: 'Rechazado por SUNAT',
        hash: null,
        received_at: new Date(),
      });

      const result = await service.querySunatStatus('tenant-123', 'inv-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('REJECTED');
      }
    });

    it('debe retornar PENDING si no hay CDR', async () => {
      prisma.invoices.findFirst.mockResolvedValueOnce(createMockInvoice());
      prisma.invoice_cdr.findFirst.mockResolvedValueOnce(null);

      const result = await service.querySunatStatus('tenant-123', 'inv-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PENDING');
      }
    });
  });

  // ========================================================================
  // getInvoiceStats
  // ========================================================================

  describe('getInvoiceStats', () => {
    it('debe retornar conteos de facturas', async () => {
      // Mock aggregate (total count + sum)
      prisma.invoices.aggregate.mockResolvedValueOnce({
        _count: { id: 100 },
        _sum: { total_cents: 5000000 },
      });

      // Mock groupBy by invoice_type
      prisma.invoices.groupBy.mockResolvedValueOnce([
        { invoice_type: 'BOLETA', _count: { id: 60 } },
        { invoice_type: 'FACTURA', _count: { id: 30 } },
      ]);

      // Mock voided count (invoices.count call #1)
      prisma.invoices.count.mockResolvedValueOnce(10);

      // Mock pending SUNAT count (invoices.count call #2)
      prisma.invoices.count.mockResolvedValueOnce(5);

      const result = await service.getInvoiceStats('tenant-123');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalCount).toBe(100);
        expect(result.data.boletaCount).toBe(60);
        expect(result.data.facturaCount).toBe(30);
        expect(result.data.voidedCount).toBe(10);
        expect(result.data.pendingSunatCount).toBe(5);
      }
    });
  });
});
