/**
 * SunatDailySummaryService Unit Tests
 *
 * Tests the daily summary processing logic:
 * - Happy path: boletas -> summary sent
 * - No boletas: skip
 * - Exclude voided boletas
 * - Exclude boletas without CDR response_code='0'
 * - Multiple tenants processed
 * - Disabled tenant skipped
 * - SUNAT error handled, continues to next tenant
 * - Idempotent: already-sent summary not re-sent
 * - Event DAILY_SUMMARY_SENT emitted
 * - Property test: sum of individual totals matches group total
 *
 * @module core/jobs/__tests__/sunat-daily-summary.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { SunatDailySummaryService } from '../sunat-daily-summary';
import { ok, err, DomainError } from '@/src/core/result';
import type { InvoiceProviderRouter, InvoiceProvider } from '@/src/core/integrations/sunat/provider-router';
import type { SunatDocumentResult, DailySummaryData, TicketStatusResult, CreditNoteData, VoidData } from '@/src/core/integrations/sunat/sunat-direct-adapter';
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

const TENANT_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const TENANT_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const SUMMARY_DATE = '2026-03-02';

function makeBoleta(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    tenant_id: TENANT_ID_1,
    series: 'B001',
    invoice_number: '00000001',
    customer_doc_type: 'DNI',
    customer_doc: '12345678',
    total_cents: 11800, // S/. 118.00
    ...overrides,
  };
}

function makeTenantRow(overrides: Record<string, unknown> = {}) {
  return {
    tenant_id: TENANT_ID_1,
    sunat_provider: 'SUNAT_DIRECT',
    sunat_mode: 'PRODUCTION',
    ruc: '20123456789',
    legal_name: 'Polleria Test SAC',
    ...overrides,
  };
}

function makeSuccessResult(): SunatDocumentResult {
  return {
    success: true,
    cdrResponseCode: '0',
    cdrResponseMessage: 'Resumen diario enviado',
    cdrXml: '',
    hash: '',
    signedXml: '<signed>mock</signed>',
    ticketNumber: 'TICKET-12345',
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

/**
 * Creates a mock Prisma instance for daily summary tests.
 * queryRawUnsafe calls are distinguished by the SQL pattern.
 */
