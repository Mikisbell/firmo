/**
 * Nubefact REST API Adapter
 *
 * Adapter for Nubefact's electronic invoicing API.
 * Translates our internal invoice format to Nubefact's REST format.
 *
 * @module core/integrations/sunat/nubefact-adapter
 */

import { Result, ok, err, DomainError } from '@/src/core/result';
import { pinoLogger } from '@/src/core/observability/logger-pino';

// ============================================================================
// Types
// ============================================================================

export interface NubefactInvoiceRequest {
  operacion: 'generar_comprobante';
  tipo_de_comprobante: 1 | 2; // 1=Factura, 2=Boleta
  serie: string;
  numero: string;
  sunat_transaction: 1; // 1=Venta interna
  cliente_tipo_de_documento: string; // 6=RUC, 1=DNI
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  fecha_de_emision: string; // dd-mm-yyyy
  moneda: 1; // 1=PEN
  porcentaje_de_igv: number;
  total_gravada: string;
  total_igv: string;
  total: string;
  items: NubefactItem[];
}

export interface NubefactItem {
  unidad_de_medida: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: string;
  precio_unitario: string;
  subtotal: string;
  tipo_de_igv: 1; // 1=Gravado - Operación Onerosa
  igv: string;
  total: string;
  anticipo_regularizacion: boolean;
}

export interface NubefactVoidRequest {
  operacion: 'generar_anulacion';
  tipo_de_comprobante: 1 | 2;
  serie: string;
  numero: string;
  motivo: string;
  codigo_de_anulacion: string;
}

export interface NubefactResponse {
  aceptada_por_sunat: boolean;
  sunat_description: string;
  sunat_note: string;
  sunat_responsecode: string;
  sunat_soap_error: string;
  cadena_para_codigo_qr: string;
  codigo_hash: string;
  pdf_zip_base64: string;
  xml_zip_base64: string;
  cdr_zip_base64: string;
  enlace: string;
  enlace_del_pdf: string;
  enlace_del_xml: string;
  enlace_del_cdr: string;
}

// ============================================================================
// Nubefact Adapter
// ============================================================================

export class NubefactAdapter {
  constructor(
    private token: string,
    private baseUrl: string,
  ) {}

  /**
   * Send an invoice to Nubefact API
   */
  async sendInvoice(
    request: NubefactInvoiceRequest,
  ): Promise<Result<NubefactResponse, DomainError>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        pinoLogger.error({ status: response.status, data }, 'Nubefact API error');
        return err(new DomainError(
          `Error de Nubefact: ${data.errors ?? response.statusText}`,
          'NUBEFACT_API_ERROR',
        ));
      }

      if (!data.aceptada_por_sunat && data.sunat_responsecode !== '0') {
        pinoLogger.warn({ data }, 'Invoice rejected by SUNAT via Nubefact');
        return err(new DomainError(
          `SUNAT rechazó: ${data.sunat_description}`,
          'SUNAT_REJECTED',
        ));
      }

      return ok(data as NubefactResponse);
    } catch (error) {
      pinoLogger.error({ error }, 'Nubefact request failed');
      return err(new DomainError('Error de conexión con Nubefact', 'NUBEFACT_CONNECTION_ERROR'));
    }
  }

  /**
   * Send a void request to Nubefact API
   */
  async sendVoid(
    request: NubefactVoidRequest,
  ): Promise<Result<NubefactResponse, DomainError>> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(request),
      });

      const data = await response.json();

      if (!response.ok) {
        return err(new DomainError(
          `Error de Nubefact: ${data.errors ?? response.statusText}`,
          'NUBEFACT_API_ERROR',
        ));
      }

      return ok(data as NubefactResponse);
    } catch (error) {
      pinoLogger.error({ error }, 'Nubefact void request failed');
      return err(new DomainError('Error de conexión con Nubefact', 'NUBEFACT_CONNECTION_ERROR'));
    }
  }

  /**
   * Format our cents to Nubefact's string soles format (2 decimal places)
   */
  static centsToSoles(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  /**
   * Build Nubefact invoice request from our internal format
   */
  static buildInvoiceRequest(params: {
    invoiceType: 'BOLETA' | 'FACTURA';
    series: string;
    number: string;
    customerDocType: string;
    customerDoc: string;
    customerName: string;
    customerAddress: string;
    date: Date;
    items: Array<{ code: string; name: string; qty: number; unitPriceCents: number }>;
    igvRate: number;
  }): NubefactInvoiceRequest {
    const igvMultiplier = 1 + params.igvRate / 100;

    const items: NubefactItem[] = params.items.map((item) => {
      const totalCents = item.unitPriceCents * item.qty;
      const baseCents = Math.round(totalCents / igvMultiplier);
      const igvCents = totalCents - baseCents;
      const unitBaseCents = Math.round(item.unitPriceCents / igvMultiplier);

      return {
        unidad_de_medida: 'NIU',
        codigo: item.code,
        descripcion: item.name,
        cantidad: item.qty,
        valor_unitario: NubefactAdapter.centsToSoles(unitBaseCents),
        precio_unitario: NubefactAdapter.centsToSoles(item.unitPriceCents),
        subtotal: NubefactAdapter.centsToSoles(baseCents),
        tipo_de_igv: 1,
        igv: NubefactAdapter.centsToSoles(igvCents),
        total: NubefactAdapter.centsToSoles(totalCents),
        anticipo_regularizacion: false,
      };
    });

    const totalCents = params.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
    const totalBaseCents = Math.round(totalCents / igvMultiplier);
    const totalIgvCents = totalCents - totalBaseCents;

    const docTypeMap: Record<string, string> = { RUC: '6', DNI: '1', CE: '4', PASAPORTE: '7' };

    const d = params.date;
    const fecha = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

    return {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: params.invoiceType === 'FACTURA' ? 1 : 2,
      serie: params.series,
      numero: params.number,
      sunat_transaction: 1,
      cliente_tipo_de_documento: docTypeMap[params.customerDocType] ?? '0',
      cliente_numero_de_documento: params.customerDoc,
      cliente_denominacion: params.customerName,
      cliente_direccion: params.customerAddress,
      fecha_de_emision: fecha,
      moneda: 1,
      porcentaje_de_igv: params.igvRate,
      total_gravada: NubefactAdapter.centsToSoles(totalBaseCents),
      total_igv: NubefactAdapter.centsToSoles(totalIgvCents),
      total: NubefactAdapter.centsToSoles(totalCents),
      items,
    };
  }
}
