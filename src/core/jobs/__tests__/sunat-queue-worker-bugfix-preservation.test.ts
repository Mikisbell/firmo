/**
 * SUNAT Queue Worker - Preservation Property Tests
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * These tests verify that valid invoice processing remains unchanged after the fix.
 * They establish the baseline behavior that must be preserved:
 * - Valid invoices with items and customer names continue to be sent to SUNAT
 * - BOLETA with '-' customer name is accepted as valid
 * - Transient errors trigger retry logic with exponential backoff
 * - Non-retryable errors fail immediately without retries
 * - Credit note processing works for valid credit notes
 * 
 * **CRITICAL**: These tests are EXPECTED TO PASS on unfixed code.
 * Passing confirms the baseline behavior to preserve after implementing the fix.
 * 
 * **Property 2: Preservation** - Valid Invoice Processing Unchanged
 * 
 * @module core/jobs/__tests__/sunat-queue-worker-bugfix-preservation.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SunatQueueWorker } from '../sunat-queue-worker';
import { ok, err, DomainError } from '@/src/core/result';
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
// Preservation Property Tests
// ============================================================================

describe('SUNAT Queue Worker - Preservation Properties', () => {
  let provider: InvoiceProvider;
  let router: InvoiceProviderRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeProvider();
    router = makeProviderRouter(provider);
  });

  describe('Req 3.1, 3.2: Valid invoice processing continues to work', () => {
    it('should send valid BOLETA with items and customer name to SUNAT successfully', async () => {
      // Setup: Valid BOLETA invoice with items and customer data
      const validBoleta = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000001',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '12345678',
        customer_name: 'Juan Perez',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        check_id: 'check-001',
        customer: null,
        orders: {
          id: 'order-001',
          items: [
            { line_id: 'line-1', name: 'Product A', qty: 2, unit_price_cents: 5000, sku: 'PROD-A' },
          ],
          checks: [{ check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 2 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validBoleta);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Provider called with valid data
      expect(provider.sendInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: '03', // BOLETA
          razonSocialCliente: expect.any(String), // Customer name resolved
          items: expect.arrayContaining([
            expect.objectContaining({
              descripcion: 'Product A',
              cantidad: 2,
            }),
          ]),
        }),
      );
      
      // Verify customer name was resolved (not empty)
      const callArgs = (provider.sendInvoice as any).mock.calls[0][0];
      expect(callArgs.razonSocialCliente).toBeTruthy();
      expect(callArgs.razonSocialCliente.length).toBeGreaterThan(0);

      // Verify: Success callback executed
      expect(prisma.invoice_cdr.upsert).toHaveBeenCalled();
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('should send valid FACTURA with items and customer name to SUNAT successfully', async () => {
      // Setup: Valid FACTURA invoice with items and customer data
      const validFactura = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'F001',
        invoice_number: '00000001',
        invoice_type: 'FACTURA',
        customer_doc_type: 'RUC',
        customer_doc: '20123456789',
        customer_name: 'Test Company SAC',
        total_cents: 23600,
        created_at: new Date('2026-03-02'),
        check_id: 'check-001',
        customer: null,
        orders: {
          id: 'order-001',
          items: [
            { line_id: 'line-1', name: 'Service A', qty: 1, unit_price_cents: 20000, sku: 'SRV-A' },
          ],
          checks: [{ check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validFactura);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Provider called with valid FACTURA data
      expect(provider.sendInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: '01', // FACTURA
          tipoDocumentoCliente: '6', // RUC
          numeroDocumentoCliente: '20123456789',
          razonSocialCliente: 'Test Company SAC',
          items: expect.arrayContaining([
            expect.objectContaining({
              descripcion: 'Service A',
              cantidad: 1,
            }),
          ]),
        }),
      );

      // Verify: Success callback executed
      expect(prisma.invoice_cdr.upsert).toHaveBeenCalled();
    });
  });

  describe('Req 3.3: BOLETA with anonymous customer ("-") is accepted as valid', () => {
    it('should accept BOLETA with "-" customer name as valid (not treated as empty)', async () => {
      // Setup: BOLETA with anonymous customer (dash is valid for BOLETA)
      const boletaWithDash = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000002',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '-',
        customer_name: null, // Will resolve to '-' for BOLETA
        total_cents: 5900,
        created_at: new Date('2026-03-02'),
        check_id: 'check-002',
        customer: null,
        orders: {
          id: 'order-002',
          customer_id: null,
          items: [
            { line_id: 'line-2', name: 'Product B', qty: 1, unit_price_cents: 5000, sku: 'PROD-B' },
          ],
          checks: [{ check_id: 'check-002', lines: [{ line_id: 'line-2', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(boletaWithDash);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Provider called with '-' customer name (valid for BOLETA)
      expect(provider.sendInvoice).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: '03', // BOLETA
          razonSocialCliente: '-', // Valid for BOLETA (anonymous customer)
          items: expect.arrayContaining([
            expect.objectContaining({
              descripcion: 'Product B',
            }),
          ]),
        }),
      );

      // Verify: Success (not treated as validation error)
      expect(prisma.invoice_cdr.upsert).toHaveBeenCalled();
    });
  });

  describe('Req 3.4: Transient errors trigger retry logic with exponential backoff', () => {
    it('should retry on SUNAT_TIMEOUT error (transient error)', async () => {
      // Setup: Provider returns timeout error (retryable)
      const timeoutProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('SUNAT timeout', 'SUNAT_TIMEOUT')),
        ),
      });
      const timeoutRouter = makeProviderRouter(timeoutProvider);

      const validInvoice = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000003',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '12345678',
        customer_name: 'Test Customer',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        check_id: 'check-003',
        customer: null,
        orders: {
          id: 'order-003',
          items: [
            { line_id: 'line-3', name: 'Product C', qty: 1, unit_price_cents: 10000, sku: 'PROD-C' },
          ],
          checks: [{ check_id: 'check-003', lines: [{ line_id: 'line-3', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validInvoice);
      const worker = new SunatQueueWorker(prisma as any, timeoutRouter);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT', attempts: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Retry scheduled (not final failure)
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'PENDING', // Still pending for retry
            attempts: 1, // Attempt incremented
            last_error: expect.stringContaining('SUNAT timeout'),
          }),
        }),
      );

      // Verify: NOT marked as FAILED (retryable error)
      expect(prisma.invoice_queue.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('should retry on SUNAT_SERVER_ERROR (transient error)', async () => {
      // Setup: Provider returns server error (retryable)
      const serverErrorProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('SUNAT server error', 'SUNAT_SERVER_ERROR')),
        ),
      });
      const serverErrorRouter = makeProviderRouter(serverErrorProvider);

      const validInvoice = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000004',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '87654321',
        customer_name: 'Another Customer',
        total_cents: 5900,
        created_at: new Date('2026-03-02'),
        check_id: 'check-004',
        customer: null,
        orders: {
          id: 'order-004',
          items: [
            { line_id: 'line-4', name: 'Product D', qty: 1, unit_price_cents: 5000, sku: 'PROD-D' },
          ],
          checks: [{ check_id: 'check-004', lines: [{ line_id: 'line-4', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validInvoice);
      const worker = new SunatQueueWorker(prisma as any, serverErrorRouter);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT', attempts: 1 });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Retry scheduled with exponential backoff
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'PENDING',
            attempts: 2,
            scheduled_at: expect.any(Date), // Backoff applied
          }),
        }),
      );
    });
  });

  describe('Req 3.4: Non-retryable errors fail immediately without retries', () => {
    it('should fail immediately on SUNAT_AUTH_FAILED (non-retryable)', async () => {
      // Setup: Provider returns auth failed error (non-retryable)
      const authFailedProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Auth failed', 'SUNAT_AUTH_FAILED')),
        ),
      });
      const authFailedRouter = makeProviderRouter(authFailedProvider);

      const validInvoice = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'F001',
        invoice_number: '00000005',
        invoice_type: 'FACTURA',
        customer_doc_type: 'RUC',
        customer_doc: '20987654321',
        customer_name: 'Company XYZ SAC',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        check_id: 'check-005',
        customer: null,
        orders: {
          id: 'order-005',
          items: [
            { line_id: 'line-5', name: 'Service B', qty: 1, unit_price_cents: 10000, sku: 'SRV-B' },
          ],
          checks: [{ check_id: 'check-005', lines: [{ line_id: 'line-5', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validInvoice);
      const worker = new SunatQueueWorker(prisma as any, authFailedRouter);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT', attempts: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Marked as FAILED immediately (no retry)
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('Auth failed'),
            attempts: 1, // Attempts are incremented even for non-retryable errors
          }),
        }),
      );
    });

    it('should fail immediately on SUNAT_CERT_EXPIRED (non-retryable)', async () => {
      // Setup: Provider returns cert expired error (non-retryable)
      const certExpiredProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Certificate expired', 'SUNAT_CERT_EXPIRED')),
        ),
      });
      const certExpiredRouter = makeProviderRouter(certExpiredProvider);

      const validInvoice = {
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000006',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '11223344',
        customer_name: 'Test User',
        total_cents: 5900,
        created_at: new Date('2026-03-02'),
        check_id: 'check-006',
        customer: null,
        orders: {
          id: 'order-006',
          items: [
            { line_id: 'line-6', name: 'Product E', qty: 1, unit_price_cents: 5000, sku: 'PROD-E' },
          ],
          checks: [{ check_id: 'check-006', lines: [{ line_id: 'line-6', qty: 1 }] }],
          customers: null,
        },
      };

      const prisma = makePrisma(validInvoice);
      const worker = new SunatQueueWorker(prisma as any, certExpiredRouter);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_TO_SUNAT', attempts: 0 });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Marked as FAILED immediately
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({
            status: 'FAILED',
            last_error: expect.stringContaining('Certificate expired'),
          }),
        }),
      );
    });
  });

  describe('Req 3.5: Credit note processing works for valid credit notes', () => {
    it('should send valid credit note with items and customer name to SUNAT successfully', async () => {
      // Setup: Valid credit note with items and customer data
      const validCreditNote = {
        id: crypto.randomUUID(),
        invoice_id: INVOICE_ID,
        series: 'BC01',
        number: '00000001',
        reason: 'Devolucion de productos',
        total_cents: 5900,
        created_at: new Date('2026-03-02'),
        invoices: {
          id: INVOICE_ID,
          series: 'B001',
          invoice_number: '00000007',
          invoice_type: 'BOLETA',
          customer_doc_type: 'DNI',
          customer_doc: '12345678',
          customer_name: 'Customer Name',
          customer: null,
          orders: {
            id: 'order-007',
            items: [
              { line_id: 'line-7', name: 'Product F', qty: 1, unit_price_cents: 5000, sku: 'PROD-F' },
            ],
            checks: [{ check_id: 'check-007', lines: [{ line_id: 'line-7', qty: 1 }] }],
            customers: null,
          },
        },
      };

      const prisma = makePrisma(null, validCreditNote);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_CREDIT_NOTE' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Provider called with valid credit note data
      expect(provider.sendCreditNote).toHaveBeenCalledWith(
        expect.objectContaining({
          serie: 'BC01',
          numero: '00000001',
          motivo: 'Devolucion de productos',
          razonSocialCliente: expect.any(String), // Customer name resolved
          invoiceReference: expect.objectContaining({
            serie: 'B001',
            numero: '00000007',
            tipo: '03', // BOLETA
          }),
          items: expect.arrayContaining([
            expect.objectContaining({
              descripcion: 'Product F',
              cantidad: 1,
            }),
          ]),
        }),
      );
      
      // Verify customer name was resolved (not empty)
      const callArgs = (provider.sendCreditNote as any).mock.calls[0][0];
      expect(callArgs.razonSocialCliente).toBeTruthy();
      expect(callArgs.razonSocialCliente.length).toBeGreaterThan(0);

      // Verify: Success callback executed
      expect(prisma.invoice_cdr.upsert).toHaveBeenCalled();
    });

    it('should send valid FACTURA credit note with items and customer name to SUNAT successfully', async () => {
      // Setup: Valid FACTURA credit note
      const validFacturaCreditNote = {
        id: crypto.randomUUID(),
        invoice_id: INVOICE_ID,
        series: 'FC01',
        number: '00000001',
        reason: 'Anulacion parcial',
        total_cents: 11800,
        created_at: new Date('2026-03-02'),
        invoices: {
          id: INVOICE_ID,
          series: 'F001',
          invoice_number: '00000008',
          invoice_type: 'FACTURA',
          customer_doc_type: 'RUC',
          customer_doc: '20123456789',
          customer_name: 'Business Corp SAC',
          customer: null,
          orders: {
            id: 'order-008',
            items: [
              { line_id: 'line-8', name: 'Service C', qty: 1, unit_price_cents: 10000, sku: 'SRV-C' },
            ],
            checks: [{ check_id: 'check-008', lines: [{ line_id: 'line-8', qty: 1 }] }],
            customers: null,
          },
        },
      };

      const prisma = makePrisma(null, validFacturaCreditNote);
      const worker = new SunatQueueWorker(prisma as any, router);

      // Execute
      const item = makeQueueItem({ action: 'EMIT_CREDIT_NOTE' });
      prisma.$queryRawUnsafe.mockResolvedValue([item]);
      await worker.processBatch(10);

      // Verify: Provider called with valid FACTURA credit note data
      expect(provider.sendCreditNote).toHaveBeenCalledWith(
        expect.objectContaining({
          serie: 'FC01',
          numero: '00000001',
          tipoDocumentoCliente: '6', // RUC
          numeroDocumentoCliente: '20123456789',
          razonSocialCliente: 'Business Corp SAC',
          invoiceReference: expect.objectContaining({
            serie: 'F001',
            numero: '00000008',
            tipo: '01', // FACTURA
          }),
          items: expect.arrayContaining([
            expect.objectContaining({
              descripcion: 'Service C',
            }),
          ]),
        }),
      );

      // Verify: Success
      expect(prisma.invoice_cdr.upsert).toHaveBeenCalled();
    });
  });
});