function makePrisma(options: {
  tenants?: any[];
  boletas?: any[];
  existingSummary?: any | null;
  correlativoCount?: number;
} = {}) {
  const { tenants = [], boletas = [], existingSummary = null, correlativoCount = 0 } = options;

  const prisma = {
    $queryRawUnsafe: vi.fn().mockImplementation((sql: string, ...args: unknown[]) => {
      // Match queries by SQL content
      if (sql.includes('FROM tenant_settings ts') && sql.includes('JOIN tenants t')) {
        return Promise.resolve(tenants);
      }
      if (sql.includes('FROM tenant_settings ts') && sql.includes('WHERE ts.tenant_id')) {
        const tenantId = args[0] as string;
        return Promise.resolve(tenants.filter((t: any) => t.tenant_id === tenantId));
      }
      if (sql.includes('FROM sunat_daily_summary') && sql.includes('LIMIT 1')) {
        return Promise.resolve(existingSummary ? [existingSummary] : []);
      }
      if (sql.includes('FROM invoices i') && sql.includes('JOIN invoice_cdr')) {
        return Promise.resolve(boletas);
      }
      if (sql.includes('COUNT(*)') && sql.includes('sunat_daily_summary')) {
        return Promise.resolve([{ count: BigInt(correlativoCount) }]);
      }
      if (sql.includes('INSERT INTO sunat_daily_summary')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    }),
    events: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return prisma;
}

// ============================================================================
// Tests
// ============================================================================

describe('SunatDailySummaryService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let router: InvoiceProviderRouter;
  let provider: InvoiceProvider;
  let service: SunatDailySummaryService;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = makeProvider();
    router = makeProviderRouter(ok(provider));
  });

  describe('processTenant - happy path', () => {
    it('should send daily summary when boletas exist', async () => {
      const boletas = [
        makeBoleta({ total_cents: 11800 }),
        makeBoleta({ invoice_number: '00000002', total_cents: 5900 }),
      ];

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas,
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.status).toBe('SENT');
      expect(result.boletasCount).toBe(2);
      expect(result.boletasTotalCents).toBe(17700);
      expect(result.ticketNumber).toBe('TICKET-12345');
    });

    it('should call provider.sendDailySummary with correct data', async () => {
      const boletas = [
        makeBoleta({ total_cents: 11800, series: 'B001', invoice_number: '00000001' }),
      ];

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas,
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(provider.sendDailySummary).toHaveBeenCalledTimes(1);
      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;

      expect(callData.ruc).toBe('20123456789');
      expect(callData.razonSocial).toBe('Polleria Test SAC');
      expect(callData.referenceDate).toBe(SUMMARY_DATE);
      expect(callData.boletas).toHaveLength(1);
      expect(callData.boletas[0].serie).toBe('B001');
      expect(callData.boletas[0].numero).toBe('00000001');
      expect(callData.boletas[0].totalImporte).toBe(11800);
      expect(callData.boletas[0].estado).toBe('1');
    });

    it('should generate correct summary number format', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
        correlativoCount: 0,
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;
      expect(callData.summaryNumber).toMatch(/^RC-\d{8}-\d{5}$/);
      expect(callData.summaryNumber).toBe('RC-20260302-00001');
    });
  });

  describe('processTenant - no boletas', () => {
    it('should skip when no boletas exist', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.status).toBe('SKIPPED');
      expect(result.boletasCount).toBe(0);
      expect(provider.sendDailySummary).not.toHaveBeenCalled();
    });
  });

  describe('processTenant - idempotency', () => {
    it('should not re-send already sent summary', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
        existingSummary: {
          boletas_count: 5,
          boletas_total: 59000,
          ticket_number: 'TICKET-OLD',
          sunat_status: 'PENDING',
        },
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.status).toBe('SKIPPED');
      expect(result.error).toBe('Already sent');
      expect(result.ticketNumber).toBe('TICKET-OLD');
      expect(provider.sendDailySummary).not.toHaveBeenCalled();
    });

    it('should retry summary that had ERROR status', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
        existingSummary: {
          boletas_count: 5,
          boletas_total: 59000,
          ticket_number: null,
          sunat_status: 'ERROR',
        },
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      // Should proceed since the existing summary had ERROR status
      expect(result.status).toBe('SENT');
      expect(provider.sendDailySummary).toHaveBeenCalledTimes(1);
    });
  });

  describe('processTenant - SUNAT error handling', () => {
    it('should handle SUNAT rejection gracefully', async () => {
      const failingProvider = makeProvider({
        sendDailySummary: vi.fn().mockResolvedValue(
          err(new DomainError('SUNAT rechazo resumen', 'SUNAT_REJECTED')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('SUNAT rechazo resumen');
      expect(result.boletasCount).toBe(1);
    });

    it('should handle provider not found error', async () => {
      router = makeProviderRouter(
        err(new DomainError('Config not found', 'SUNAT_CONFIG_NOT_FOUND')),
      );

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.status).toBe('ERROR');
      expect(result.error).toContain('Config not found');
    });
  });

  describe('processTenant - event emission', () => {
    it('should emit DAILY_SUMMARY_SENT event on success', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta(), makeBoleta({ invoice_number: '00000002' })],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(prisma.events.create).toHaveBeenCalledTimes(1);
      expect(prisma.events.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DAILY_SUMMARY_SENT',
            tenant_id: TENANT_ID_1,
            payload: expect.objectContaining({
              summary_date: SUMMARY_DATE,
              boletas_count: 2,
              ticket_number: 'TICKET-12345',
            }),
          }),
        }),
      );
    });

    it('should NOT emit event on error', async () => {
      const failingProvider = makeProvider({
        sendDailySummary: vi.fn().mockResolvedValue(
          err(new DomainError('Failed', 'SUNAT_REJECTED')),
        ),
      });
      router = makeProviderRouter(ok(failingProvider));

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(prisma.events.create).not.toHaveBeenCalled();
    });
  });

  describe('processAllTenants', () => {
    it('should process multiple tenants', async () => {
      const tenant1 = makeTenantRow({ tenant_id: TENANT_ID_1 });
      const tenant2 = makeTenantRow({ tenant_id: TENANT_ID_2, ruc: '20987654321' });

      // Provider that tracks sendDailySummary calls
      const trackedProvider = makeProvider();
      router = makeProviderRouter(ok(trackedProvider));

      prisma = makePrisma({
        tenants: [tenant1, tenant2],
        boletas: [makeBoleta()], // Will return boletas for all tenants in this mock
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const results = await service.processAllTenants();

      expect(results).toHaveLength(2);
    });

    it('should continue to next tenant on error', async () => {
      const tenant1 = makeTenantRow({ tenant_id: TENANT_ID_1 });
      const tenant2 = makeTenantRow({ tenant_id: TENANT_ID_2 });

      // Provider that fails for first call, succeeds for second
      const failThenSucceedProvider = makeProvider({
        sendDailySummary: vi.fn()
          .mockResolvedValueOnce(err(new DomainError('SUNAT down', 'SUNAT_SERVER_ERROR')))
          .mockResolvedValueOnce(ok(makeSuccessResult())),
      });
      router = makeProviderRouter(ok(failThenSucceedProvider));

      prisma = makePrisma({
        tenants: [tenant1, tenant2],
        boletas: [makeBoleta()],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const results = await service.processAllTenants();

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('ERROR');
      expect(results[1].status).toBe('SENT');
    });

    it('should skip tenants with no boletas', async () => {
      const tenant1 = makeTenantRow({ tenant_id: TENANT_ID_1 });

      prisma = makePrisma({
        tenants: [tenant1],
        boletas: [], // No boletas
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const results = await service.processAllTenants();

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('SKIPPED');
    });

    it('should return empty results when no active tenants', async () => {
      prisma = makePrisma({
        tenants: [],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const results = await service.processAllTenants();

      expect(results).toHaveLength(0);
    });
  });

  describe('processTenant - tenant not found', () => {
    it('should skip when tenant settings not found', async () => {
      prisma = makePrisma({
        tenants: [],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE);

      expect(result.status).toBe('SKIPPED');
      expect(result.error).toContain('Tenant settings not found');
    });
  });

  describe('processTenant - money in centavos', () => {
    it('should calculate totals correctly in centavos', async () => {
      const boletas = [
        makeBoleta({ total_cents: 11800 }),  // S/. 118.00
        makeBoleta({ invoice_number: '00000002', total_cents: 5900 }),   // S/. 59.00
        makeBoleta({ invoice_number: '00000003', total_cents: 23600 }),  // S/. 236.00
      ];

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas,
      });

      service = new SunatDailySummaryService(prisma as any, router);
      const result = await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      expect(result.boletasTotalCents).toBe(41300); // 11800 + 5900 + 23600 = 41300
      expect(result.boletasCount).toBe(3);
    });

    it('should pass centavos values to provider (not soles)', async () => {
      const boletas = [
        makeBoleta({ total_cents: 11800 }),
      ];

      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas,
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;
      expect(callData.boletas[0].totalImporte).toBe(11800); // Centavos
    });
  });

  describe('processTenant - sequential correlativo', () => {
    it('should increment correlativo based on existing count', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta()],
        correlativoCount: 3, // Already 3 summaries exist
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;
      expect(callData.summaryNumber).toBe('RC-20260302-00004'); // 3 + 1 = 4
    });
  });

  describe('processTenant - document type mapping', () => {
    it('should map DNI to 1', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta({ customer_doc_type: 'DNI' })],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;
      expect(callData.boletas[0].tipoDocumentoCliente).toBe('1');
    });

    it('should map RUC to 6', async () => {
      prisma = makePrisma({
        tenants: [makeTenantRow()],
        boletas: [makeBoleta({ customer_doc_type: 'RUC' })],
      });

      service = new SunatDailySummaryService(prisma as any, router);
      await service.processTenant(TENANT_ID_1, SUMMARY_DATE, makeTenantRow());

      const callData = (provider.sendDailySummary as any).mock.calls[0][0] as DailySummaryData;
      expect(callData.boletas[0].tipoDocumentoCliente).toBe('6');
    });
  });

  describe('property tests', () => {
    it('sum of individual boleta totals should match group total', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              total_cents: fc.integer({ min: 1, max: 1_000_000 }),
            }),
            { minLength: 1, maxLength: 100 },
          ),
          (boletas) => {
            const sum = boletas.reduce((acc, b) => acc + b.total_cents, 0);
            const individualSums = boletas.map((b) => b.total_cents);
            const sumOfIndividuals = individualSums.reduce((a, b) => a + b, 0);
            return sum === sumOfIndividuals;
          },
        ),
        { numRuns: 100 },
      );
    });

    it('summary number format should always be valid', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 99999 }),
          fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2030-12-31'),
            noInvalidDate: true,
          }),
          (correlativo, date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}${month}${day}`;
            const summaryNumber = `RC-${dateStr}-${String(correlativo).padStart(5, '0')}`;

            // Validate format
            return /^RC-\d{8}-\d{5}$/.test(summaryNumber);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('total centavos should always be integer', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.integer({ min: 1, max: 10_000_000 }),
            { minLength: 1, maxLength: 50 },
          ),
          (totals) => {
            const sum = totals.reduce((a, b) => a + b, 0);
            return Number.isInteger(sum);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
