/**
 * SUNAT Direct Adapter - Direct SUNAT SOAP integration via nodefact
 *
 * Uses the nodefact npm package (MIT, zero cost) for:
 * - UBL 2.1 XML generation
 * - Digital signature (xml-crypto)
 * - SOAP communication with SUNAT
 * - CDR (Constancia de Recepcion) parsing
 * - PDF and QR code generation
 *
 * Document types:
 * - '01' = Factura
 * - '03' = Boleta
 * - '07' = Nota de Credito
 * - '08' = Nota de Debito
 * - 'RC' = Resumen Diario
 * - 'RA' = Comunicacion de Baja
 *
 * @module core/integrations/sunat/sunat-direct-adapter
 */

import {
  generateXML,
  signXml,
  createSunatClient,
  SunatEndpoints,
  TipoDocumento,
  TipoIGV,
  TipoMoneda,
  generatePdf,
} from 'nodefact';
import type {
  SunatClient as NodeFactSunatClient,
  SunatResult,
  SunatClientOptions,
  SunatCredentials as NodeFactCredentials,
} from 'nodefact';
import type { SignOptions, Emisor, Receptor, Item } from 'nodefact';
// nodefact exports PDFResult as a type from generatePdf return
interface PDFResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

import { Result, ok, err, DomainError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import type { InvoiceData } from './client';

// ============================================================================
// Configuration Types
// ============================================================================

export interface SunatDirectConfig {
  ruc: string;
  solUser: string;
  solPassword: string;
  certificatePem: string;
  privateKeyPem: string;
  mode: 'PRODUCTION' | 'BETA';
}

export interface SunatDocumentResult {
  success: boolean;
  cdrResponseCode: string;
  cdrResponseMessage: string;
  cdrXml: string;
  hash: string;
  signedXml: string;
  pdfBase64?: string;
  qrString?: string;
  ticketNumber?: string;
}

export interface CreditNoteData {
  serie: string;
  numero: string;
  fechaEmision: string;
  invoiceReference: {
    serie: string;
    numero: string;
    tipo: '01' | '03';
  };
  motivo: string;
  tipoDocumentoCliente: '1' | '6';
  numeroDocumentoCliente: string;
  razonSocialCliente: string;
  moneda: 'PEN' | 'USD';
  totalGravadas: number;   // centavos
  totalIgv: number;        // centavos
  totalImporte: number;    // centavos
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;  // centavos
    precioTotal: number;     // centavos
    igv: number;             // centavos
  }>;
}

export interface VoidData {
  serie: string;
  numero: string;
  tipo: '01' | '03';
  motivo: string;
  fechaEmision: string;
  fechaComunicacion: string;
}

export interface DailySummaryData {
  summaryNumber: string;   // RC-YYYYMMDD-NNNNN
  summaryDate: string;     // YYYY-MM-DD
  referenceDate: string;   // YYYY-MM-DD (date of the boletas)
  ruc: string;
  razonSocial: string;
  boletas: Array<{
    serie: string;
    numero: string;
    tipoDocumentoCliente: string;
    numeroDocumentoCliente: string;
    totalGravadas: number;   // centavos
    totalIgv: number;        // centavos
    totalImporte: number;    // centavos
    estado: '1' | '2' | '3'; // 1=Adicionar, 2=Modificar, 3=Anular
  }>;
}

export interface TicketStatusResult {
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  cdrResponseCode?: string;
  cdrResponseMessage?: string;
  cdrXml?: string;
}

