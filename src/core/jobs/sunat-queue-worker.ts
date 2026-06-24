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
import { ContingencyManager } from '@/src/core/integrations/sunat/contingency';

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
  private contingencyManager: ContingencyManager;
  private logger;
  private batchFailures: Map<string, number> = new Map();

  constructor(prisma: PrismaClient, providerRouter: InvoiceProviderRouter) {
    this.prisma = prisma;
    this.providerRouter = providerRouter;
    this.contingencyManager = new ContingencyManager(prisma);
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

            // Check auto-contingency threshold → activate contingency mode
            const failureCount = await this.getFailureCount(tenantId);
            if (failureCount >= AUTO_CONTINGENCY_THRESHOLD) {
              this.logger.warn(
                { tenantId, failures: failureCount },
                'Auto-contingency threshold reached, activating contingency mode',
              );
              try {
                await this.contingencyManager.activate(
                  tenantId,
                  'SUNAT_UNREACHABLE',
                  undefined,
                  true, // autoActivated
                );
                this.resetFailureCount(tenantId);
              } catch (contingencyError) {
                this.logger.error(
                  { tenantId, error: (contingencyError as Error).message },
                  'Failed to activate contingency mode',
                );
              }
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
    // Load invoice with related order and customer
    const invoice = await (this.prisma as any).invoices.findUnique({
      where: { id: item.invoice_id },
      include: { customer: true, orders: { include: { customers: true } } },
    });

    if (!invoice) {
      return err(new DomainError(
        `Factura no encontrada: ${item.invoice_id}`,
        'INVOICE_NOT_FOUND',
        { invoiceId: item.invoice_id },
      ));
    }

    // Resolve items from order → check → lines (excluye items anulados via event store)
    const sunatItems = await this.resolveInvoiceItems(invoice);
    
    // Validate: SUNAT requires at least 1 item per invoice
    if (sunatItems.length === 0) {
      return err(new DomainError(
        'Factura sin items: no se puede enviar a SUNAT',
        'SUNAT_REJECTED',
        { invoiceId: item.invoice_id },
      ));
    }
    
    const customerName = await this.resolveCustomerName(invoice, item.tenant_id);
    
    // Validate: FACTURA requires valid customer name (RUC requires razon social)
    // Note: '-' is valid for BOLETA (anonymous customer) but invalid for FACTURA
    if (invoice.invoice_type === 'FACTURA' && (customerName === '' || customerName === '-')) {
      return err(new DomainError(
        'Factura sin nombre de cliente: RUC requiere razon social',
        'SUNAT_REJECTED',
        { invoiceId: item.invoice_id, customerDoc: invoice.customer_doc },
      ));
    }

    // Calculate totals per tax category from resolved items
    const { totalGravadas, totalIgv } = this.calculateTaxTotals(sunatItems, invoice.total_cents);

    const invoiceData: InvoiceData = {
      serie: invoice.series ?? '',
      numero: invoice.invoice_number ?? '',
      tipo: invoice.invoice_type === 'FACTURA' ? '01' : '03',
      fechaEmision: new Date(invoice.created_at).toISOString().split('T')[0],
      tipoDocumentoCliente: invoice.customer_doc_type === 'RUC' ? '6' : '1',
      numeroDocumentoCliente: invoice.customer_doc ?? '',
      razonSocialCliente: customerName,
      moneda: 'PEN',
      totalGravadas,
      totalIgv,
      totalImporte: invoice.total_cents,
      items: sunatItems,
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
      include: { invoices: { include: { customer: true, orders: { include: { customers: true } } } } },
    });

    if (!creditNote) {
      return err(new DomainError(
        `Nota de credito no encontrada para factura: ${item.invoice_id}`,
        'CREDIT_NOTE_NOT_FOUND',
        { invoiceId: item.invoice_id },
      ));
    }

    // Resolve items from the original invoice (excluye items anulados via event store)
    const sunatItems = creditNote.invoices
      ? await this.resolveInvoiceItems(creditNote.invoices)
      : [];
    
    // Validate: SUNAT requires at least 1 item per credit note
    if (sunatItems.length === 0) {
      return err(new DomainError(
        'Nota de credito sin items: no se puede enviar a SUNAT',
        'SUNAT_REJECTED',
        { invoiceId: item.invoice_id },
      ));
    }
    
    const customerName = await this.resolveCustomerName(
      creditNote.invoices,
      item.tenant_id,
    );
    
    // Validate: FACTURA credit note requires valid customer name
    // Note: '-' is valid for BOLETA (anonymous customer) but invalid for FACTURA
    if (creditNote.invoices?.invoice_type === 'FACTURA' && (customerName === '' || customerName === '-')) {
      return err(new DomainError(
        'Nota de credito sin nombre de cliente: RUC requiere razon social',
        'SUNAT_REJECTED',
        { invoiceId: item.invoice_id },
      ));
    }
    
    const { totalGravadas, totalIgv } = this.calculateTaxTotals(
      sunatItems,
      creditNote.total_cents,
    );

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
      razonSocialCliente: customerName,
      moneda: 'PEN',
      totalGravadas,
      totalIgv,
      totalImporte: creditNote.total_cents,
      items: sunatItems,
    };

    return provider.sendCreditNote(creditNoteData);
  }

  // ============================================================================
  // Private: Invoice Data Resolution
  // ============================================================================

  /**
   * Resolve SUNAT line items from invoice → order → check → lines.
   * Matches check.lines (by line_id) to order.items to build the
   * items array required by SUNAT UBL 2.1.
   *
   * Uses `any` because Prisma dynamic includes + JSON columns yield untyped results.
   */
  private async resolveInvoiceItems(invoice: any): Promise<Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    precioTotal: number;
    igv: number;
  }>> {
    const order = invoice.orders;
    if (!order) {
      this.logger.warn({ invoiceId: invoice.id }, 'resolveInvoiceItems: no order relation loaded');
      return [];
    }

    // FUENTE DE VERDAD del void de item = eventos ORDER_ITEM_VOIDED del agregado.
    // NO confiar en order.items[].status (queda CONGELADO en creacion: el void hace
    // DELETE en order_item_projections y nunca escribe 'VOIDED' en el JSON).
    // Tampoco filtrar por presencia en order_item_projections: ORDER_CREATED no
    // proyecta sus items iniciales, solo ORDER_ITEM_ADDED lo hace.
    // El modelo `events` mapea: type=event_type, entity_id=aggregate_id (order.id).
    const voidedLineIds = await this.resolveVoidedLineIds(order.id, invoice.tenant_id);

    // Parse order items JSON (Prisma auto-parses Json columns)
    const orderItems: any[] = Array.isArray(order.items)
      ? order.items
      : (() => { try { return JSON.parse(order.items); } catch { return []; } })();

    if (orderItems.length === 0) {
      this.logger.warn({ invoiceId: invoice.id, orderId: order.id }, 'resolveInvoiceItems: order has no items');
      return [];
    }

    // Build lookup by line_id
    const itemsByLineId = new Map<string, any>();
    for (const item of orderItems) {
      if (item.line_id) {
        itemsByLineId.set(item.line_id, item);
      }
    }

    // Find the matching check for this invoice
    const checks: any[] = Array.isArray(order.checks)
      ? order.checks
      : (() => { try { return JSON.parse(order.checks); } catch { return []; } })();

    const check = checks.find((c: any) => c.check_id === invoice.check_id);

    // If check has specific lines, use those; otherwise use all order items.
    // En AMBOS caminos se excluyen las lineas anuladas (voidedLineIds).
    const linesToUse = check?.lines?.length > 0
      ? check.lines
          .filter((cl: any) => !voidedLineIds.has(cl.line_id))
          .map((cl: any) => {
            const orderItem = itemsByLineId.get(cl.line_id);
            if (!orderItem) return null;
            return { ...orderItem, qty: cl.qty ?? orderItem.qty };
          })
          .filter(Boolean)
      : orderItems.filter((item: any) => !voidedLineIds.has(item.line_id));

    return linesToUse.map((item: any) => {
      const qty = item.qty ?? 1;
      const unitPriceCents = item.unit_price_cents ?? 0;
      const totalCents = unitPriceCents * qty;
      const taxCategory = item.tax_category ?? 'GRAVADO';

      // IGV calculation: GRAVADO = 18%, EXONERADO/INAFECTO = 0%
      const igvCents = taxCategory === 'GRAVADO'
        ? totalCents - Math.round(totalCents / 1.18)
        : 0;

      return {
        codigo: item.sku ?? item.product_id ?? '',
        descripcion: item.name ?? 'Producto',
        cantidad: qty,
        unidadMedida: 'NIU', // Unidad (SUNAT catalog 03)
        precioUnitario: unitPriceCents,
        precioTotal: totalCents,
        igv: igvCents,
      };
    });
  }

  /**
   * Obtiene el set de line_ids anulados consultando el event store.
   *
   * Fuente de verdad del void de item: eventos ORDER_ITEM_VOIDED del agregado
   * de la orden. Se usa porque order.items[].status queda congelado en el valor
   * de creacion (el void hace DELETE en order_item_projections y nunca escribe
   * 'VOIDED' en el JSON), y porque la proyeccion order_item_projections puede
   * estar vacia para items nacidos via ORDER_CREATED (no proyectan sus items).
   *
   * Mapeo del modelo `events`: type = event_type, entity_id = aggregate_id (order.id).
   * tenant_id SIEMPRE desde el invoice (server-side), NUNCA del cliente.
   */
  private async resolveVoidedLineIds(
    orderId: string,
    tenantId: string,
  ): Promise<Set<string>> {
    const voidedLineIds = new Set<string>();

    if (!orderId || !tenantId) {
      return voidedLineIds;
    }

    const voidEvents: Array<{ payload: any }> = await (this.prisma as any).events.findMany({
      where: {
        tenant_id: tenantId,
        type: 'ORDER_ITEM_VOIDED',
        entity_id: orderId,
      },
      select: { payload: true },
    });

    for (const ev of voidEvents) {
      const payload = ev.payload;
      const lineId = typeof payload?.line_id === 'string' ? payload.line_id : undefined;
      if (lineId) {
        voidedLineIds.add(lineId);
      }
    }

    return voidedLineIds;
  }

  /**
   * Resolve customer name for SUNAT.
   * - BOLETA: "-" (SUNAT allows anonymous for boletas)
   * - FACTURA: Snapshot from invoice → order customer relation → lookup → "-"
   *
   * Uses `any` because Prisma dynamic includes yield untyped results.
   */
  private async resolveCustomerName(
    invoice: any, // Prisma dynamic include yields untyped result
    tenantId: string,
  ): Promise<string> {
    if (!invoice) return '-';

    // BOLETA doesn't require customer name
    if (invoice.invoice_type !== 'FACTURA') {
      return '-';
    }

    // 1. Best: use the snapshot stored on the invoice at emission time
    if (invoice.customer_name) return invoice.customer_name;

    // 2. Try from invoice → customer FK (loaded via include: { customer: true })
    if (invoice.customer?.name) return invoice.customer.name;

    // 3. Try from order → customer relation (loaded via include)
    const customerFromOrder = invoice.orders?.customers;
    if (customerFromOrder?.name) return customerFromOrder.name;

    // 4. Fallback: look up customer by order's customer_id
    const customerId = invoice.orders?.customer_id;
    if (customerId) {
      try {
        const customer = await (this.prisma as any).customers.findUnique({
          where: { id: customerId },
          select: { name: true },
        });
        if (customer?.name) return customer.name;
      } catch {
        // Lookup failed — continue with fallback
      }
    }

    // 5. Last resort: look up customer by doc_number
    if (invoice.customer_doc) {
      try {
        const customer = await (this.prisma as any).customers.findFirst({
          where: { tenant_id: tenantId, doc_number: invoice.customer_doc },
          select: { name: true },
        });
        if (customer?.name) return customer.name;
      } catch {
        // Lookup failed — continue with fallback
      }
    }

    return '-';
  }

  /**
   * Calculate SUNAT tax totals from resolved items.
   * Falls back to simple 18% calculation if no items resolved.
   */
  private calculateTaxTotals(
    items: Array<{ precioTotal: number; igv: number }>,
    invoiceTotalCents: number,
  ): { totalGravadas: number; totalIgv: number } {
    if (items.length === 0) {
      // Fallback: assume all gravado at 18%
      const totalGravadas = Math.round(invoiceTotalCents / 1.18);
      return {
        totalGravadas,
        totalIgv: invoiceTotalCents - totalGravadas,
      };
    }

    let totalGravadas = 0;
    let totalIgv = 0;
    for (const item of items) {
      totalGravadas += item.precioTotal - item.igv;
      totalIgv += item.igv;
    }
    return { totalGravadas, totalIgv };
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
    const current = this.batchFailures.get(tenantId) ?? 0;
    this.batchFailures.set(tenantId, current + 1);
  }

  private resetFailureCount(tenantId: string): void {
    this.batchFailures.set(tenantId, 0);
  }

  /**
   * Count consecutive recent failures for a tenant.
   * Combines in-batch failures with DB-persisted failures from prior runs
   * (items attempted in last 30 min that are FAILED or still PENDING with errors).
   */
  private async getFailureCount(tenantId: string): Promise<number> {
    const batchCount = this.batchFailures.get(tenantId) ?? 0;

    try {
      const since = new Date(Date.now() - 30 * 60 * 1000); // 30 min window
      const dbCount = await (this.prisma as any).invoice_queue.count({
        where: {
          tenant_id: tenantId,
          last_attempt_at: { gte: since },
          OR: [
            { status: 'FAILED' },
            { status: 'PENDING', last_error: { not: null } },
          ],
        },
      });
      return batchCount + (dbCount as number);
    } catch {
      // If DB query fails, fall back to batch-only count
      return batchCount;
    }
  }
}

// Export constants for testing
export { BATCH_SIZE, MAX_WORKER_DURATION_MS, RETRY_BASE_MINUTES, AUTO_CONTINGENCY_THRESHOLD };
