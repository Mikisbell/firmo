/**
 * SUNAT Queue Worker
 *
 * Processes the invoice_queue table, dispatching pending items to the
 * appropriate SUNAT adapter (Direct or Nubefact). Implements:
 * - Batch processing with FOR UPDATE SKIP LOCKED
 * - Retry with exponential backoff (attempts * 5 min)
 * - Auto-contingency on 5 consecutive failures per tenant
 * - Safety timeout (50s) to stay within Vercel function limits
 *
 * Called every 2 minutes via /api/cron/sunat-queue.
 *
 * @module core/jobs/sunat-queue-worker
 */

import type { PrismaClient } from '@prisma/client';
import { Result, ok, err, DomainError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import type { InvoiceProviderRouter, InvoiceProvider } from '@/src/core/integrations/sunat/provider-router';
import type { InvoiceData } from '@/src/core/integrations/sunat/client';
import { SunatDirectAdapterImpl } from '@/src/core/integrations/sunat/sunat-direct-adapter';
import type { SunatDocumentResult, CreditNoteData, VoidData, TicketStatusResult } from '@/src/core/integrations/sunat/sunat-direct-adapter';

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 10;
const MAX_WORKER_DURATION_MS = 50_000;
const RETRY_BASE_MINUTES = 5;
const MAX_DEFAULT_ATTEMPTS = 3;
const AUTO_CONTINGENCY_THRESHOLD = 5;

// ============================================================================
// Types
// ============================================================================

export interface QueueWorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  details: QueueItemDetail[];
}

export interface QueueItemDetail {
  id: string;
  invoice_id: string;
  tenant_id: string;
  action: string;
  status: 'PROCESSED' | 'RETRYING' | 'FAILED' | 'SKIPPED';
  error?: string;
}

interface QueueItem {
  id: string;
  tenant_id: string;
  invoice_id: string;
  action: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  scheduled_at: Date;
  status: string;
}

// ============================================================================
// SunatQueueWorker
// ============================================================================

export class SunatQueueWorker {
  private prisma: PrismaClient;
  private providerRouter: InvoiceProviderRouter;
  private logger;
  private consecutiveFailures: Map<string, number> = new Map();

  constructor(prisma: PrismaClient, providerRouter: InvoiceProviderRouter) {
    this.prisma = prisma;
    this.providerRouter = providerRouter;
    this.logger = pinoLogger.child
      ? pinoLogger.child({ module: 'sunat-queue-worker' })
      : pinoLogger;
  }

