/**
 * SUNAT Daily Summary Service (Resumen Diario de Boletas)
 *
 * Generates and sends daily summaries (RC - Resumen Diario) of boletas
 * to SUNAT via the configured provider. SUNAT requires boletas to be
 * reported in daily summaries within 7 days of issuance.
 *
 * Flow per tenant:
 * 1. Determine summaryDate = yesterday (Lima timezone, UTC-5)
 * 2. Check idempotency (skip if already sent)
 * 3. Query accepted boletas for the date
 * 4. Group by series, calculate totals
 * 5. Send summary via provider
 * 6. Store result + emit event
 *
 * Called daily at 6:00 AM Lima (11:00 UTC) via /api/cron/sunat-daily-summary.
 *
 * @module core/jobs/sunat-daily-summary
 */

import type { PrismaClient } from '@prisma/client';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import type { InvoiceProviderRouter } from '@/src/core/integrations/sunat/provider-router';
import type { DailySummaryData } from '@/src/core/integrations/sunat/sunat-direct-adapter';

// ============================================================================
// Types
// ============================================================================

export interface DailySummaryResult {
  tenantId: string;
  summaryDate: string;
  boletasCount: number;
  boletasTotalCents: number;
  ticketNumber?: string;
  status: 'SENT' | 'SKIPPED' | 'ERROR';
  error?: string;
}

interface BoletaRow {
  id: string;
  tenant_id: string;
  series: string | null;
  invoice_number: string | null;
  customer_doc_type: string | null;
  customer_doc: string | null;
  total_cents: number;
}

interface TenantRow {
  tenant_id: string;
  sunat_provider: string;
  sunat_mode: string;
  ruc: string | null;
  legal_name: string;
}

// ============================================================================
// SunatDailySummaryService
// ============================================================================

export class SunatDailySummaryService {
  private prisma: PrismaClient;
  private providerRouter: InvoiceProviderRouter;
  private logger;

  constructor(prisma: PrismaClient, providerRouter: InvoiceProviderRouter) {
    this.prisma = prisma;
    this.providerRouter = providerRouter;
    this.logger = pinoLogger.child
      ? pinoLogger.child({ module: 'sunat-daily-summary' })
      : pinoLogger;
  }

