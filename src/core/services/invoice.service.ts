/**
 * Invoice Service - Business Logic Layer
 * 
 * Servicio completo para gestión de comprobantes de pago (boletas y facturas)
 * en cumplimiento con SUNAT Perú. Implementa:
 * - Emisión de boletas/facturas
 * - Anulación de comprobantes
 * - Consulta de estado SUNAT
 * - Notas de crédito
 * - Manejo de series y correlativos
 * - Cola de procesamiento asíncrono
 * 
 * @module core/services/invoice.service
 */

import { PrismaClient, Prisma } from '@prisma/client';
import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError, ConflictError, ForbiddenError } from '@/src/core/result';
import { CacheService } from '@/src/core/cache/redis.service';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { withTransaction } from '@/src/core/db/transaction';

// ============================================================================
// Tipos y Enums
// ============================================================================

export type InvoiceType = 'BOLETA' | 'FACTURA';
export type InvoiceStatus = 'ISSUED' | 'VOIDED' | 'PENDING';
export type SunatStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'TIMEOUT';
export type CreditNoteStatus = 'ISSUED' | 'VOIDED';

export interface EmitInvoiceInput {
  tenantId: string;
  orderId: string;
  checkId: string;
  invoiceType: InvoiceType;
  customerDocType?: 'DNI' | 'RUC' | 'CE' | 'PASSPORT';
  customerDoc?: string;
  customerName?: string;
  paymentSummary: PaymentSummary;
  issuedBy: string;
  terminalId: string;
}

export interface PaymentSummary {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  payments: PaymentDetail[];
}

export interface PaymentDetail {
  method: 'CASH' | 'YAPE' | 'PLIN' | 'CARD' | 'TRANSFER';
  amountCents: number;
  ref?: string;
}

export interface VoidInvoiceInput {
  tenantId: string;
  invoiceId: string;
  reason: string;
  voidedBy: string;
  approvedBy: string;
  terminalId: string;
}

export interface GenerateCreditNoteInput {
  tenantId: string;
  invoiceId: string;
  reason: string;
  items?: CreditNoteItem[];
  totalCents?: number;
  generatedBy: string;
  terminalId: string;
}

export interface CreditNoteItem {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface InvoiceResult {
  id: string;
  tenantId: string;
  orderId: string;
  checkId: string;
  invoiceType: InvoiceType;
  series: string;
  invoiceNumber: string;
  customerDocType?: string;
  customerDoc?: string;
  totalCents: number;
  paymentSummary: PaymentSummary;
  status: InvoiceStatus;
  sunatStatus: SunatStatus;
  createdAt: Date;
}

export interface CreditNoteResult {
  id: string;
  tenantId: string;
  invoiceId: string;
  series: string;
  number: string;
  totalCents: number;
  reason: string;
  status: CreditNoteStatus;
  sunatStatus: SunatStatus;
  createdAt: Date;
}

export interface SunatStatusResult {
  invoiceId: string;
  status: SunatStatus;
  responseCode?: string;
  responseMessage?: string;
  hash?: string;
  cdrXml?: string;
  lastUpdated: Date;
}

export interface SeriesConfig {
  series: string;
  invoiceType: InvoiceType;
  currentNumber: number;
  maxNumber: number;
  isActive: boolean;
}

// ============================================================================
// Constantes
// ============================================================================

const CACHE_TTL = {
  INVOICE: 300, // 5 minutos
  SERIES: 60,   // 1 minuto
  SUNAT_STATUS: 30, // 30 segundos
};

const CACHE_KEYS = {
  INVOICE: (tenantId: string, invoiceId: string) => `invoice:${tenantId}:${invoiceId}`,
  ORDER_INVOICES: (tenantId: string, orderId: string) => `invoices:order:${tenantId}:${orderId}`,
  SERIES: (tenantId: string, series: string) => `series:${tenantId}:${series}`,
  SUNAT_STATUS: (tenantId: string, invoiceId: string) => `sunat:${tenantId}:${invoiceId}`,
};

// Configuración de series según SUNAT
const SERIES_PREFIX: Record<InvoiceType, string> = {
  BOLETA: 'B',
  FACTURA: 'F',
};

const DEFAULT_SERIES_NUMBER = '001';
const MAX_CORRELATIVO = 99999999;

// ============================================================================
// Invoice Service
// ============================================================================

export class InvoiceService {
  private cache: CacheService;