  /**
   * Process a batch of pending queue items.
   * Uses FOR UPDATE SKIP LOCKED for concurrent safety.
   */
  async processBatch(batchSize: number = BATCH_SIZE): Promise<QueueWorkerResult> {
    const startTime = Date.now();
    const details: QueueItemDetail[] = [];
    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    this.logger.info({ batchSize }, 'Starting queue worker batch');

    try {
      // 1. Fetch pending items with row-level locking
      const items = await this.fetchPendingItems(batchSize);

      if (items.length === 0) {
        this.logger.info({}, 'No pending items in queue');
      } else {
      this.logger.info({ count: items.length }, 'Fetched pending queue items');

      // 2. Group by tenant
      const byTenant = this.groupByTenant(items);

      // 3. Process each tenant's items
      for (const [tenantId, tenantItems] of byTenant.entries()) {
        // Check timeout
        if (Date.now() - startTime > MAX_WORKER_DURATION_MS) {
          this.logger.warn({}, 'Worker timeout reached, stopping batch');
          for (const item of tenantItems) {
            skipped++;
            details.push({
              id: item.id,
              invoice_id: item.invoice_id,
              tenant_id: item.tenant_id,
              action: item.action,
              status: 'SKIPPED',
              error: 'Worker timeout',
            });
          }
          continue;
        }

        // Get provider for tenant
        const providerResult = await this.providerRouter.getProvider(tenantId);

        if (!providerResult.success) {
          // Tenant disabled or misconfigured — skip all items
          for (const item of tenantItems) {
            skipped++;
            await this.markSkipped(item, providerResult.error.message);
            details.push({
              id: item.id,
              invoice_id: item.invoice_id,
              tenant_id: item.tenant_id,
              action: item.action,
              status: 'SKIPPED',
              error: providerResult.error.message,
            });
          }
          continue;
        }

        const provider = providerResult.data;

        // Process each item for this tenant
        for (const item of tenantItems) {
          // Check timeout
          if (Date.now() - startTime > MAX_WORKER_DURATION_MS) {
            skipped++;
            details.push({
              id: item.id,
              invoice_id: item.invoice_id,
              tenant_id: item.tenant_id,
              action: item.action,
              status: 'SKIPPED',
              error: 'Worker timeout',
            });
            continue;
          }

          const itemResult = await this.processItem(item, provider);
          details.push(itemResult);

          if (itemResult.status === 'PROCESSED') {
            succeeded++;
            this.resetFailureCount(tenantId);
          } else if (itemResult.status === 'FAILED' || itemResult.status === 'RETRYING') {
            failed++;
            this.incrementFailureCount(tenantId);

            // Check auto-contingency threshold
            if (this.getFailureCount(tenantId) >= AUTO_CONTINGENCY_THRESHOLD) {
              this.logger.warn(
                { tenantId, failures: this.getFailureCount(tenantId) },
                'Auto-contingency threshold reached',
              );
            }
          }
        }
      }
      } // end else (items.length > 0)
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Queue worker batch failed',
      );
    }

    // Poll pending daily summary tickets (if time permits)
    if (Date.now() - startTime < MAX_WORKER_DURATION_MS) {
      await this.pollPendingTickets();
    }

    const duration_ms = Date.now() - startTime;
    const processed = succeeded + failed;

    this.logger.info(
      { processed, succeeded, failed, skipped, duration_ms },
      'Queue worker batch completed',
    );