  /**
   * Process daily summaries for all active tenants.
   * Returns results for each tenant processed.
   */
  async processAllTenants(): Promise<DailySummaryResult[]> {
    const summaryDate = this.getYesterdayLima();
    const results: DailySummaryResult[] = [];

    this.logger.info({ summaryDate }, 'Starting daily summary processing');

    try {
      // Query active tenants with SUNAT enabled
      const tenants = await this.getActiveTenants();

      if (tenants.length === 0) {
        this.logger.info({}, 'No active tenants with SUNAT enabled');
        return results;
      }

      this.logger.info(
        { tenantCount: tenants.length, summaryDate },
        'Processing daily summaries for tenants',
      );

      for (const tenant of tenants) {
        try {
          const result = await this.processTenant(tenant.tenant_id, summaryDate, tenant);
          results.push(result);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(
            { tenantId: tenant.tenant_id, error: errorMessage },
            'Unexpected error processing tenant daily summary',
          );
          results.push({
            tenantId: tenant.tenant_id,
            summaryDate,
            boletasCount: 0,
            boletasTotalCents: 0,
            status: 'ERROR',
            error: errorMessage,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to process daily summaries',
      );
    }

    this.logger.info(
      {
        total: results.length,
        sent: results.filter((r) => r.status === 'SENT').length,
        skipped: results.filter((r) => r.status === 'SKIPPED').length,
        errors: results.filter((r) => r.status === 'ERROR').length,
      },
      'Daily summary processing complete',
    );

    return results;
  }

  /**
   * Process daily summary for a specific tenant.
   */
  async processTenant(
    tenantId: string,
    summaryDate: string,
    tenantInfo?: TenantRow,
  ): Promise<DailySummaryResult> {
    const ctx = { tenantId, summaryDate };
    this.logger.info(ctx, 'Processing daily summary for tenant');

    // 1. Load tenant info if not provided
    const tenant = tenantInfo ?? (await this.getTenantInfo(tenantId));
    if (!tenant) {
      return {
        tenantId,
        summaryDate,
        boletasCount: 0,
        boletasTotalCents: 0,
        status: 'SKIPPED',
        error: 'Tenant settings not found',
      };
    }

    // 2. Check idempotency: has summary already been sent for this date?
    const existingSummary = await this.findExistingSummary(tenantId, summaryDate);
    if (existingSummary && existingSummary.sunat_status !== 'ERROR') {
      this.logger.info(ctx, 'Daily summary already sent for this date');
      return {
        tenantId,
        summaryDate,
        boletasCount: existingSummary.boletas_count,
        boletasTotalCents: existingSummary.boletas_total,
        ticketNumber: existingSummary.ticket_number ?? undefined,
        status: 'SKIPPED',
        error: 'Already sent',
      };
    }

    // 3. Query accepted boletas for the date
    const boletas = await this.getAcceptedBoletas(tenantId, summaryDate);

    if (boletas.length === 0) {
      this.logger.info(ctx, 'No accepted boletas for summary date, skipping');
      return {
        tenantId,
        summaryDate,
        boletasCount: 0,
        boletasTotalCents: 0,
        status: 'SKIPPED',
      };
    }

    // 4. Calculate totals
    const totalCents = boletas.reduce((sum, b) => sum + b.total_cents, 0);

    // 5. Generate summary number: RC-YYYYMMDD-NNNNN
    const correlativo = await this.getNextCorrelativo(tenantId, summaryDate);
    const summaryNumber = `RC-${summaryDate.replace(/-/g, '')}-${String(correlativo).padStart(5, '0')}`;

    // 6. Get provider
    const providerResult = await this.providerRouter.getProvider(tenantId);
    if (!providerResult.success) {
      const errorMsg = providerResult.error.message;
      this.logger.error({ ...ctx, error: errorMsg }, 'Failed to get provider');

      await this.upsertSummary(tenantId, summaryDate, summaryNumber, {
        boletasCount: boletas.length,
        boletasTotalCents: totalCents,
        status: 'ERROR',
        error: errorMsg,
      });

      return {
        tenantId,
        summaryDate,
        boletasCount: boletas.length,
        boletasTotalCents: totalCents,
        status: 'ERROR',
        error: errorMsg,
      };
    }

    // 7. Build DailySummaryData
    const summaryData: DailySummaryData = {
      summaryNumber,
      summaryDate: this.getTodayLima(), // Summary date is today (when we send)
      referenceDate: summaryDate,        // Reference date is yesterday (when boletas were issued)
      ruc: tenant.ruc ?? '',
      razonSocial: tenant.legal_name,
      boletas: boletas.map((b) => ({
        serie: b.series ?? '',
        numero: b.invoice_number ?? '',
        tipoDocumentoCliente: this.mapDocType(b.customer_doc_type),
        numeroDocumentoCliente: b.customer_doc ?? '',
        totalGravadas: Math.round(b.total_cents / 1.18),
        totalIgv: b.total_cents - Math.round(b.total_cents / 1.18),
        totalImporte: b.total_cents,
        estado: '1' as const, // 1 = Adicionar (add)
      })),
    };

    // 8. Send via provider
    const sendResult = await providerResult.data.sendDailySummary(summaryData);

    if (!sendResult.success) {
      const errorMsg = sendResult.error.message;
      this.logger.error({ ...ctx, error: errorMsg }, 'SUNAT rejected daily summary');

      await this.upsertSummary(tenantId, summaryDate, summaryNumber, {
        boletasCount: boletas.length,
        boletasTotalCents: totalCents,
        status: 'ERROR',
        error: errorMsg,
      });

      return {
        tenantId,
        summaryDate,
        boletasCount: boletas.length,
        boletasTotalCents: totalCents,
        status: 'ERROR',
        error: errorMsg,
      };
    }

    // 9. Success: store result
    const ticketNumber = sendResult.data.ticketNumber;

    await this.upsertSummary(tenantId, summaryDate, summaryNumber, {
      boletasCount: boletas.length,
      boletasTotalCents: totalCents,
      status: 'PENDING', // Pending until ticket is resolved
      ticketNumber,
    });

    // 10. Emit DAILY_SUMMARY_SENT event
    await this.emitEvent(tenantId, summaryDate, boletas.length, ticketNumber);

    this.logger.info(
      { ...ctx, boletasCount: boletas.length, ticketNumber },
      'Daily summary sent successfully',
    );

    return {
      tenantId,
      summaryDate,
      boletasCount: boletas.length,
      boletasTotalCents: totalCents,
      ticketNumber,
      status: 'SENT',
    };
  }

  // ============================================================================
  // Private: Database Queries
  // ============================================================================

  /**
   * Get active tenants with SUNAT enabled (not DISABLED, not NONE).
   */
  private async getActiveTenants(): Promise<TenantRow[]> {
    const tenants = await this.prisma.$queryRawUnsafe<TenantRow[]>(
      `SELECT ts.tenant_id, ts.sunat_provider, ts.sunat_mode, ts.ruc, ts.legal_name
       FROM tenant_settings ts
       JOIN tenants t ON t.id = ts.tenant_id
       WHERE t.is_active = true
         AND ts.sunat_mode IS NOT NULL
         AND ts.sunat_mode != 'DISABLED'
         AND ts.sunat_provider IS NOT NULL
         AND ts.sunat_provider != 'NONE'`,
    );
    return tenants;
  }

  /**
   * Get tenant info by ID.
   */
  private async getTenantInfo(tenantId: string): Promise<TenantRow | null> {
    const rows = await this.prisma.$queryRawUnsafe<TenantRow[]>(
      `SELECT ts.tenant_id, ts.sunat_provider, ts.sunat_mode, ts.ruc, ts.legal_name
       FROM tenant_settings ts
       WHERE ts.tenant_id = $1`,
      tenantId,
    );
    return rows[0] ?? null;
  }

  /**
   * Find existing daily summary for tenant + date.
   */
  private async findExistingSummary(
    tenantId: string,
    summaryDate: string,
  ): Promise<{ boletas_count: number; boletas_total: number; ticket_number: string | null; sunat_status: string } | null> {
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{ boletas_count: number; boletas_total: number; ticket_number: string | null; sunat_status: string }>
    >(
      `SELECT boletas_count, boletas_total, ticket_number, sunat_status
       FROM sunat_daily_summary
       WHERE tenant_id = $1
         AND summary_date = $2::date
       LIMIT 1`,
      tenantId,
      summaryDate,
    );
    return rows[0] ?? null;
  }

  /**
   * Get accepted boletas for a specific date in Lima timezone.
   * Only includes boletas with CDR response_code='0' and not VOIDED.
   */
  private async getAcceptedBoletas(
    tenantId: string,
    summaryDate: string,
  ): Promise<BoletaRow[]> {
    const boletas = await this.prisma.$queryRawUnsafe<BoletaRow[]>(
      `SELECT i.id, i.tenant_id, i.series, i.invoice_number,
              i.customer_doc_type, i.customer_doc, i.total_cents
       FROM invoices i
       JOIN invoice_cdr cdr ON cdr.invoice_id = i.id AND cdr.tenant_id = i.tenant_id
       WHERE i.tenant_id = $1
         AND i.invoice_type = 'BOLETA'
         AND i.status != 'VOIDED'
         AND cdr.response_code = '0'
         AND DATE(i.created_at AT TIME ZONE 'America/Lima') = $2::date
       ORDER BY i.series, i.invoice_number`,
      tenantId,
      summaryDate,
    );
    return boletas;
  }

  /**
   * Get next correlativo for daily summary number.
   */
  private async getNextCorrelativo(
    tenantId: string,
    summaryDate: string,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count
       FROM sunat_daily_summary
       WHERE tenant_id = $1
         AND summary_date = $2::date`,
      tenantId,
      summaryDate,
    );
    return Number(rows[0]?.count ?? 0) + 1;
  }

  /**
   * Upsert daily summary record.
   */
  private async upsertSummary(
    tenantId: string,
    summaryDate: string,
    summaryNumber: string,
    data: {
      boletasCount: number;
      boletasTotalCents: number;
      status: string;
      ticketNumber?: string;
      error?: string;
    },
  ): Promise<void> {
    try {
      // Use raw SQL for upsert since the unique key includes location_id
      // We use a default location_id for the tenant
      const summaryId = crypto.randomUUID();

      await this.prisma.$queryRawUnsafe(
        `INSERT INTO sunat_daily_summary (
           id, tenant_id, location_id, summary_date, summary_number,
           boletas_count, boletas_total, ticket_number, sunat_status,
           last_error, attempts, created_at
         ) VALUES (
           $1::uuid, $2::uuid, $2::uuid, $3::date, $4,
           $5, $6, $7, $8,
           $9, 1, NOW()
         )
         ON CONFLICT (tenant_id, location_id, summary_date)
         DO UPDATE SET
           summary_number = EXCLUDED.summary_number,
           boletas_count = EXCLUDED.boletas_count,
           boletas_total = EXCLUDED.boletas_total,
           ticket_number = COALESCE(EXCLUDED.ticket_number, sunat_daily_summary.ticket_number),
           sunat_status = EXCLUDED.sunat_status,
           last_error = EXCLUDED.last_error,
           attempts = sunat_daily_summary.attempts + 1`,
        summaryId,
        tenantId,
        summaryDate,
        summaryNumber,
        data.boletasCount,
        data.boletasTotalCents,
        data.ticketNumber ?? null,
        data.status,
        data.error ?? null,
      );
    } catch (error) {
      this.logger.error(
        { tenantId, summaryDate, error: (error as Error).message },
        'Failed to upsert daily summary',
      );
    }
  }

  /**
   * Emit DAILY_SUMMARY_SENT event.
   */
  private async emitEvent(
    tenantId: string,
    summaryDate: string,
    boletasCount: number,
    ticketNumber?: string,
  ): Promise<void> {
    try {
      await (this.prisma as any).events.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          terminal_id: 'SYSTEM',
          entity_type: 'INVOICE',
          entity_id: tenantId, // Use tenant as entity since summary is tenant-level
          type: 'DAILY_SUMMARY_SENT',
          payload: {
            summary_id: crypto.randomUUID(),
            tenant_id: tenantId,
            summary_date: summaryDate,
            boletas_count: boletasCount,
            ticket_number: ticketNumber,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        { tenantId, error: (error as Error).message },
        'Failed to emit DAILY_SUMMARY_SENT event',
      );
    }
  }

  // ============================================================================
  // Private: Helpers
  // ============================================================================

  /**
   * Get yesterday's date in Lima timezone (UTC-5).
   * Format: YYYY-MM-DD
   */
  private getYesterdayLima(): string {
    const now = new Date();
    // Convert to Lima time (UTC-5)
    const limaOffset = -5 * 60; // minutes
    const limaTime = new Date(now.getTime() + (limaOffset + now.getTimezoneOffset()) * 60 * 1000);
    // Subtract one day
    limaTime.setDate(limaTime.getDate() - 1);
    return this.formatDate(limaTime);
  }

  /**
   * Get today's date in Lima timezone.
   * Format: YYYY-MM-DD
   */
  private getTodayLima(): string {
    const now = new Date();
    const limaOffset = -5 * 60;
    const limaTime = new Date(now.getTime() + (limaOffset + now.getTimezoneOffset()) * 60 * 1000);
    return this.formatDate(limaTime);
  }

  /**
   * Format a Date as YYYY-MM-DD.
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Map customer document type to SUNAT code.
   * DNI = '1', RUC = '6', etc.
   */
  private mapDocType(docType: string | null): string {
    switch (docType) {
      case 'RUC':
        return '6';
      case 'DNI':
        return '1';
      case 'CE':
        return '4';
      case 'PASAPORTE':
        return '7';
      default:
        return '1'; // Default to DNI
    }
  }
}
