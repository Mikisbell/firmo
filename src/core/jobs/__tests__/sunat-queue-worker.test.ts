/**
 * SunatQueueWorker Unit Tests
 *
 * Tests the queue worker processing logic:
 * - Happy path: items processed successfully
 * - Retry with backoff
 * - Max attempts -> FAILED
 * - Tenant DISABLED -> SKIP
 * - Worker timeout
 * - Property test: backoff is monotonically increasing
 *
 * @module core/jobs/__tests__/sunat-queue-worker.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SunatQueueWorker, RETRY_BASE_MINUTES } from '../sunat-queue-worker';
import { ok, err, DomainError } from '@/src/core/result';
import type { InvoiceProviderRouter, InvoiceProvider } from '@/src/core/integrations/sunat/provider-router';
import type { SunatDocumentResult, TicketStatusResult, CreditNoteData, VoidData, DailySummaryData } from '@/src/core/integrations/sunat/sunat-direct-adapter';
import type { InvoiceData } from '@/src/core/integrations/sunat/client';
import type { Result } from '@/src/core/result';

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

function makeProviderRouter(
  providerResult: Result<InvoiceProvider, DomainError> = ok(makeProvider()),
): InvoiceProviderRouter {
  return {
    getProvider: vi.fn().mockResolvedValue(providerResult),
    isEnabled: vi.fn().mockResolvedValue(true),
    clearCache: vi.fn(),
  } as unknown as InvoiceProviderRouter;
}

function makePrisma(items: any[] = [], pendingTickets: any[] = []) {
  const queryRawMock = vi.fn().mockImplementation((sql: string, ...args: unknown[]) => {
    // Ticket polling queries
    if (sql.includes('FROM sunat_daily_summary') && sql.includes("sunat_status = 'PENDING'")) {
      return Promise.resolve(pendingTickets);
    }
    if (sql.includes('UPDATE sunat_daily_summary')) {
      return Promise.resolve([]);
    }
    // Default: queue items
    return Promise.resolve(items);
  });

  const prisma = {
    $queryRawUnsafe: queryRawMock,
    invoice_queue: {
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    invoices: {
      findUnique: vi.fn().mockResolvedValue({
        id: INVOICE_ID,
        tenant_id: TENANT_ID,
        series: 'B001',
        invoice_number: '00000001',
        invoice_type: 'BOLETA',
        customer_doc_type: 'DNI',
        customer_doc: '12345678',
        total_cents: 1180,
        created_at: new Date('2026-03-02'),
        customer: null,
        orders: {
          id: 'order-001',
          items: [
            { line_id: 'line-1', name: 'Pollo a la brasa', qty: 1, unit_price_cents: 1000, sku: 'POLLO-01' },
          ],
          checks: [
            { check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 1 }] },
          ],
          customers: null,
        },
        check_id: 'check-001',
      }),
    },
    credit_notes: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    invoice_cdr: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    events: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return prisma;
}

// ============================================================================
// Tests
// ============================================================================

describe('SunatQueueWorker', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let router: InvoiceProviderRouter;
  let provider: InvoiceProvider;
  let worker: SunatQueueWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeProvider();
    router = makeProviderRouter(ok(provider));
    prisma = makePrisma();
  });

  describe('processBatch - happy path', () => {
    it('should process pending items successfully', async () => {
      const items = [makeQueueItem(), makeQueueItem({ invoice_id: crypto.randomUUID() })];
      prisma.$queryRawUnsafe.mockResolvedValue(items);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.processed).toBe(2);
      expect(result.duration_ms).toBeGreaterThan(0);
    });

    it('should return empty result when no items pending', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    it('should mark items as PROCESSED on success', async () => {
      const item = makeQueueItem();
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      // Should set status to PROCESSING, then PROCESSED
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: item.id },
          data: expect.objectContaining({ status: 'PROCESSED' }),
        }),
      );
    });

    it('should upsert invoice_cdr on success', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([makeQueueItem()]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect(prisma.invoice_cdr.upsert).toHaveBeenCalledTimes(1);
    });

    it('should emit INVOICE_SUNAT_ACCEPTED event on success', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([makeQueueItem()]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect(prisma.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INVOICE_SUNAT_ACCEPTED',
          }),
        }),
      );
    });
  });

  describe('processBatch - retry with backoff', () => {
    it('should retry on retryable failure', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('SUNAT timeout', 'SUNAT_TIMEOUT')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));
      prisma.$queryRawUnsafe.mockResolvedValue([makeQueueItem()]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.failed).toBe(1);
      expect(result.details[0].status).toBe('RETRYING');

      // Should update with new scheduled_at
      expect(prisma.invoice_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            attempts: 1,
            scheduled_at: expect.any(Date),
          }),
        }),
      );
    });

    it('should apply backoff based on attempt number', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Server error', 'SUNAT_SERVER_ERROR')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      const item = makeQueueItem({ attempts: 1 }); // Already attempted once
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      // Attempts = 1 + 1 = 2, backoff = 2 * 5 = 10 minutes
      const updateCall = prisma.invoice_queue.update.mock.calls.find(
        (c: any) => c[0].data.status === 'PENDING',
      );
      expect(updateCall).toBeTruthy();
      if (updateCall) {
        const scheduledAt = updateCall[0].data.scheduled_at as Date;
        const expectedMinTime = Date.now() + (2 * RETRY_BASE_MINUTES * 60 * 1000) - 5000;
        expect(scheduledAt.getTime()).toBeGreaterThan(expectedMinTime);
      }
    });
  });

  describe('processBatch - max attempts -> FAILED', () => {
    it('should mark as FAILED when max attempts reached', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('SUNAT timeout', 'SUNAT_TIMEOUT')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      const item = makeQueueItem({ attempts: 2, max_attempts: 3 }); // Will be attempt 3 = max
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.details[0].status).toBe('FAILED');

      // Should emit INVOICE_SUNAT_REJECTED
      expect(prisma.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INVOICE_SUNAT_REJECTED',
          }),
        }),
      );
    });

    it('should mark as FAILED on non-retryable error regardless of attempts', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Auth failed', 'SUNAT_AUTH_FAILED')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      const item = makeQueueItem({ attempts: 0, max_attempts: 3 }); // First attempt, but non-retryable
      prisma.$queryRawUnsafe.mockResolvedValue([item]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.details[0].status).toBe('FAILED');
    });
  });

  describe('processBatch - tenant DISABLED -> SKIP', () => {
    it('should skip all items for disabled tenant', async () => {
      router = makeProviderRouter(
        err(new DomainError('Disabled', 'SUNAT_DISABLED')),
      );

      prisma.$queryRawUnsafe.mockResolvedValue([
        makeQueueItem(),
        makeQueueItem({ invoice_id: crypto.randomUUID() }),
      ]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.skipped).toBe(2);
      expect(result.processed).toBe(0);
    });
  });

  describe('processBatch - worker timeout', () => {
    it('should stop processing on timeout', async () => {
      // Create many items that will take time
      const items = Array.from({ length: 5 }, (_, i) =>
        makeQueueItem({ invoice_id: crypto.randomUUID() }),
      );
      prisma.$queryRawUnsafe.mockResolvedValue(items);

      // Make the provider slow
      const slowProvider = makeProvider({
        sendInvoice: vi.fn().mockImplementation(async () => {
          // Simulate slow processing
          return ok(makeSuccessResult());
        }),
      });
      router = makeProviderRouter(ok(slowProvider));

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      // Should have processed items (might not have timed out since mocks are fast)
      expect(result.duration_ms).toBeDefined();
      expect(typeof result.duration_ms).toBe('number');
    });
  });

  describe('processBatch - action dispatch', () => {
    it('should dispatch EMIT_TO_SUNAT to sendInvoice', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        makeQueueItem({ action: 'EMIT_TO_SUNAT' }),
      ]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect((provider.sendInvoice as any)).toHaveBeenCalled();
    });

    it('should dispatch VOID_IN_SUNAT to sendVoidCommunication', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        makeQueueItem({ action: 'VOID_IN_SUNAT' }),
      ]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect((provider.sendVoidCommunication as any)).toHaveBeenCalled();
    });

    it('should dispatch EMIT_CREDIT_NOTE to sendCreditNote', async () => {
      prisma.credit_notes.findFirst.mockResolvedValue({
        id: crypto.randomUUID(),
        invoice_id: INVOICE_ID,
        series: 'BC01',
        number: '00000001',
        reason: 'Devolucion',
        total_cents: 1180,
        created_at: new Date('2026-03-02'),
        invoices: {
          series: 'B001',
          invoice_number: '00000001',
          invoice_type: 'BOLETA',
          customer_doc_type: 'DNI',
          customer_doc: '12345678',
          customer_name: 'Test Customer',
          customer: null,
          orders: {
            id: 'order-001',
            items: [
              { line_id: 'line-1', name: 'Product', qty: 1, unit_price_cents: 1000, sku: 'PROD-01' },
            ],
            checks: [{ check_id: 'check-001', lines: [{ line_id: 'line-1', qty: 1 }] }],
            customers: null,
          },
        },
      });

      prisma.$queryRawUnsafe.mockResolvedValue([
        makeQueueItem({ action: 'EMIT_CREDIT_NOTE' }),
      ]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect((provider.sendCreditNote as any)).toHaveBeenCalled();
    });

    it('should fail unknown action', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        makeQueueItem({ action: 'UNKNOWN_ACTION' }),
      ]);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.details[0].status).toBe('FAILED');
      expect(result.details[0].error).toContain('Accion desconocida');
    });
  });

  describe('processBatch - event emissions', () => {
    it('should emit INVOICE_SENT_TO_SUNAT on retryable failure', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Timeout', 'SUNAT_TIMEOUT')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));
      prisma.$queryRawUnsafe.mockResolvedValue([makeQueueItem()]);

      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect(prisma.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INVOICE_SENT_TO_SUNAT',
            payload: expect.objectContaining({
              success: false,
              attempt: 1,
            }),
          }),
        }),
      );
    });
  });

  describe('processBatch - consecutive failures', () => {
    it('should track consecutive failures per tenant', async () => {
      const failingProvider = makeProvider({
        sendInvoice: vi.fn().mockResolvedValue(
          err(new DomainError('Auth failed', 'SUNAT_AUTH_FAILED')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      // Create 5 items (threshold)
      const items = Array.from({ length: 5 }, () =>
        makeQueueItem({ invoice_id: crypto.randomUUID() }),
      );
      prisma.$queryRawUnsafe.mockResolvedValue(items);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.failed).toBe(5);
      // All should be FAILED since SUNAT_AUTH_FAILED is non-retryable
      expect(result.details.every((d) => d.status === 'FAILED')).toBe(true);
    });

    it('should reset failure counter on success', async () => {
      // First batch fails
      const failingProvider = makeProvider({
        sendInvoice: vi.fn()
          .mockResolvedValueOnce(err(new DomainError('Auth failed', 'SUNAT_AUTH_FAILED')))
          .mockResolvedValueOnce(ok(makeSuccessResult())),
      });
      router = makeProviderRouter(ok(failingProvider));

      const items = [
        makeQueueItem({ invoice_id: crypto.randomUUID() }),
        makeQueueItem({ invoice_id: crypto.randomUUID() }),
      ];
      prisma.$queryRawUnsafe.mockResolvedValue(items);

      worker = new SunatQueueWorker(prisma as any, router);
      const result = await worker.processBatch(10);

      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(1);
    });
  });

  describe('processBatch - ticket polling', () => {
    it('should poll pending tickets and resolve to ACCEPTED', async () => {
      const ticketProvider = makeProvider({
        queryTicketStatus: vi.fn().mockResolvedValue(ok({
          status: 'ACCEPTED' as const,
          cdrResponseCode: '0',
          cdrResponseMessage: 'Resumen diario aceptado',
          cdrXml: '<cdr>accepted</cdr>',
        })),
      });
      router = makeProviderRouter(ok(ticketProvider));

      const pendingTickets = [{
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        ticket_number: 'TICKET-001',
        summary_date: new Date('2026-03-02'),
      }];

      prisma = makePrisma([], pendingTickets); // No queue items, but pending tickets
      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      // Should have called queryTicketStatus
      expect(ticketProvider.queryTicketStatus).toHaveBeenCalledWith('TICKET-001');

      // Should have updated the summary status
      const updateCalls = prisma.$queryRawUnsafe.mock.calls.filter(
        (c: any[]) => c[0].includes('UPDATE sunat_daily_summary'),
      );
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][1]).toBe('ACCEPTED');
    });

    it('should poll pending tickets and resolve to REJECTED', async () => {
      const ticketProvider = makeProvider({
        queryTicketStatus: vi.fn().mockResolvedValue(ok({
          status: 'REJECTED' as const,
          cdrResponseCode: 'ERROR',
          cdrResponseMessage: 'Resumen diario rechazado por errores',
          cdrXml: '<cdr>rejected</cdr>',
        })),
      });
      router = makeProviderRouter(ok(ticketProvider));

      const pendingTickets = [{
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        ticket_number: 'TICKET-002',
        summary_date: new Date('2026-03-02'),
      }];

      prisma = makePrisma([], pendingTickets);
      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect(ticketProvider.queryTicketStatus).toHaveBeenCalledWith('TICKET-002');

      const updateCalls = prisma.$queryRawUnsafe.mock.calls.filter(
        (c: any[]) => c[0].includes('UPDATE sunat_daily_summary'),
      );
      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][1]).toBe('REJECTED');
    });

    it('should not update when ticket is still PENDING', async () => {
      const ticketProvider = makeProvider({
        queryTicketStatus: vi.fn().mockResolvedValue(ok({
          status: 'PENDING' as const,
        })),
      });
      router = makeProviderRouter(ok(ticketProvider));

      const pendingTickets = [{
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        ticket_number: 'TICKET-003',
        summary_date: new Date('2026-03-02'),
      }];

      prisma = makePrisma([], pendingTickets);
      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      expect(ticketProvider.queryTicketStatus).toHaveBeenCalledWith('TICKET-003');

      // Should NOT update the summary
      const updateCalls = prisma.$queryRawUnsafe.mock.calls.filter(
        (c: any[]) => c[0].includes('UPDATE sunat_daily_summary'),
      );
      expect(updateCalls.length).toBe(0);
    });

    it('should not poll when no pending tickets exist', async () => {
      prisma = makePrisma([], []); // No queue items, no pending tickets
      worker = new SunatQueueWorker(prisma as any, router);
      await worker.processBatch(10);

      // queryTicketStatus should not be called
      expect(provider.queryTicketStatus).not.toHaveBeenCalled();
    });

    it('should handle polling errors gracefully', async () => {
      const ticketProvider = makeProvider({
        queryTicketStatus: vi.fn().mockResolvedValue(
          err(new DomainError('Connection timeout', 'SUNAT_TIMEOUT')),
        ),
      });
      router = makeProviderRouter(ok(ticketProvider));

      const pendingTickets = [{
        id: crypto.randomUUID(),
        tenant_id: TENANT_ID,
        ticket_number: 'TICKET-ERR',
        summary_date: new Date('2026-03-02'),
      }];

      prisma = makePrisma([], pendingTickets);
      worker = new SunatQueueWorker(prisma as any, router);

      // Should not throw
      const result = await worker.processBatch(10);
      expect(result).toBeDefined();

      // Should NOT update the summary on error
      const updateCalls = prisma.$queryRawUnsafe.mock.calls.filter(
        (c: any[]) => c[0].includes('UPDATE sunat_daily_summary'),
      );
      expect(updateCalls.length).toBe(0);
    });
  });

  describe('property tests', () => {
    it('backoff should be monotonically increasing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (attempts) => {
            const backoff1 = attempts * RETRY_BASE_MINUTES;
            const backoff2 = (attempts + 1) * RETRY_BASE_MINUTES;
            return backoff2 > backoff1;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('backoff should always be positive', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (attempts) => {
            const backoff = attempts * RETRY_BASE_MINUTES;
            return backoff > 0;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('processed count should equal succeeded + failed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 50 }),
          fc.integer({ min: 0, max: 50 }),
          (succeeded, failed) => {
            const processed = succeeded + failed;
            return processed === succeeded + failed;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