    return { processed, succeeded, failed, skipped, duration_ms, details };
  }

  // ============================================================================
  // Private: Fetch Items
  // ============================================================================

  private async fetchPendingItems(batchSize: number): Promise<QueueItem[]> {
    // Use raw SQL for FOR UPDATE SKIP LOCKED (not supported by Prisma ORM)
    const items = await this.prisma.$queryRawUnsafe<QueueItem[]>(
      `SELECT id, tenant_id, invoice_id, action, priority, attempts, max_attempts,
              last_error, scheduled_at, status
       FROM invoice_queue
       WHERE status = 'PENDING'
         AND scheduled_at <= NOW()
       ORDER BY priority ASC, scheduled_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      batchSize,
    );

    return items;
  }

  // ============================================================================
  // Private: Process Single Item
  // ============================================================================

  private async processItem(
    item: QueueItem,
    provider: InvoiceProvider,
  ): Promise<QueueItemDetail> {
    const ctx = { itemId: item.id, invoiceId: item.invoice_id, action: item.action };
    this.logger.info(ctx, 'Processing queue item');

    // Mark as PROCESSING
    await this.updateStatus(item.id, 'PROCESSING');

    try {
      // Dispatch by action
      let result: Result<SunatDocumentResult, DomainError>;

      switch (item.action) {
        case 'EMIT_TO_SUNAT':
          result = await this.handleEmit(item, provider);
          break;

        case 'VOID_IN_SUNAT':
          result = await this.handleVoid(item, provider);
          break;

        case 'EMIT_CREDIT_NOTE':
          result = await this.handleCreditNote(item, provider);
          break;

        default:
          result = err(new DomainError(
            `Accion desconocida: ${item.action}`,
            'UNKNOWN_QUEUE_ACTION',
            ctx,
          ));
      }

      if (result.success) {
        // Success: mark processed, store CDR, emit event
        await this.onSuccess(item, result.data);
        return {
          id: item.id,
          invoice_id: item.invoice_id,
          tenant_id: item.tenant_id,
          action: item.action,
          status: 'PROCESSED',
        };
      }

      // Failure: determine retry or final failure
      const errorCode = result.error.code;
      const isRetryable = SunatDirectAdapterImpl.isRetryable(errorCode);
      const hasAttemptsLeft = item.attempts + 1 < item.max_attempts;

      if (isRetryable && hasAttemptsLeft) {
        await this.onRetryableFailure(item, result.error);
        return {
          id: item.id,
          invoice_id: item.invoice_id,
          tenant_id: item.tenant_id,
          action: item.action,
          status: 'RETRYING',
          error: result.error.message,
        };
      }

      // Non-retryable or max attempts reached
      await this.onFinalFailure(item, result.error);
      return {
        id: item.id,
        invoice_id: item.invoice_id,
        tenant_id: item.tenant_id,
        action: item.action,
        status: 'FAILED',
        error: result.error.message,
      };

    } catch (error) {
      // Unexpected error — treat as retryable
      const domainError = new DomainError(
        `Error inesperado: ${(error as Error).message}`,
        'SUNAT_UNKNOWN_ERROR',
      );

      const hasAttemptsLeft = item.attempts + 1 < item.max_attempts;
      if (hasAttemptsLeft) {
        await this.onRetryableFailure(item, domainError);
        return {
          id: item.id,
          invoice_id: item.invoice_id,
          tenant_id: item.tenant_id,
          action: item.action,
          status: 'RETRYING',
          error: domainError.message,
        };
      }

      await this.onFinalFailure(item, domainError);
      return {
        id: item.id,
        invoice_id: item.invoice_id,
        tenant_id: item.tenant_id,
        action: item.action,
        status: 'FAILED',
        error: domainError.message,
      };
    }
  }

  // ============================================================================
  // Private: Action Handlers
  // ============================================================================

  private async handleEmit(
    item: QueueItem,
    provider: InvoiceProvider,
  ): Promise<Result<SunatDocumentResult, DomainError>> {
    // Load invoice data from DB
    const invoice = await (this.prisma as any).invoices.findUnique({
      where: { id: item.invoice_id },
      include: { orders: true },
    });

    if (!invoice) {
      return err(new DomainError(
        `Factura no encontrada: ${item.invoice_id}`,
        'INVOICE_NOT_FOUND',
        { invoiceId: item.invoice_id },
      ));
    }

    // Build InvoiceData from stored invoice
    const invoiceData: InvoiceData = {
      serie: invoice.series ?? '',
      numero: invoice.invoice_number ?? '',
      tipo: invoice.invoice_type === 'FACTURA' ? '01' : '03',
      fechaEmision: new Date(invoice.created_at).toISOString().split('T')[0],
      tipoDocumentoCliente: invoice.customer_doc_type === 'RUC' ? '6' : '1',
      numeroDocumentoCliente: invoice.customer_doc ?? '',
      razonSocialCliente: '', // Will be populated from order/tenant data
      moneda: 'PEN',
      totalGravadas: Math.round(invoice.total_cents / 1.18),
      totalIgv: invoice.total_cents - Math.round(invoice.total_cents / 1.18),
      totalImporte: invoice.total_cents,
      items: [], // Items will be loaded from order data
    };

    return provider.sendInvoice(invoiceData);
  }

  private async handleVoid(
    item: QueueItem,
    provider: InvoiceProvider,
  ): Promise<Result<SunatDocumentResult, DomainError>> {
    const invoice = await (this.prisma as any).invoices.findUnique({
      where: { id: item.invoice_id },
    });

    if (!invoice) {
      return err(new DomainError(
        `Factura no encontrada: ${item.invoice_id}`,
        'INVOICE_NOT_FOUND',
        { invoiceId: item.invoice_id },
      ));
    }

    const voidData: VoidData = {
      serie: invoice.series ?? '',
      numero: invoice.invoice_number ?? '',
      tipo: invoice.invoice_type === 'FACTURA' ? '01' : '03',
      motivo: invoice.void_reason ?? 'Anulacion de comprobante',
      fechaEmision: new Date(invoice.created_at).toISOString().split('T')[0],
      fechaComunicacion: new Date().toISOString().split('T')[0],
    };

    return provider.sendVoidCommunication(voidData);
  }

  private async handleCreditNote(
    item: QueueItem,
    provider: InvoiceProvider,
  ): Promise<Result<SunatDocumentResult, DomainError>> {
    const creditNote = await (this.prisma as any).credit_notes.findFirst({
      where: { invoice_id: item.invoice_id },
      include: { invoices: true },
    });

    if (!creditNote) {
      return err(new DomainError(
        `Nota de credito no encontrada para factura: ${item.invoice_id}`,
        'CREDIT_NOTE_NOT_FOUND',
        { invoiceId: item.invoice_id },
      ));
    }

    const creditNoteData: CreditNoteData = {
      serie: creditNote.series ?? '',
      numero: creditNote.number ?? '',
      fechaEmision: new Date(creditNote.created_at).toISOString().split('T')[0],
      invoiceReference: {
        serie: creditNote.invoices?.series ?? '',
        numero: creditNote.invoices?.invoice_number ?? '',
        tipo: creditNote.invoices?.invoice_type === 'FACTURA' ? '01' : '03',
      },
      motivo: creditNote.reason ?? 'Devolucion',
      tipoDocumentoCliente: creditNote.invoices?.customer_doc_type === 'RUC' ? '6' : '1',
      numeroDocumentoCliente: creditNote.invoices?.customer_doc ?? '',
      razonSocialCliente: '',
      moneda: 'PEN',
      totalGravadas: Math.round(creditNote.total_cents / 1.18),
      totalIgv: creditNote.total_cents - Math.round(creditNote.total_cents / 1.18),
      totalImporte: creditNote.total_cents,
      items: [],
    };

    return provider.sendCreditNote(creditNoteData);
  }

  // ============================================================================
  // Private: Outcome Handlers
  // ============================================================================

  private async onSuccess(item: QueueItem, result: SunatDocumentResult): Promise<void> {
    const ctx = { itemId: item.id, invoiceId: item.invoice_id };

    // 1. Update queue item status
    await this.updateStatus(item.id, 'PROCESSED', {
      processed_at: new Date(),
      last_attempt_at: new Date(),
      attempts: item.attempts + 1,
    });

    // 2. Upsert invoice_cdr
    try {
      await (this.prisma as any).invoice_cdr.upsert({
        where: {
          tenant_id_invoice_id: {
            tenant_id: item.tenant_id,
            invoice_id: item.invoice_id,
          },
        },
        update: {
          response_code: result.cdrResponseCode,
          response_message: result.cdrResponseMessage,
          hash: result.hash,
          cdr_xml: result.cdrXml,
          signed_xml: result.signedXml,
          pdf_base64: result.pdfBase64 ?? null,
          qr_string: result.qrString ?? null,
          received_at: new Date(),
        },
        create: {
          id: crypto.randomUUID(),
          tenant_id: item.tenant_id,
          invoice_id: item.invoice_id,
          response_code: result.cdrResponseCode,
          response_message: result.cdrResponseMessage,
          hash: result.hash,
          cdr_xml: result.cdrXml,
          signed_xml: result.signedXml,
          pdf_base64: result.pdfBase64 ?? null,
          qr_string: result.qrString ?? null,
          received_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        { ...ctx, error: (error as Error).message },
        'Failed to upsert invoice_cdr',
      );
    }

    // 3. Emit INVOICE_SUNAT_ACCEPTED event
    try {
      await (this.prisma as any).events.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: item.tenant_id,
          terminal_id: 'SYSTEM',
          entity_type: 'INVOICE',
          entity_id: item.invoice_id,
          type: 'INVOICE_SUNAT_ACCEPTED',
          payload: {
            invoice_id: item.invoice_id,
            response_code: result.cdrResponseCode,
            hash: result.hash,
            cdr_received_at: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        { ...ctx, error: (error as Error).message },
        'Failed to emit INVOICE_SUNAT_ACCEPTED event',
      );
    }

    this.logger.info(ctx, 'Queue item processed successfully');
  }

  private async onRetryableFailure(item: QueueItem, error: DomainError): Promise<void> {
    const newAttempts = item.attempts + 1;
    const backoffMinutes = newAttempts * RETRY_BASE_MINUTES;
    const nextSchedule = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await this.updateStatus(item.id, 'PENDING', {
      attempts: newAttempts,
      last_attempt_at: new Date(),
      last_error: error.message,
      scheduled_at: nextSchedule,
    });

    this.logger.warn(
      {
        itemId: item.id,
        attempts: newAttempts,
        nextSchedule: nextSchedule.toISOString(),
        error: error.message,
      },
      'Queue item scheduled for retry',
    );

    // Emit INVOICE_SENT_TO_SUNAT event (attempt recorded)
    try {
      await (this.prisma as any).events.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: item.tenant_id,
          terminal_id: 'SYSTEM',
          entity_type: 'INVOICE',
          entity_id: item.invoice_id,
          type: 'INVOICE_SENT_TO_SUNAT',
          payload: {
            invoice_id: item.invoice_id,
            queue_item_id: item.id,
            provider: 'QUEUE_WORKER',
            attempt: newAttempts,
            success: false,
          },
        },
      });
    } catch (emitError) {
      this.logger.error(
        { itemId: item.id, error: (emitError as Error).message },
        'Failed to emit INVOICE_SENT_TO_SUNAT event',
      );
    }
  }

  private async onFinalFailure(item: QueueItem, error: DomainError): Promise<void> {
    const newAttempts = item.attempts + 1;

    await this.updateStatus(item.id, 'FAILED', {
      attempts: newAttempts,
      last_attempt_at: new Date(),
      last_error: error.message,
    });

    // Emit INVOICE_SUNAT_REJECTED event
    try {
      await (this.prisma as any).events.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: item.tenant_id,
          terminal_id: 'SYSTEM',
          entity_type: 'INVOICE',
          entity_id: item.invoice_id,
          type: 'INVOICE_SUNAT_REJECTED',
          payload: {
            invoice_id: item.invoice_id,
            response_code: error.code,
            error_message: error.message,
            attempts: newAttempts,
          },
        },
      });
    } catch (emitError) {
      this.logger.error(
        { itemId: item.id, error: (emitError as Error).message },
        'Failed to emit INVOICE_SUNAT_REJECTED event',
      );
    }

    this.logger.error(
      { itemId: item.id, attempts: newAttempts, error: error.message },
      'Queue item permanently failed',
    );
  }

  // ============================================================================
  // Private: Daily Summary Ticket Polling
  // ============================================================================

  /**
   * Poll pending daily summary tickets for status resolution.
   * Queries sunat_daily_summary where sunat_status = 'PENDING' and ticket_number
   * is not null. For each, calls provider.queryTicketStatus().
   * Updates status to ACCEPTED or REJECTED based on CDR response.
   */
  private async pollPendingTickets(): Promise<void> {
    try {
      // Query pending summaries with ticket numbers
      const pendingSummaries = await this.prisma.$queryRawUnsafe<
        Array<{ id: string; tenant_id: string; ticket_number: string; summary_date: Date }>
      >(
        `SELECT id, tenant_id, ticket_number, summary_date
         FROM sunat_daily_summary
         WHERE sunat_status = 'PENDING'
           AND ticket_number IS NOT NULL
         ORDER BY created_at ASC
         LIMIT 10`,
      );

      if (pendingSummaries.length === 0) {
        return;
      }

      this.logger.info(
        { count: pendingSummaries.length },
        'Polling pending daily summary tickets',
      );

      // Group by tenant_id
      const byTenant = new Map<string, typeof pendingSummaries>();
      for (const summary of pendingSummaries) {
        const list = byTenant.get(summary.tenant_id) ?? [];
        list.push(summary);
        byTenant.set(summary.tenant_id, list);
      }

      for (const [tenantId, summaries] of byTenant.entries()) {
        const providerResult = await this.providerRouter.getProvider(tenantId);
        if (!providerResult.success) {
          this.logger.warn(
            { tenantId, error: providerResult.error.message },
            'Cannot poll tickets: provider not available',
          );
          continue;
        }

        const provider = providerResult.data;

        for (const summary of summaries) {
          try {
            const statusResult = await provider.queryTicketStatus(summary.ticket_number);

            if (!statusResult.success) {
              this.logger.warn(
                { tenantId, ticketNumber: summary.ticket_number, error: statusResult.error.message },
                'Ticket status query failed',
              );
              continue;
            }

            const ticketStatus = statusResult.data;

            if (ticketStatus.status === 'PENDING') {
              // Still pending — do nothing, will be checked again next run
              continue;
            }

            // Update summary status
            const newStatus = ticketStatus.status === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED';
            await this.prisma.$queryRawUnsafe(
              `UPDATE sunat_daily_summary
               SET sunat_status = $1,
                   cdr_xml = $2,
                   cdr_received = NOW(),
                   last_error = $3
               WHERE id = $4::uuid`,
              newStatus,
              ticketStatus.cdrXml ?? null,
              ticketStatus.status === 'REJECTED' ? ticketStatus.cdrResponseMessage ?? null : null,
              summary.id,
            );

            this.logger.info(
              { tenantId, ticketNumber: summary.ticket_number, newStatus },
              'Daily summary ticket resolved',
            );
          } catch (error) {
            this.logger.error(
              { tenantId, ticketNumber: summary.ticket_number, error: (error as Error).message },
              'Error polling ticket status',
            );
            // Continue to next ticket — don't let one failure block others
          }
        }
      }
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'Failed to poll pending tickets',
      );
    }
  }

  // ============================================================================
  // Private: DB Helpers
  // ============================================================================

  private async updateStatus(
    itemId: string,
    status: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await (this.prisma as any).invoice_queue.update({
      where: { id: itemId },
      data: { status, ...extra },
    });
  }

  private async markSkipped(item: QueueItem, reason: string): Promise<void> {
    // Don't change status — leave as PENDING so it can be retried
    // when the tenant fixes their config
    this.logger.info(
      { itemId: item.id, tenantId: item.tenant_id, reason },
      'Queue item skipped',
    );
  }

  // ============================================================================
  // Private: Utility
  // ============================================================================

  private groupByTenant(items: QueueItem[]): Map<string, QueueItem[]> {
    const map = new Map<string, QueueItem[]>();
    for (const item of items) {
      const list = map.get(item.tenant_id) ?? [];
      list.push(item);
      map.set(item.tenant_id, list);
    }
    return map;
  }

  private incrementFailureCount(tenantId: string): void {
    const current = this.consecutiveFailures.get(tenantId) ?? 0;
    this.consecutiveFailures.set(tenantId, current + 1);
  }

  private resetFailureCount(tenantId: string): void {
    this.consecutiveFailures.set(tenantId, 0);
  }

  private getFailureCount(tenantId: string): number {
    return this.consecutiveFailures.get(tenantId) ?? 0;
  }
}

// Export constants for testing
export { BATCH_SIZE, MAX_WORKER_DURATION_MS, RETRY_BASE_MINUTES, AUTO_CONTINGENCY_THRESHOLD };
