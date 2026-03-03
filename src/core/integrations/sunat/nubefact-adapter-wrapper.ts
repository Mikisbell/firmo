/**
 * Nubefact Adapter Wrapper
 *
 * Thin wrapper around the existing NubefactAdapter that implements the
 * unified InvoiceProvider interface. Translates between SunatDocumentResult
 * and NubefactResponse types.
 *
 * Nubefact handles daily summaries internally, so sendDailySummary is a stub.
 *
 * @module core/integrations/sunat/nubefact-adapter-wrapper
 */

import { Result, ok, err, DomainError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { NubefactAdapter } from './nubefact-adapter';
import type { NubefactResponse, NubefactVoidRequest } from './nubefact-adapter';
import type { InvoiceProvider } from './provider-router';
import type { SunatDocumentResult, CreditNoteData, VoidData, DailySummaryData, TicketStatusResult } from './sunat-direct-adapter';
import type { InvoiceData } from './client';

// ============================================================================
// NubefactAdapterWrapper
// ============================================================================

export class NubefactAdapterWrapper implements InvoiceProvider {
  private adapter: NubefactAdapter;
  private logger;

  constructor(token: string, baseUrl: string) {
    this.adapter = new NubefactAdapter(token, baseUrl);
    this.logger = pinoLogger.child
      ? pinoLogger.child({ module: 'nubefact-adapter-wrapper' })
      : pinoLogger;
  }

  /**
   * Send an invoice via Nubefact API.
   * Builds NubefactInvoiceRequest from InvoiceData and maps the response.
   */
  async sendInvoice(data: InvoiceData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: data.tipo };
    this.logger.info(traceCtx, 'Sending invoice via Nubefact');

    const request = NubefactAdapter.buildInvoiceRequest({
      invoiceType: data.tipo === '01' ? 'FACTURA' : 'BOLETA',
      series: data.serie,
      number: data.numero,
      customerDocType: data.tipoDocumentoCliente === '6' ? 'RUC' : 'DNI',
      customerDoc: data.numeroDocumentoCliente,
      customerName: data.razonSocialCliente,
      customerAddress: data.direccionCliente ?? '',
      date: new Date(data.fechaEmision),
      items: data.items.map((item) => ({
        code: item.codigo,
        name: item.descripcion,
        qty: item.cantidad,
        unitPriceCents: item.precioUnitario,
      })),
      igvRate: 18,
    });

    const result = await this.adapter.sendInvoice(request);

    if (!result.success) {
      return result;
    }

    return ok(this.mapNubefactResponse(result.data));
  }

  /**
   * Send a credit note via Nubefact API.
   * Nubefact handles credit notes as a special invoice type.
   */
  async sendCreditNote(data: CreditNoteData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: '07' };
    this.logger.info(traceCtx, 'Sending credit note via Nubefact');

    // Nubefact treats credit notes as special invoice requests
    // Build request similar to invoice but with credit note fields
    const request = NubefactAdapter.buildInvoiceRequest({
      invoiceType: data.invoiceReference.tipo === '01' ? 'FACTURA' : 'BOLETA',
      series: data.serie,
      number: data.numero,
      customerDocType: data.tipoDocumentoCliente === '6' ? 'RUC' : 'DNI',
      customerDoc: data.numeroDocumentoCliente,
      customerName: data.razonSocialCliente,
      customerAddress: '',
      date: new Date(data.fechaEmision),
      items: data.items.map((item) => ({
        code: item.codigo,
        name: item.descripcion,
        qty: item.cantidad,
        unitPriceCents: item.precioUnitario,
      })),
      igvRate: 18,
    });

    const result = await this.adapter.sendInvoice(request);

    if (!result.success) {
      return result;
    }

    return ok(this.mapNubefactResponse(result.data));
  }

  /**
   * Send a void communication via Nubefact API.
   */
  async sendVoidCommunication(data: VoidData): Promise<Result<SunatDocumentResult, DomainError>> {
    const traceCtx = { serie: data.serie, numero: data.numero, tipo: 'RA' };
    this.logger.info(traceCtx, 'Sending void communication via Nubefact');

    const request: NubefactVoidRequest = {
      operacion: 'generar_anulacion',
      tipo_de_comprobante: data.tipo === '01' ? 1 : 2,
      serie: data.serie,
      numero: data.numero,
      motivo: data.motivo,
      codigo_de_anulacion: '01', // 01 = Anulacion de la operacion
    };

    const result = await this.adapter.sendVoid(request);

    if (!result.success) {
      return result;
    }

    return ok(this.mapNubefactResponse(result.data));
  }

  /**
   * Nubefact handles daily summaries internally.
   * This is a stub that returns an error indicating it's not supported.
   */
  async sendDailySummary(_data: DailySummaryData): Promise<Result<SunatDocumentResult, DomainError>> {
    this.logger.info({}, 'Daily summary not needed for Nubefact (handled internally)');

    return err(new DomainError(
      'Nubefact maneja resumenes diarios internamente. No se requiere envio manual.',
      'NUBEFACT_DAILY_SUMMARY_NOT_NEEDED',
    ));
  }

  /**
   * Query ticket status - not applicable for Nubefact.
   * Nubefact returns results synchronously.
   */
  async queryTicketStatus(_ticketNumber: string): Promise<Result<TicketStatusResult, DomainError>> {
    return err(new DomainError(
      'Nubefact no usa tickets asincrónicos',
      'NUBEFACT_NO_TICKET_SUPPORT',
    ));
  }

  /**
   * Test connection to Nubefact API.
   * Attempts a minimal API call to verify credentials.
   */
  async testConnection(): Promise<Result<{ message: string }, DomainError>> {
    try {
      // Try a minimal request to verify the token/URL
      const response = await fetch(this.adapter['baseUrl'], {
        method: 'OPTIONS',
        headers: {
          Authorization: `Bearer ${this.adapter['token']}`,
        },
      });

      // Any response (even 405) means connectivity works
      return ok({ message: 'Conexion exitosa con Nubefact API' });
    } catch (error) {
      return err(new DomainError(
        `Error de conexion con Nubefact: ${(error as Error).message}`,
        'NUBEFACT_CONNECTION_ERROR',
      ));
    }
  }

  // ============================================================================
  // Private: Response Mapping
  // ============================================================================

  /**
   * Map NubefactResponse to unified SunatDocumentResult.
   */
  private mapNubefactResponse(response: NubefactResponse): SunatDocumentResult {
    return {
      success: response.aceptada_por_sunat,
      cdrResponseCode: response.sunat_responsecode || '0',
      cdrResponseMessage: response.sunat_description || 'Aceptado por SUNAT via Nubefact',
      cdrXml: response.cdr_zip_base64 || '',
      hash: response.codigo_hash || '',
      signedXml: response.xml_zip_base64 || '',
      pdfBase64: response.pdf_zip_base64 || undefined,
      qrString: response.cadena_para_codigo_qr || undefined,
    };
  }
}