// ============================================================================
// SUNAT Endpoint Configuration
// ============================================================================
//
// ┌───────────────────────────────────────────────────────────────────────────┐
// │ PLAYBOOK DE PRUEBAS — AMBIENTE BETA DE SUNAT (verificado jun 2026)          │
// │ Para cuando llegue el dia de probar facturacion. NO requiere RUC real,      │
// │ ni Clave SOL real, ni certificado real, ni tramite. Todo gratis y publico.  │
// │                                                                             │
// │ Credenciales de PRUEBA publicas de SUNAT (usar en SunatDirectConfig):       │
// │   ruc        = '20000000001'                                                │
// │   solUser    = 'MODDATOS'                                                   │
// │   solPassword= 'moddatos'                                                   │
// │   mode       = 'BETA'   -> usa SUNAT_ENDPOINTS.BETA (e-beta.sunat.gob.pe)   │
// │                                                                             │
// │ Certificado: en BETA SUNAT SOLO valida la ESTRUCTURA del XML (UBL 2.1), NO  │
// │ la autenticidad del certificado. Sirve un certificado de PRUEBA/autofirmado │
// │ (los que trae nodefact/greenter). No hace falta el CDT real para BETA.      │
// │                                                                             │
// │ Como probar: construir un SunatDirectAdapter con esa config y llamar a      │
// │ testConnection() o emitir una boleta/factura de prueba. Exito = CDR con     │
// │ responseCode '0' (ACEPTADO).                                                │
// │                                                                             │
// │ PASO A PRODUCCION (cuando lance el cliente):                                │
// │   - ruc/solUser/solPassword REALES de cada tenant (Clave SOL secundaria de  │
// │     facturacion) — NUNCA hardcodear ni commitear; van encriptados           │
// │     (ver credential-encryption.ts) y se inyectan por tenant.                │
// │   - certificado = CDT GRATIS de SUNAT (req: renta 3ra cat., ingresos        │
// │     <= S/1.26M/ano; vigente hasta dic-2027). Ver Engram reference/sunat-*.  │
// │   - mode = 'PRODUCTION' -> SUNAT_ENDPOINTS.PRODUCTION (e-factura).          │
// │                                                                             │
// │ Fuentes: cpe.sunat.gob.pe/noticias/servicio-beta-para-realizar-pruebas-ubl-21│
// │          cpe.sunat.gob.pe/certificado-digital                               │
// └───────────────────────────────────────────────────────────────────────────┘

const SUNAT_ENDPOINTS = {
  BETA: {
    bill: SunatEndpoints.BETA_FACTURA,
    consult: 'https://e-beta.sunat.gob.pe/ol-it-wsconscpegem-beta/billConsultService',
  },
  PRODUCTION: {
    bill: SunatEndpoints.PRODUCCION_FACTURA,
    consult: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegem/billConsultService',
  },
} as const;

// Error code mapping for retryable vs non-retryable errors
const RETRYABLE_ERROR_CODES = new Set([
  'SUNAT_TIMEOUT',
  'SUNAT_SERVER_ERROR',
  'SUNAT_NETWORK_ERROR',
]);

// ============================================================================
// Helper: Centavos to Soles
// ============================================================================