  constructor(
    private prisma: PrismaClient,
    cache?: CacheService
  ) {
    this.cache = cache || new CacheService();
  }

  // ==========================================================================
  // Métodos Públicos - Emisión de Factura
  // ==========================================================================

  /**
   * Emite una boleta o factura para una orden pagada
   * 
   * Flujo:
   * 1. Valida que la orden exista y esté pagada
   * 2. Verifica que no exista factura previa para el check
   * 3. Genera serie y correlativo atómicamente
   * 4. Crea el registro de factura en transacción
   * 5. Publica evento INVOICE_ISSUED
   * 6. Agrega a cola de procesamiento SUNAT
   * 
   * @param input - Datos de entrada para emitir la factura
   * @returns Result<InvoiceResult, DomainError>
   * 
   * @example
   * ```typescript
   * const result = await invoiceService.emitInvoice({
   *   tenantId: 'tenant-123',
   *   orderId: 'order-456',
   *   checkId: 'check-789',
   *   invoiceType: 'BOLETA',
   *   customerDocType: 'DNI',
   *   customerDoc: '12345678',
   *   paymentSummary: { totalCents: 10000, ... },
   *   issuedBy: 'user-123',
   *   terminalId: 'terminal-001'
   * });
   * ```
   */
  async emitInvoice(input: EmitInvoiceInput): Promise<Result<InvoiceResult, DomainError>> {
    // Validaciones de entrada
    const validationResult = this.validateEmitInvoiceInput(input);
    if (!validationResult.success) {
      return validationResult;
    }

    // Verificar que la orden exista y esté pagada
    const orderValidation = await this.validateOrderForInvoice(input);
    if (!orderValidation.success) {
      return orderValidation;
    }

    // Verificar que no exista factura previa para este check
    const existingCheck = await this.prisma.invoices.findFirst({
      where: {
        tenant_id: input.tenantId,
        order_id: input.orderId,
        check_id: input.checkId,
        status: { not: 'VOIDED' },
      },
    });

    if (existingCheck) {
      return err(new ConflictError(
        `Invoice already exists for this check. Invoice ID: ${existingCheck.id}`,
        'check_id'
      ));
    }

    // Generar serie y correlativo atómicamente
    const seriesResult = await this.generateNextSeriesNumber(
      input.tenantId,
      input.invoiceType
    );
    if (!seriesResult.success) {
      return seriesResult;
    }

    const { series, invoiceNumber } = seriesResult.data;
    const invoiceId = uuidv4();

    // Ejecutar emisión en transacción
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Crear la factura
        const invoice = await tx.invoices.create({
          data: {
            id: invoiceId,
            tenant_id: input.tenantId,
            order_id: input.orderId,
            check_id: input.checkId,
            invoice_type: input.invoiceType,
            series,
            invoice_number: invoiceNumber,
            customer_doc_type: input.customerDocType,
            customer_doc: input.customerDoc,
            total_cents: input.paymentSummary.totalCents,
            payment_summary: input.paymentSummary as any,
            status: 'ISSUED',
          },
        });

        // Publicar evento INVOICE_ISSUED
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: new Date(),
            type: 'INVOICE_ISSUED',
            entity_type: 'INVOICE',
            entity_id: invoiceId,
            actor_id: input.issuedBy,
            actor_role_snapshot: 'CASHIER',
            terminal_id: input.terminalId,
            payload: {
              order_id: input.orderId,
              check_id: input.checkId,
              invoice_id: invoiceId,
              invoice_type: input.invoiceType,
              series,
              invoice_number: invoiceNumber,
              total_cents: input.paymentSummary.totalCents,
            },
          },
        });

        // Agregar a cola de procesamiento SUNAT
        await tx.invoice_queue.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            invoice_id: invoiceId,
            action: 'EMIT_TO_SUNAT',
            priority: 5,
            attempts: 0,
            max_attempts: 3,
            scheduled_at: new Date(),
            status: 'PENDING',
          },
        });

        return invoice;
      },
      { maxRetries: 3, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to emit invoice'
      );
      return err(new DomainError(
        'Failed to emit invoice',
        'INVOICE_EMISSION_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const invoice = txResult.data;

    // Invalidar caches relevantes
    await this.invalidateInvoiceCaches(input.tenantId, invoiceId, input.orderId);

    // Construir resultado
    const result = this.mapInvoiceToResult(invoice);

    pinoLogger.info(
      {
        invoiceId: invoice.id,
        series,
        invoiceNumber,
        tenantId: input.tenantId,
        totalCents: input.paymentSummary.totalCents,
      },
      'Invoice emitted successfully'
    );

    return ok(result);
  }

  /**
   * Anula un comprobante emitido y genera nota de crédito si es necesario
   * 
   * Requiere aprobación de supervisor/gerente según reglas de negocio.
   * Solo se pueden anular comprobantes dentro del mismo día calendario.
   * 
   * @param input - Datos de entrada para anular la factura
   * @returns Result<InvoiceResult, DomainError>
   */
  async voidInvoice(input: VoidInvoiceInput): Promise<Result<InvoiceResult, DomainError>> {
    // Validaciones
    if (!input.reason || input.reason.length < 5) {
      return err(new ValidationError(
        'Reason must be at least 5 characters',
        'reason'
      ));
    }

    // Obtener factura
    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: input.invoiceId,
        tenant_id: input.tenantId,
      },
    });

    if (!invoice) {
      return err(new NotFoundError('Invoice', input.invoiceId));
    }

    if (invoice.status === 'VOIDED') {
      return err(new ConflictError(
        'Invoice is already voided',
        'status'
      ));
    }

    // Verificar que sea del mismo día (regla SUNAT)
    const invoiceDate = new Date(invoice.created_at);
    const now = new Date();
    const isSameDay = invoiceDate.toDateString() === now.toDateString();

    if (!isSameDay) {
      return err(new ForbiddenError(
        'Invoices can only be voided on the same day of issuance per SUNAT regulations'
      ));
    }

    // Ejecutar anulación en transacción
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Actualizar factura
        const voidedInvoice = await tx.invoices.update({
          where: { id: input.invoiceId },
          data: {
            status: 'VOIDED',
            void_reason: input.reason,
            voided_by: input.voidedBy,
            voided_at: new Date(),
          },
        });

        // Publicar evento INVOICE_VOIDED
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: new Date(),
            type: 'INVOICE_VOIDED',
            entity_type: 'INVOICE',
            entity_id: input.invoiceId,
            actor_id: input.voidedBy,
            actor_role_snapshot: 'SUPERVISOR',
            terminal_id: input.terminalId,
            payload: {
              invoice_id: input.invoiceId,
              reason: input.reason,
              approved_by: input.approvedBy,
            },
          },
        });

        // Si ya fue aceptada por SUNAT, agregar a cola para comunicar anulación
        const cdr = await tx.invoice_cdr.findFirst({
          where: {
            tenant_id: input.tenantId,
            invoice_id: input.invoiceId,
          },
        });

        if (cdr && cdr.response_code === '0') {
          await tx.invoice_queue.create({
            data: {
              id: uuidv4(),
              tenant_id: input.tenantId,
              invoice_id: input.invoiceId,
              action: 'VOID_IN_SUNAT',
              priority: 10, // Alta prioridad
              attempts: 0,
              max_attempts: 3,
              scheduled_at: new Date(),
              status: 'PENDING',
            },
          });
        }

        return voidedInvoice;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to void invoice',
        'INVOICE_VOID_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    // Invalidar caches
    await this.invalidateInvoiceCaches(input.tenantId, input.invoiceId, invoice.order_id);

    const result = this.mapInvoiceToResult(txResult.data);

    pinoLogger.info(
      {
        invoiceId: input.invoiceId,
        tenantId: input.tenantId,
        voidedBy: input.voidedBy,
      },
      'Invoice voided successfully'
    );

    return ok(result);
  }

  /**
   * Obtiene una factura por ID con caching
   * 
   * @param tenantId - ID del tenant
   * @param invoiceId - ID de la factura
   * @returns Result<InvoiceResult, NotFoundError>
   */
  async getInvoice(
    tenantId: string,
    invoiceId: string
  ): Promise<Result<InvoiceResult, NotFoundError>> {
    const cacheKey = CACHE_KEYS.INVOICE(tenantId, invoiceId);

    // Intentar obtener del cache
    const cached = await this.cache.get<InvoiceResult>(cacheKey);
    if (cached) {
      return ok(cached);
    }

    // Consultar base de datos
    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        tenant_id: tenantId,
      },
    });

    if (!invoice) {
      return err(new NotFoundError('Invoice', invoiceId));
    }

    const result = this.mapInvoiceToResult(invoice);

    // Cachear por 5 minutos
    await this.cache.set(cacheKey, result, CACHE_TTL.INVOICE);

    return ok(result);
  }

  /**
   * Consulta el estado de una factura en SUNAT
   * 
   * Primero verifica el cache, luego consulta la tabla invoice_cdr
   * y opcionalmente consulta SUNAT si no hay información local.
   * 
   * @param tenantId - ID del tenant
   * @param invoiceId - ID de la factura
   * @param forceRefresh - Forzar consulta a SUNAT
   * @returns Result<SunatStatusResult, DomainError>
   */
  async querySunatStatus(
    tenantId: string,
    invoiceId: string,
    forceRefresh = false
  ): Promise<Result<SunatStatusResult, DomainError>> {
    const cacheKey = CACHE_KEYS.SUNAT_STATUS(tenantId, invoiceId);

    // Si no se fuerza refresh, intentar cache
    if (!forceRefresh) {
      const cached = await this.cache.get<SunatStatusResult>(cacheKey);
      if (cached) {
        return ok(cached);
      }
    }

    // Verificar que la factura exista
    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: invoiceId,
        tenant_id: tenantId,
      },
    });

    if (!invoice) {
      return err(new NotFoundError('Invoice', invoiceId));
    }

    // Consultar CDR local
    const cdr = await this.prisma.invoice_cdr.findFirst({
      where: {
        tenant_id: tenantId,
        invoice_id: invoiceId,
      },
    });

    let sunatStatus: SunatStatusResult;

    if (cdr) {
      sunatStatus = {
        invoiceId,
        status: cdr.response_code === '0' ? 'ACCEPTED' : 'REJECTED',
        responseCode: cdr.response_code,
        responseMessage: cdr.response_message,
        hash: cdr.hash || undefined,
        cdrXml: cdr.cdr_xml || undefined,
        lastUpdated: cdr.received_at,
      };
    } else {
      // Verificar en cola de procesamiento
      const queueItem = await this.prisma.invoice_queue.findFirst({
        where: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
        },
        orderBy: {
          scheduled_at: 'desc',
        },
      });

      if (queueItem) {
        sunatStatus = {
          invoiceId,
          status: this.mapQueueStatusToSunatStatus(queueItem.status),
          lastUpdated: queueItem.last_attempt_at || queueItem.scheduled_at,
        };
      } else {
        sunatStatus = {
          invoiceId,
          status: 'PENDING',
          lastUpdated: invoice.created_at,
        };
      }
    }

    // Cachear resultado
    await this.cache.set(cacheKey, sunatStatus, CACHE_TTL.SUNAT_STATUS);

    return ok(sunatStatus);
  }

  /**
   * Genera una nota de crédito para una factura
   * 
   * Las notas de crédito se usan para:
   * - Anulación de ventas
   * - Descuentos post-emisión
   * - Devoluciones parciales
   * 
   * @param input - Datos de entrada para generar la nota de crédito
   * @returns Result<CreditNoteResult, DomainError>
   */
  async generateCreditNote(
    input: GenerateCreditNoteInput
  ): Promise<Result<CreditNoteResult, DomainError>> {
    // Validaciones
    if (!input.reason || input.reason.length < 5) {
      return err(new ValidationError(
        'Reason must be at least 5 characters',
        'reason'
      ));
    }

    // Verificar que la factura exista y esté aceptada por SUNAT
    const invoice = await this.prisma.invoices.findFirst({
      where: {
        id: input.invoiceId,
        tenant_id: input.tenantId,
      },
      include: {
        credit_notes: true,
      },
    });

    if (!invoice) {
      return err(new NotFoundError('Invoice', input.invoiceId));
    }

    if (invoice.status === 'VOIDED') {
      return err(new ValidationError(
        'Cannot generate credit note for voided invoice'
      ));
    }

    // Verificar CDR
    const cdr = await this.prisma.invoice_cdr.findFirst({
      where: {
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId,
      },
    });

    if (!cdr || cdr.response_code !== '0') {
      return err(new ValidationError(
        'Invoice must be accepted by SUNAT before generating credit note'
      ));
    }

    // Calcular monto si no se proporciona (total por defecto)
    const totalCents = input.totalCents ?? invoice.total_cents;

    if (totalCents <= 0 || totalCents > invoice.total_cents) {
      return err(new ValidationError(
        'Credit note amount must be positive and not exceed invoice total',
        'totalCents'
      ));
    }

    // Generar serie y número para nota de crédito
    // Las notas de crédito usan serie similar a facturas (FC01, BC01)
    const creditNoteType: InvoiceType = invoice.invoice_type as InvoiceType;
    const seriesPrefix = creditNoteType === 'FACTURA' ? 'FC' : 'BC';
    const series = `${seriesPrefix}${DEFAULT_SERIES_NUMBER}`;

    // Obtener siguiente número de nota de crédito
    const lastCreditNote = await this.prisma.credit_notes.findFirst({
      where: {
        tenant_id: input.tenantId,
        series,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const lastNumber = lastCreditNote 
      ? parseInt(lastCreditNote.number, 10) 
      : 0;
    
    if (lastNumber >= MAX_CORRELATIVO) {
      return err(new DomainError(
        'Credit note series has reached maximum number',
        'SERIES_EXHAUSTED'
      ));
    }

    const creditNoteNumber = (lastNumber + 1).toString().padStart(8, '0');
    const creditNoteId = uuidv4();

    // Crear nota de crédito en transacción
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const creditNote = await tx.credit_notes.create({
          data: {
            id: creditNoteId,
            tenant_id: input.tenantId,
            invoice_id: input.invoiceId,
            series,
            number: creditNoteNumber,
            total_cents: totalCents,
            reason: input.reason,
            sunat_status: 'PENDING',
            status: 'ISSUED',
            created_by: input.generatedBy,
          },
        });

        // Nota: Los items de nota de crédito se almacenan en el payload del evento
        // para referencia. La tabla credit_note_items puede agregarse en futuras
        // migraciones si se requiere tracking detallado.

        // Publicar evento
        await tx.events.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            occurred_at: new Date(),
            type: 'CREDIT_NOTE_ISSUED',
            entity_type: 'CREDIT_NOTE',
            entity_id: creditNoteId,
            actor_id: input.generatedBy,
            actor_role_snapshot: 'SUPERVISOR',
            terminal_id: input.terminalId,
            payload: {
              credit_note_id: creditNoteId,
              invoice_id: input.invoiceId,
              series,
              number: creditNoteNumber,
              total_cents: totalCents,
              reason: input.reason,
            },
          },
        });

        // Agregar a cola de procesamiento SUNAT
        await tx.invoice_queue.create({
          data: {
            id: uuidv4(),
            tenant_id: input.tenantId,
            invoice_id: input.invoiceId,
            action: 'EMIT_CREDIT_NOTE',
            priority: 5,
            attempts: 0,
            max_attempts: 3,
            scheduled_at: new Date(),
            status: 'PENDING',
          },
        });

        return creditNote;
      }
    );

    if (!txResult.success) {
      return err(new DomainError(
        'Failed to generate credit note',
        'CREDIT_NOTE_GENERATION_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const creditNote = txResult.data;

    pinoLogger.info(
      {
        creditNoteId: creditNote.id,
        series,
        number: creditNoteNumber,
        invoiceId: input.invoiceId,
        totalCents,
      },
      'Credit note generated successfully'
    );

    return ok({
      id: creditNote.id,
      tenantId: creditNote.tenant_id,
      invoiceId: creditNote.invoice_id,
      series: creditNote.series,
      number: creditNote.number,
      totalCents: creditNote.total_cents,
      reason: creditNote.reason,
      status: creditNote.status as CreditNoteStatus,
      sunatStatus: creditNote.sunat_status as SunatStatus,
      createdAt: creditNote.created_at,
    });
  }

  // ==========================================================================
  // Métodos Privados - Validaciones
  // ==========================================================================

  private validateEmitInvoiceInput(
    input: EmitInvoiceInput
  ): Result<void, ValidationError> {
    if (!input.orderId) {
      return err(new ValidationError('Order ID is required', 'orderId'));
    }

    if (!input.checkId) {
      return err(new ValidationError('Check ID is required', 'checkId'));
    }

    if (!['BOLETA', 'FACTURA'].includes(input.invoiceType)) {
      return err(new ValidationError(
        'Invoice type must be BOLETA or FACTURA',
        'invoiceType'
      ));
    }

    if (!input.paymentSummary || input.paymentSummary.totalCents <= 0) {
      return err(new ValidationError(
        'Valid payment summary with positive total is required',
        'paymentSummary'
      ));
    }

    // Validar documento según tipo de comprobante
    if (input.invoiceType === 'FACTURA') {
      if (!input.customerDocType || !input.customerDoc) {
        return err(new ValidationError(
          'RUC is required for FACTURA',
          'customerDoc'
        ));
      }
      if (input.customerDocType !== 'RUC' || input.customerDoc.length !== 11) {
        return err(new ValidationError(
          'FACTURA requires valid RUC (11 digits)',
          'customerDoc'
        ));
      }
    }

    if (input.invoiceType === 'BOLETA' && input.customerDoc) {
      if (!input.customerDocType) {
        return err(new ValidationError(
          'Document type is required when document is provided',
          'customerDocType'
        ));
      }
      if (input.customerDocType === 'DNI' && input.customerDoc.length !== 8) {
        return err(new ValidationError(
          'DNI must be 8 digits',
          'customerDoc'
        ));
      }
    }

    return ok(undefined);
  }

  private async validateOrderForInvoice(
    input: EmitInvoiceInput
  ): Promise<Result<void, DomainError>> {
    const order = await this.prisma.orders.findFirst({
      where: {
        id: input.orderId,
        tenant_id: input.tenantId,
      },
    });

    if (!order) {
      return err(new NotFoundError('Order', input.orderId));
    }

    // Verificar que la orden esté pagada
    // En PARK POS, las órdenes pagadas tienen checks pagados
    const checks = order.checks as any[];
    const targetCheck = checks?.find((c: any) => c.check_id === input.checkId);

    if (!targetCheck) {
      return err(new NotFoundError('Check', input.checkId));
    }

    if (targetCheck.payment?.status !== 'PAID') {
      return err(new ValidationError(
        'Cannot emit invoice for unpaid check',
        'check_id'
      ));
    }

    return ok(undefined);
  }

  // ==========================================================================
  // Métodos Privados - Generación de Series
  // ==========================================================================

  private async generateNextSeriesNumber(
    tenantId: string,
    invoiceType: InvoiceType
  ): Promise<Result<{ series: string; invoiceNumber: string }, DomainError>> {
    const seriesPrefix = SERIES_PREFIX[invoiceType];
    const series = `${seriesPrefix}${DEFAULT_SERIES_NUMBER}`;

    try {
      // Bloqueo pesimista con consulta raw para evitar race conditions
      const result = await this.prisma.$transaction(async (tx) => {
        // Obtener última factura de esta serie
        const lastInvoice = await tx.invoices.findFirst({
          where: {
            tenant_id: tenantId,
            series,
          },
          orderBy: {
            created_at: 'desc',
          },
        });

        const lastNumber = lastInvoice?.invoice_number 
          ? parseInt(lastInvoice.invoice_number, 10) 
          : 0;

        if (lastNumber >= MAX_CORRELATIVO) {
          throw new Error('Series has reached maximum number');
        }

        const nextNumber = lastNumber + 1;
        const invoiceNumber = nextNumber.toString().padStart(8, '0');

        return { series, invoiceNumber };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return ok(result);
    } catch (error) {
      return err(new DomainError(
        'Failed to generate series number',
        'SERIES_GENERATION_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }

  // ==========================================================================
  // Métodos Privados - Utilidades
  // ==========================================================================

  private mapInvoiceToResult(invoice: any): InvoiceResult {
    return {
      id: invoice.id,
      tenantId: invoice.tenant_id,
      orderId: invoice.order_id,
      checkId: invoice.check_id,
      invoiceType: invoice.invoice_type as InvoiceType,
      series: invoice.series || '',
      invoiceNumber: invoice.invoice_number || '',
      customerDocType: invoice.customer_doc_type || undefined,
      customerDoc: invoice.customer_doc || undefined,
      totalCents: invoice.total_cents,
      paymentSummary: invoice.payment_summary as PaymentSummary,
      status: invoice.status as InvoiceStatus,
      sunatStatus: 'PENDING', // Se actualiza vía consulta separada
      createdAt: invoice.created_at,
    };
  }

  private mapQueueStatusToSunatStatus(queueStatus: string): SunatStatus {
    switch (queueStatus) {
      case 'PROCESSED':
        return 'ACCEPTED';
      case 'FAILED':
        return 'REJECTED';
      case 'PENDING':
      case 'PROCESSING':
      default:
        return 'PENDING';
    }
  }

  private async invalidateInvoiceCaches(
    tenantId: string,
    invoiceId: string,
    orderId: string
  ): Promise<void> {
    await Promise.all([
      this.cache.del(CACHE_KEYS.INVOICE(tenantId, invoiceId)),
      this.cache.del(CACHE_KEYS.ORDER_INVOICES(tenantId, orderId)),
      this.cache.del(CACHE_KEYS.SUNAT_STATUS(tenantId, invoiceId)),
    ]);
  }

  // ==========================================================================
  // Métodos Públicos Adicionales - Consultas
  // ==========================================================================

  /**
   * Obtiene todas las facturas de una orden
   * 
   * @param tenantId - ID del tenant
   * @param orderId - ID de la orden
   * @returns Result<InvoiceResult[], DomainError>
   */
  async getInvoicesByOrder(
    tenantId: string,
    orderId: string
  ): Promise<Result<InvoiceResult[], DomainError>> {
    const cacheKey = CACHE_KEYS.ORDER_INVOICES(tenantId, orderId);

    // Intentar cache
    const cached = await this.cache.get<InvoiceResult[]>(cacheKey);
    if (cached) {
      return ok(cached);
    }

    const invoices = await this.prisma.invoices.findMany({
      where: {
        tenant_id: tenantId,
        order_id: orderId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const results = invoices.map(inv => this.mapInvoiceToResult(inv));

    // Cachear por 2 minutos
    await this.cache.set(cacheKey, results, 120);

    return ok(results);
  }

  /**
   * Obtiene estadísticas de facturación por tenant
   * 
   * @param tenantId - ID del tenant
   * @param startDate - Fecha inicio (opcional)
   * @param endDate - Fecha fin (opcional)
   * @returns Result<InvoiceStats, DomainError>
   */
  async getInvoiceStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Result<{
    totalCount: number;
    totalAmountCents: number;
    boletaCount: number;
    facturaCount: number;
    voidedCount: number;
    pendingSunatCount: number;
  }, DomainError>> {
    try {
      const where: any = {
        tenant_id: tenantId,
      };

      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = startDate;
        if (endDate) where.created_at.lte = endDate;
      }

      const [
        totalResult,
        byTypeResult,
        voidedCount,
        pendingCount,
      ] = await Promise.all([
        // Total facturas y monto
        this.prisma.invoices.aggregate({
          where,
          _count: { id: true },
          _sum: { total_cents: true },
        }),

        // Conteo por tipo
        this.prisma.invoices.groupBy({
          by: ['invoice_type'],
          where,
          _count: { id: true },
        }),

        // Facturas anuladas
        this.prisma.invoices.count({
          where: {
            ...where,
            status: 'VOIDED',
          },
        }),

        // Pendientes SUNAT (sin CDR)
        this.prisma.invoices.count({
          where: {
            ...where,
            status: 'ISSUED',
            NOT: {
              invoice_cdr: {
                some: {
                  response_code: '0',
                },
              },
            },
          },
        }),
      ]);

      const stats = {
        totalCount: totalResult._count.id,
        totalAmountCents: totalResult._sum.total_cents || 0,
        boletaCount: byTypeResult.find(t => t.invoice_type === 'BOLETA')?._count.id || 0,
        facturaCount: byTypeResult.find(t => t.invoice_type === 'FACTURA')?._count.id || 0,
        voidedCount,
        pendingSunatCount: pendingCount,
      };

      return ok(stats);
    } catch (error) {
      return err(new DomainError(
        'Failed to fetch invoice statistics',
        'STATS_FETCH_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }

  /**
   * Obtiene items pendientes de procesar en la cola SUNAT
   * 
   * @param tenantId - ID del tenant
   * @param limit - Límite de resultados
   * @returns Result<Array de items en cola, DomainError>
   */
  async getPendingQueueItems(
    tenantId: string,
    limit = 50
  ): Promise<Result<Array<{
    id: string;
    invoiceId: string;
    action: string;
    priority: number;
    attempts: number;
    status: string;
    scheduledAt: Date;
    lastError?: string;
  }>, DomainError>> {
    try {
      const items = await this.prisma.invoice_queue.findMany({
        where: {
          tenant_id: tenantId,
          status: { in: ['PENDING', 'FAILED'] },
          attempts: { lt: 3 },
          scheduled_at: { lte: new Date() },
        },
        orderBy: [
          { priority: 'asc' },
          { scheduled_at: 'asc' },
        ],
        take: limit,
      });

      return ok(items.map(item => ({
        id: item.id,
        invoiceId: item.invoice_id,
        action: item.action,
        priority: item.priority,
        attempts: item.attempts,
        status: item.status,
        scheduledAt: item.scheduled_at,
        lastError: item.last_error || undefined,
      })));
    } catch (error) {
      return err(new DomainError(
        'Failed to fetch queue items',
        'QUEUE_FETCH_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const invoiceService = new InvoiceService(
  prisma
);
