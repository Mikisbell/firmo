/**
 * SUNAT Queue Worker - Bug Condition Exploration Tests
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * These tests verify that the bug conditions are now properly validated:
 * - Bug 1: Empty items arrays return validation error before sending to SUNAT
 * - Bug 2: Empty customer names for FACTURA return validation error before sending to SUNAT
 * 
 * **Property 1: Expected Behavior** - Validation Failures Detected
 * 
 * After the fix, these tests verify that:
 * - Validation errors are returned with SUNAT_REJECTED code
 * - Provider is NOT called (validation happens before SUNAT call)
 * - Error messages clearly indicate the validation failure
 * 
 * @module core/jobs/__tests__/sunat-queue-worker-bugfix-exploration.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SunatQueueWorker } from '../sunat-queue-worker';
import { ok } from '@/src/core/result';
import type { InvoiceProviderRouter, InvoiceProvider } from '@/src/core/integrations/sunat/provider-router';
import type { SunatDocumentResult } from '@/src/core/integrations/sunat/sunat-direct-adapter';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ============================================================================
// Test Helpers
// ============================================================================

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440001';
const INVOICE_ID = '660e8400-e29b-41d4-a716-446655440002';

function makeQueueItem(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    tenant_id: TENANT_ID,
    invoice_id: INVOICE_ID,
    action: 'EMIT_TO_SUNAT',
    priority: 5,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    scheduled_at: new Date(),
    status: 'PENDING',
    ...overrides,
  };
}

function makeSuccessResult(): SunatDocumentResult {
  return {
    success: true,
    cdrResponseCode: '0',
    cdrResponseMessage: 'Comprobante aceptado por SUNAT',
    cdrXml: '<cdr>mock</cdr>',
    hash: 'HASH-12345',
    signedXml: '<signed>mock</signed>',
    pdfBase64: 'bW9jaw==',
    qrString: '20123456789|03|B001|00000001|1.80|11.80|2026-03-02|1|12345678||',
  };
}

function makeProvider(overrides: Partial<InvoiceProvider> = {}): InvoiceProvider {
  return {
    sendInvoice: vi.fn().mockResolvedValue(ok(makeSuccessResult())),
    sendCreditNote: vi.fn().mockResolvedValue(ok(makeSuccessResult())),
    sendVoidCommunication: vi.fn().mockResolvedValue(ok(makeSuccessResult())),
    sendDailySummary: vi.fn().mockResolvedValue(ok(makeSuccessResult())),
    queryTicketStatus: vi.fn().mockResolvedValue(ok({ status: 'ACCEPTED' as const })),
    testConnection: vi.fn().mockResolvedValue(ok({ message: 'OK' })),
    ...overrides,
  };
}

function makeProviderRouter(provider: InvoiceProvider): InvoiceProviderRouter {
  return {
    getProvider: vi.fn().mockResolvedValue(ok(provider)),
    isEnabled: vi.fn().mockResolvedValue(true),
    clearCache: vi.fn(),
  } as unknown as InvoiceProviderRouter;
}

function makePrisma(invoiceData: any = null, creditNoteData: any = null) {
  const prisma = {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    invoice_queue: {
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    invoices: {
      findUnique: vi.fn().mockResolvedValue(invoiceData),
    },
    credit_notes: {
      findFirst: vi.fn().mockResolvedValue(creditNoteData),
    },
    invoice_cdr: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    events: {
      create: vi.fn().mockResolvedValue({}),
      // Sin items anulados por defecto (resolveVoidedLineIds -> set vacio).
      findMany: vi.fn().mockResolvedValue([]),
    },
    customers: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  return prisma;
}

// ============================================================================
// Bug Condition Exploration Tests
// ============================================================================

describe('SUNAT Queue Worker - Bug Condition Exploration', () => {
  let provider: InvoiceProvider;
  let router: InvoiceProviderRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeProvider();
    router = makeProviderRouter(provider);
  });

  describe('Bug 1: Empty items array sent to SUNAT (handleEmit)', () => {
    it('should return SUNAT_REJECTED error when order has no items (not call provider)', async () => {
      // Setup: Invoice with order that has no items
      const invoiceWithNoItems = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000001',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '12345678',
        total_cents: 1180,
        created_at: new Date('2026-03-02'),
        check_id: 'check-001',
        customer: null,
        orders: {
          id: 'order-001',
          items: [], // Empty items array - this is the bug condition
          checks: [{ check_id: 'check-001', lines: [] }],
          customers: null,
        },
      };

      const prisma = makePrisma(invoiceWithNoItems);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Add queue item to process
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      // Execute
      await worker.processBatch(10);

      // EXPECTED: Validation error returned, provider NOT called
      expect(provider.sendInvoice).not.toHaveBeenCalled();
      
      // Verify queue item marked as FAILED with validation error
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('sin items'),
          }),
        }),
      );
    });

    it('should return SUNAT_REJECTED error when order relation is missing (not call provider)', async () => {
      // Setup: Invoice with no order relation loaded
      const invoiceWithNoOrder = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'F001',
        invoice_number: '00000001',
        invoice_type: 'FACTURA',
        customer_doc_type: 'RUC',
        customer_doc: '20123456789',
        customer_name: 'Test Company SAC',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        check_id: 'check-001',
        customer: null,
        orders: null, // No order relation - resolveInvoiceItems returns []
      };

      const prisma = makePrisma(invoiceWithNoOrder);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Add queue item to process
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      // Execute
      await worker.processBatch(10);

      // EXPECTED: Validation error returned, provider NOT called
      expect(provider.sendInvoice).not.toHaveBeenCalled();
      
      // Verify queue item marked as FAILED with validation error
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('sin items'),
          }),
        }),
      );
    });
  });

  describe('Bug 2: Empty customer name sent to SUNAT for FACTURA (handleEmit)', () => {
    it('should return SUNAT_REJECTED error when FACTURA has no customer name (not call provider)', async () => {
      // Setup: FACTURA invoice where all customer name lookups fail
      const facturaWithNoCustomerName = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'F001',
        invoice_number: '00000001',
        invoice_type: 'FACTURA', // FACTURA requires customer name
        customer_doc_type: 'RUC',
        customer_doc: '20123456789',
        customer_name: null, // No snapshot
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        check_id: 'check-001',
        customer: null, // No customer FK
        orders: {
          id: 'order-001',
          customer_id: null, // No customer_id for lookup
          items: [
            { line_id: 'line-1', name: 'Product', qty: 1, unit_price_cents: 10000, sku: 'PROD-01' },
          ],
          checks: [{ check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 1 }] }],
          customers: null, // No order customer relation
        },
      };

      const prisma = makePrisma(facturaWithNoCustomerName);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Add queue item to process
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      // Execute
      await worker.processBatch(10);

      // EXPECTED: Validation error returned, provider NOT called
      expect(provider.sendInvoice).not.toHaveBeenCalled();
      
      // Verify queue item marked as FAILED with validation error
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('sin nombre de cliente'),
          }),
        }),
      );
    });
  });

  describe('Bug 1: Empty items array sent to SUNAT (handleCreditNote)', () => {
    it('should return SUNAT_REJECTED error when credit note invoice has no items (not call provider)', async () => {
      // Setup: Credit note with invoice that has no items
      const creditNoteWithNoItems = {
        id: crypto.randomUUID(),
        invoice_id: INVOICE_ID,
        series: 'BC01',
        number: '00000001',
        reason: 'Devolucion',
        total_cents: 1180,
        created_at: new Date('2026-03-02'),
        invoices: {
          id: INVOICE_ID,
          series: 'B001',
          invoice_number: '00000001',
          invoice_type: 'BOLETA',
          customer_doc_type: 'DNI',
          customer_doc: '12345678',
          customer: null,
          orders: {
            id: 'order-001',
            items: [], // Empty items array - bug condition
            checks: [{ check_id: 'check-001', lines: [] }],
            customers: null,
          },
        },
      };

      const prisma = makePrisma(null, creditNoteWithNoItems);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_CREDIT_NOTE' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // EXPECTED: Validation error returned, provider NOT called
      expect(provider.sendCreditNote).not.toHaveBeenCalled();
      
      // Verify queue item marked as FAILED with validation error
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('sin items'),
          }),
        }),
      );
    });
  });

  describe('Bug 2: Empty customer name sent to SUNAT for FACTURA (handleCreditNote)', () => {
    it('should return SUNAT_REJECTED error when credit note FACTURA has no customer name (not call provider)', async () => {
      // Setup: Credit note for FACTURA with no customer name
      const creditNoteFacturaNoCustomer = {
        id: crypto.randomUUID(),
        invoice_id: INVOICE_ID,
        series: 'FC01',
        number: '00000001',
        reason: 'Devolucion',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        invoices: {
          id: INVOICE_ID,
          series: 'F001',
          invoice_number: '00000001',
          invoice_type: 'FACTURA', // FACTURA requires customer name
          customer_doc_type: 'RUC',
          customer_doc: '20123456789',
          customer_name: null, // No snapshot
          customer: null, // No customer FK
          orders: {
            id: 'order-001',
            customer_id: null,
            items: [
              { line_id: 'line-1', name: 'Product', qty: 1, unit_price_cents: 10000, sku: 'PROD-01' },
            ],
            checks: [{ check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 1 }] }],
            customers: null,
          },
        },
      };

      const prisma = makePrisma(null, creditNoteFacturaNoCustomer);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_CREDIT_NOTE' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // EXPECTED: Validation error returned, provider NOT called
      expect(provider.sendCreditNote).not.toHaveBeenCalled();
      
      // Verify queue item marked as FAILED with validation error
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('sin nombre de cliente'),
          }),
        }),
      );
    });
  });
});