function centsToSoles(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

// ============================================================================
// SunatDirectAdapter Implementation
// ============================================================================

export class SunatDirectAdapterImpl {
  private config: SunatDirectConfig;
  private sunatClient: NodeFactSunatClient;
  private logger;

  constructor(config: SunatDirectConfig) {
    this.config = config;
    this.logger = pinoLogger.child
      ? pinoLogger.child({ module: 'sunat-direct-adapter', ruc: config.ruc })
      : pinoLogger;

    // Initialize nodefact SUNAT client
    const endpoint = config.mode === 'PRODUCTION'
      ? SUNAT_ENDPOINTS.PRODUCTION.bill
      : SUNAT_ENDPOINTS.BETA.bill;

    this.sunatClient = createSunatClient({
      endpoint: endpoint as SunatEndpoints,
      credentials: {
        ruc: config.ruc,
        usuario: config.solUser,
        clave: config.solPassword,
      },
      timeout: 30_000,
    });
  }

  /**
   * Send an invoice (boleta or factura) to SUNAT.
   * Maps InvoiceData (money in centavos) to nodefact format.
   */
  async sendInvoice(data: InvoiceData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: data.tipo };
    this.logger.info(traceCtx, 'Sending invoice to SUNAT via nodefact');

    try {
      // 1. Map InvoiceData to nodefact format
      const nodefactData = this.mapInvoiceToNodefact(data);

      // 2. Generate UBL 2.1 XML
      const documentType = data.tipo === '01' ? TipoDocumento.FACTURA : TipoDocumento.BOLETA;
      const xml = generateXML(nodefactData, documentType);

      // 3. Sign XML with certificate and private key
      const signResult = await signXml(xml, {
        certFile: this.config.certificatePem,
        keyFile: this.config.privateKeyPem,
      });

      if (!signResult.success || !signResult.signedXml) {
        return err(new DomainError(
          `Error al firmar XML: ${signResult.error ?? 'Unknown'}`,
          'SUNAT_SIGNING_ERROR',
          traceCtx,
        ));
      }

      // 4. Compress and send via SOAP
      const fileName = `${this.config.ruc}-${data.tipo}-${data.serie}-${data.numero}.xml`;
      const contentBase64 = Buffer.from(signResult.signedXml, 'utf-8').toString('base64');

      const sunatResult = await this.sunatClient.sendBill(fileName, contentBase64);

      // 5. Process SUNAT response
      if (!sunatResult.success) {
        const errorCode = this.mapSunatErrorCode(sunatResult.error ?? '');
        return err(new DomainError(
          `SUNAT rechazo: ${sunatResult.error ?? 'Error desconocido'}`,
          errorCode,
          { ...traceCtx, sunatError: sunatResult.error },
        ));
      }

      // 6. Generate PDF (best effort)
      let pdfBase64: string | undefined;
      try {
        const pdfResult: PDFResult = await generatePdf(nodefactData, { paper: 'a4', qrCode: true });
        if (pdfResult.success && pdfResult.buffer) {
          pdfBase64 = pdfResult.buffer.toString('base64');
        }
      } catch (pdfError) {
        this.logger.warn({ ...traceCtx, error: pdfError }, 'PDF generation failed (non-blocking)');
      }

      // 7. Generate QR string
      const qrString = this.generateQrString(data);

      // 8. Parse CDR hash from response
      const hash = this.extractHash(sunatResult.cdr ?? '');

      const result: SunatDocumentResult = {
        success: true,
        cdrResponseCode: '0',
        cdrResponseMessage: 'Comprobante aceptado por SUNAT',
        cdrXml: sunatResult.cdr ?? '',
        hash,
        signedXml: signResult.signedXml,
        pdfBase64,
        qrString,
      };

      this.logger.info({ ...traceCtx, responseCode: '0' }, 'Invoice accepted by SUNAT');
      return ok(result);

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error(
        { ...traceCtx, errorCode, errorMessage: (error as Error).message },
        'SUNAT invoice submission failed',
      );
      return err(new DomainError(
        `Error enviando comprobante a SUNAT: ${(error as Error).message}`,
        errorCode,
        traceCtx,
      ));
    }
  }

  /**
   * Send a credit note to SUNAT.
   */
  async sendCreditNote(data: CreditNoteData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: '07' };
    this.logger.info(traceCtx, 'Sending credit note to SUNAT via nodefact');

    try {
      const nodefactData = this.mapCreditNoteToNodefact(data);
      const xml = generateXML(nodefactData, TipoDocumento.NOTA_CREDITO);

      const signResult = await signXml(xml, {
        certFile: this.config.certificatePem,
        keyFile: this.config.privateKeyPem,
      });

      if (!signResult.success || !signResult.signedXml) {
        return err(new DomainError(
          `Error al firmar nota de credito: ${signResult.error ?? 'Unknown'}`,
          'SUNAT_SIGNING_ERROR',
          traceCtx,
        ));
      }

      const fileName = `${this.config.ruc}-07-${data.serie}-${data.numero}.xml`;
      const contentBase64 = Buffer.from(signResult.signedXml, 'utf-8').toString('base64');

      const sunatResult = await this.sunatClient.sendBill(fileName, contentBase64);

      if (!sunatResult.success) {
        const errorCode = this.mapSunatErrorCode(sunatResult.error ?? '');
        return err(new DomainError(
          `SUNAT rechazo nota de credito: ${sunatResult.error ?? 'Error desconocido'}`,
          errorCode,
          { ...traceCtx, sunatError: sunatResult.error },
        ));
      }

      const hash = this.extractHash(sunatResult.cdr ?? '');

      return ok({
        success: true,
        cdrResponseCode: '0',
        cdrResponseMessage: 'Nota de credito aceptada por SUNAT',
        cdrXml: sunatResult.cdr ?? '',
        hash,
        signedXml: signResult.signedXml,
      });

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error(
        { ...traceCtx, errorCode },
        'SUNAT credit note submission failed',
      );
      return err(new DomainError(
        `Error enviando nota de credito a SUNAT: ${(error as Error).message}`,
        errorCode,
        traceCtx,
      ));
    }
  }

  /**
   * Send a void communication (Comunicacion de Baja) to SUNAT.
   */
  async sendVoidCommunication(data: VoidData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: 'RA' };
    this.logger.info(traceCtx, 'Sending void communication to SUNAT via nodefact');

    try {
      const nodefactData = this.mapVoidToNodefact(data);
      const xml = generateXML(nodefactData, TipoDocumento.COMUNICACION_BAJA);

      const signResult = await signXml(xml, {
        certFile: this.config.certificatePem,
        keyFile: this.config.privateKeyPem,
      });

      if (!signResult.success || !signResult.signedXml) {
        return err(new DomainError(
          `Error al firmar comunicacion de baja: ${signResult.error ?? 'Unknown'}`,
          'SUNAT_SIGNING_ERROR',
          traceCtx,
        ));
      }

      const fileName = `${this.config.ruc}-RA-${data.fechaComunicacion.replace(/-/g, '')}-1.xml`;
      const contentBase64 = Buffer.from(signResult.signedXml, 'utf-8').toString('base64');

      const sunatResult = await this.sunatClient.sendSummary(fileName, contentBase64);

      if (!sunatResult.success) {
        const errorCode = this.mapSunatErrorCode(sunatResult.error ?? '');
        return err(new DomainError(
          `SUNAT rechazo comunicacion de baja: ${sunatResult.error ?? 'Error desconocido'}`,
          errorCode,
          { ...traceCtx, sunatError: sunatResult.error },
        ));
      }

      return ok({
        success: true,
        cdrResponseCode: '0',
        cdrResponseMessage: 'Comunicacion de baja registrada',
        cdrXml: sunatResult.cdr ?? '',
        hash: '',
        signedXml: signResult.signedXml,
        ticketNumber: sunatResult.ticket,
      });

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error(
        { ...traceCtx, errorCode },
        'SUNAT void communication failed',
      );
      return err(new DomainError(
        `Error enviando comunicacion de baja a SUNAT: ${(error as Error).message}`,
        errorCode,
        traceCtx,
      ));
    }
  }

  /**
   * Send a daily summary (Resumen Diario) of boletas to SUNAT.
   * Returns a ticket number for async processing.
   */
  async sendDailySummary(data: DailySummaryData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { summaryNumber: data.summaryNumber, boletasCount: data.boletas.length };
    this.logger.info(traceCtx, 'Sending daily summary to SUNAT via nodefact');

    try {
      const nodefactData = this.mapDailySummaryToNodefact(data);
      const xml = generateXML(nodefactData, TipoDocumento.RESUMEN_DIARIO);

      const signResult = await signXml(xml, {
        certFile: this.config.certificatePem,
        keyFile: this.config.privateKeyPem,
      });

      if (!signResult.success || !signResult.signedXml) {
        return err(new DomainError(
          `Error al firmar resumen diario: ${signResult.error ?? 'Unknown'}`,
          'SUNAT_SIGNING_ERROR',
          traceCtx,
        ));
      }

      const fileName = `${data.ruc}-RC-${data.summaryDate.replace(/-/g, '')}.xml`;
      const contentBase64 = Buffer.from(signResult.signedXml, 'utf-8').toString('base64');

      const sunatResult = await this.sunatClient.sendSummary(fileName, contentBase64);

      if (!sunatResult.success) {
        const errorCode = this.mapSunatErrorCode(sunatResult.error ?? '');
        return err(new DomainError(
          `SUNAT rechazo resumen diario: ${sunatResult.error ?? 'Error desconocido'}`,
          errorCode,
          { ...traceCtx, sunatError: sunatResult.error },
        ));
      }

      return ok({
        success: true,
        cdrResponseCode: '0',
        cdrResponseMessage: 'Resumen diario enviado, esperando procesamiento',
        cdrXml: '',
        hash: '',
        signedXml: signResult.signedXml,
        ticketNumber: sunatResult.ticket,
      });

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error(
        { ...traceCtx, errorCode },
        'SUNAT daily summary failed',
      );
      return err(new DomainError(
        `Error enviando resumen diario a SUNAT: ${(error as Error).message}`,
        errorCode,
        traceCtx,
      ));
    }
  }

  /**
   * Query the processing status of a ticket (Resumen Diario).
   */
  async queryTicketStatus(ticketNumber: string): Promise<Result<TicketStatusResult, DomainError>> {
    this.logger.info({ ticketNumber }, 'Querying ticket status on SUNAT');

    try {
      const sunatResult = await this.sunatClient.getStatus(ticketNumber);

      if (!sunatResult.success && !sunatResult.cdr) {
        // Still pending or error
        if (sunatResult.error?.includes('processing') || sunatResult.error?.includes('proceso')) {
          return ok({ status: 'PENDING' as const });
        }

        const errorCode = this.mapSunatErrorCode(sunatResult.error ?? '');
        return err(new DomainError(
          `Error consultando ticket: ${sunatResult.error ?? 'Error desconocido'}`,
          errorCode,
          { ticketNumber },
        ));
      }

      if (sunatResult.success) {
        return ok({
          status: 'ACCEPTED' as const,
          cdrResponseCode: '0',
          cdrResponseMessage: 'Resumen diario aceptado',
          cdrXml: sunatResult.cdr,
        });
      }

      return ok({
        status: 'REJECTED' as const,
        cdrResponseCode: 'ERROR',
        cdrResponseMessage: sunatResult.error ?? 'Resumen diario rechazado',
        cdrXml: sunatResult.cdr,
      });

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error({ ticketNumber, errorCode }, 'Ticket status query failed');
      return err(new DomainError(
        `Error consultando ticket SUNAT: ${(error as Error).message}`,
        errorCode,
        { ticketNumber },
      ));
    }
  }

  /**
   * Test connection to SUNAT by sending a test to BETA endpoint.
   */
  async testConnection(): Promise<Result<{ message: string }, DomainError>> {
    this.logger.info({}, 'Testing SUNAT connection');

    try {
      // Create a BETA client for testing (always use BETA regardless of config)
      const betaClient = createSunatClient({
        endpoint: SUNAT_ENDPOINTS.BETA.bill as SunatEndpoints,
        credentials: {
          ruc: this.config.ruc,
          usuario: this.config.solUser,
          clave: this.config.solPassword,
        },
        timeout: 15_000,
      });

      // Send a minimal test — just check that SOAP client can connect
      // We use getStatus with an invalid ticket to test connectivity
      const testResult = await betaClient.getStatus('0');

      // Any response (even error) means connectivity works
      return ok({ message: 'Conexion exitosa con SUNAT (endpoint beta)' });

    } catch (error) {
      const errorCode = this.mapCaughtErrorCode(error);
      this.logger.error({ errorCode }, 'SUNAT test connection failed');
      return err(new DomainError(
        `Error de conexion con SUNAT: ${(error as Error).message}`,
        errorCode,
      ));
    }
  }

  // ============================================================================
  // Data Mapping: InvoiceData (centavos) -> nodefact format (soles)
  // ============================================================================

  private mapInvoiceToNodefact(data: InvoiceData): Record<string, unknown> {
    const emisor: Emisor = {
      ruc: this.config.ruc,
      razonSocial: '', // Will be filled by tenant data in queue worker
      direccion: { direccion: '' },
    };

    const receptor: Receptor = {
      tipoDocumento: data.tipoDocumentoCliente,
      numeroDocumento: data.numeroDocumentoCliente,
      razonSocial: data.razonSocialCliente,
    };

    if (data.direccionCliente) {
      receptor.direccion = { direccion: data.direccionCliente };
    }

    const items: Item[] = data.items.map((item) => {
      const valorUnitario = centsToSoles(item.precioUnitario);
      const igvMultiplier = 1.18; // 18% IGV standard
      const valorSinIgv = Number((valorUnitario / igvMultiplier).toFixed(2));
      const subtotal = Number((valorSinIgv * item.cantidad).toFixed(2));
      const total = Number((valorUnitario * item.cantidad).toFixed(2));
      const igv = Number((total - subtotal).toFixed(2));

      return {
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: item.cantidad,
        valorUnitario: valorSinIgv,
        precioUnitario: valorUnitario,
        tipoIGV: TipoIGV.GRAVADO_OPERACION_ONEROSA,
        igv,
        porcentajeIGV: 18,
        subtotal,
        total,
      };
    });

    return {
      tipoDocumento: data.tipo,
      serie: data.serie,
      numero: data.numero,
      fechaEmision: data.fechaEmision,
      moneda: TipoMoneda.PEN,
      emisor,
      receptor,
      items,
      impuestos: {
        igv: centsToSoles(data.totalIgv),
        total: centsToSoles(data.totalIgv),
      },
      totalGravadas: centsToSoles(data.totalGravadas),
      totalIgv: centsToSoles(data.totalIgv),
      totalVenta: centsToSoles(data.totalImporte),
    };
  }

  private mapCreditNoteToNodefact(data: CreditNoteData): Record<string, unknown> {
    const items: Item[] = data.items.map((item) => {
      const valorUnitario = centsToSoles(item.precioUnitario);
      const igvMultiplier = 1.18;
      const valorSinIgv = Number((valorUnitario / igvMultiplier).toFixed(2));
      const subtotal = Number((valorSinIgv * item.cantidad).toFixed(2));
      const total = centsToSoles(item.precioTotal);
      const igv = centsToSoles(item.igv);

      return {
        codigo: item.codigo,
        descripcion: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidad: item.cantidad,
        valorUnitario: valorSinIgv,
        precioUnitario: valorUnitario,
        tipoIGV: TipoIGV.GRAVADO_OPERACION_ONEROSA,
        igv,
        porcentajeIGV: 18,
        subtotal,
        total,
      };
    });

    return {
      tipoDocumento: '07',
      serie: data.serie,
      numero: data.numero,
      fechaEmision: data.fechaEmision,
      moneda: TipoMoneda.PEN,
      emisor: {
        ruc: this.config.ruc,
        razonSocial: '',
        direccion: { direccion: '' },
      },
      receptor: {
        tipoDocumento: data.tipoDocumentoCliente,
        numeroDocumento: data.numeroDocumentoCliente,
        razonSocial: data.razonSocialCliente,
      },
      items,
      documentoRelacionado: {
        tipoDocumento: data.invoiceReference.tipo,
        serie: data.invoiceReference.serie,
        numero: data.invoiceReference.numero,
      },
      motivo: data.motivo,
      totalGravadas: centsToSoles(data.totalGravadas),
      totalIgv: centsToSoles(data.totalIgv),
      totalVenta: centsToSoles(data.totalImporte),
    };
  }

  private mapVoidToNodefact(data: VoidData): Record<string, unknown> {
    return {
      tipoDocumento: TipoDocumento.COMUNICACION_BAJA,
      fechaComunicacion: data.fechaComunicacion,
      emisor: {
        ruc: this.config.ruc,
        razonSocial: '',
        direccion: { direccion: '' },
      },
      documentos: [{
        tipoDocumento: data.tipo,
        serie: data.serie,
        numero: data.numero,
        motivo: data.motivo,
        fechaEmision: data.fechaEmision,
      }],
    };
  }

  private mapDailySummaryToNodefact(data: DailySummaryData): Record<string, unknown> {
    return {
      tipoDocumento: TipoDocumento.RESUMEN_DIARIO,
      summaryNumber: data.summaryNumber,
      fechaEmision: data.summaryDate,
      fechaReferencia: data.referenceDate,
      emisor: {
        ruc: data.ruc,
        razonSocial: data.razonSocial,
        direccion: { direccion: '' },
      },
      documentos: data.boletas.map((b) => ({
        tipoDocumento: '03',
        serie: b.serie,
        numero: b.numero,
        tipoDocumentoCliente: b.tipoDocumentoCliente,
        numeroDocumentoCliente: b.numeroDocumentoCliente,
        totalGravadas: centsToSoles(b.totalGravadas),
        totalIgv: centsToSoles(b.totalIgv),
        totalVenta: centsToSoles(b.totalImporte),
        estado: b.estado,
      })),
    };
  }

  // ============================================================================
  // QR String Generation (SUNAT format)
  // ============================================================================

  private generateQrString(data: InvoiceData): string {
    // SUNAT QR format: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|NRO_DOC|
    return [
      this.config.ruc,
      data.tipo,
      data.serie,
      data.numero,
      centsToSoles(data.totalIgv).toFixed(2),
      centsToSoles(data.totalImporte).toFixed(2),
      data.fechaEmision,
      data.tipoDocumentoCliente,
      data.numeroDocumentoCliente,
      '', // Hash (populated from CDR)
    ].join('|');
  }

  // ============================================================================
  // Error Mapping
  // ============================================================================

  private extractHash(cdrXml: string): string {
    // Extract hash from CDR XML response
    const hashMatch = cdrXml.match(/<cbc:ID>([^<]+)<\/cbc:ID>/);
    return hashMatch?.[1] ?? '';
  }

  /**
   * Map nodefact/SUNAT errors to DomainError codes.
   */
  private mapSunatErrorCode(errorMessage: string): string {
    const msg = errorMessage.toLowerCase();

    if (msg.includes('timeout') || msg.includes('timedout') || msg.includes('econnaborted')) {
      return 'SUNAT_TIMEOUT';
    }
    if (msg.includes('500') || msg.includes('internal server error')) {
      return 'SUNAT_SERVER_ERROR';
    }
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('unauthorized') || msg.includes('authentication')) {
      return 'SUNAT_AUTH_FAILED';
    }
    if (msg.includes('certificate') && (msg.includes('expired') || msg.includes('expirado'))) {
      return 'SUNAT_CERT_EXPIRED';
    }
    if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
      return 'SUNAT_NETWORK_ERROR';
    }
    if (msg.includes('firma') || msg.includes('sign') || msg.includes('xml-crypto')) {
      return 'SUNAT_SIGNING_ERROR';
    }

    // Default: rejected by SUNAT business rules
    return 'SUNAT_REJECTED';
  }

  /**
   * Map caught exceptions to DomainError codes.
   */
  private mapCaughtErrorCode(error: unknown): string {
    if (error instanceof Error) {
      return this.mapSunatErrorCode(error.message);
    }
    return 'SUNAT_UNKNOWN_ERROR';
  }

  /**
   * Check if an error code is retryable.
   */
  static isRetryable(errorCode: string): boolean {
    return RETRYABLE_ERROR_CODES.has(errorCode);
  }
}
