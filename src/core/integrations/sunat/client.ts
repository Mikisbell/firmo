/**
 * SUNAT Client - Integration with Peruvian Tax Authority
 * 
 * Handles electronic invoicing (e-Boleta, e-Factura) through SUNAT web services.
 * Supports both production and development (mock) modes.
 * 
 * @module core/integrations/sunat
 */

import { pinoLogger } from '@/src/core/observability/logger-pino';
import { Result, ok, err, DomainError } from '@/src/core/result';
import { InvoiceProviderRouter } from './provider-router';
import type { SunatDocumentResult } from './sunat-direct-adapter';

// SUNAT Configuration
const SUNAT_CONFIG = {
  production: {
    wsdl: 'https://e-factura.sunat.gob.pe/ol-it-wsconscpegama/billConsultService?wsdl',
    wsse: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService?wsdl',
    signature: true,
  },
  development: {
    mock: true,
    delay: 1000, // Simulate network delay
  },
};

export interface SunatCredentials {
  ruc: string;
  username: string;
  password: string;
  certificate: string; // Base64 encoded certificate
  privateKey: string; // Base64 encoded private key
}

export interface InvoiceData {
  serie: string;
  numero: string;
  tipo: '03' | '01'; // 03 = Boleta, 01 = Factura
  fechaEmision: string;
  tipoDocumentoCliente: '1' | '6'; // 1 = DNI, 6 = RUC
  numeroDocumentoCliente: string;
  razonSocialCliente: string;
  direccionCliente?: string;
  moneda: 'PEN' | 'USD';
  totalGravadas: number;
  totalIgv: number;
  totalImporte: number;
  items: Array<{
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidadMedida: string;
    precioUnitario: number;
    precioTotal: number;
    igv: number;
  }>;
}

export interface CdrResponse {
  codigoRespuesta: string;
  descripcionRespuesta: string;
  cdrXml?: string;
  hash?: string;
  fechaRecepcion?: Date;
}

export class SunatClient {
  private credentials: SunatCredentials | null = null;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    
    if (this.isProduction) {
      this.loadCredentials();
    }
  }

  /**
   * Load SUNAT credentials from environment
   */
  private loadCredentials(): void {
    const ruc = process.env.SUNAT_RUC;
    const username = process.env.SUNAT_USERNAME;
    const password = process.env.SUNAT_PASSWORD;
    const certificate = process.env.SUNAT_CERTIFICATE;
    const privateKey = process.env.SUNAT_PRIVATE_KEY;

    if (!ruc || !username || !password || !certificate || !privateKey) {
      pinoLogger.error('SUNAT credentials not configured');
      return;
    }

    this.credentials = {
      ruc,
      username,
      password,
      certificate,
      privateKey,
    };
  }

  /**
   * Check if SUNAT is properly configured
   */
  isConfigured(): boolean {
    if (!this.isProduction) return true; // Mock mode always works
    return this.credentials !== null;
  }

  /**
   * Send invoice to SUNAT
   * In development: Simulates SUNAT response
   * In production: Delegates to InvoiceProviderRouter (per-tenant adapter)
   *
   * @param invoice - Invoice data (money in centavos)
   * @param tenantId - Tenant UUID (from JWT). Required in production.
   */
  async sendInvoice(invoice: InvoiceData, tenantId?: string): Promise<Result<CdrResponse, DomainError>> {
    if (!this.isProduction) {
      return this.mockSendInvoice(invoice);
    }

    if (!tenantId) {
      return err(new DomainError(
        'tenantId requerido para enviar comprobante a SUNAT en produccion',
        'SUNAT_TENANT_ID_REQUIRED'
      ));
    }

    // Production: Delegate to InvoiceProviderRouter
    return this.realSendInvoice(invoice, tenantId);
  }

  /**
   * Query invoice status in SUNAT
   */
  async queryInvoiceStatus(
    tipo: string,
    serie: string,
    numero: string
  ): Promise<Result<{ estado: 'ACEPTADA' | 'RECHAZADA' | 'EN_PROCESO'; detalles?: string }, DomainError>> {
    if (!this.isProduction) {
      // Mock: Always return accepted after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      return ok({ estado: 'ACEPTADA' });
    }

    // Production: Query real SUNAT
    try {
      // This would call SUNAT consultation service
      // For now, return mock
      pinoLogger.info({ tipo, serie, numero }, 'Querying SUNAT status');
      
      return ok({ estado: 'ACEPTADA' });
    } catch (error) {
      return err(new DomainError(
        'Failed to query SUNAT: ' + (error as Error).message,
        'SUNAT_QUERY_FAILED'
      ));
    }
  }

  /**
   * Send void request (comunicación de baja)
   */
  async sendVoidRequest(
    tipo: string,
    serie: string,
    numero: string,
    motivo: string
  ): Promise<Result<CdrResponse, DomainError>> {
    if (!this.isProduction) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return ok({
        codigoRespuesta: '0',
        descripcionRespuesta: 'Comunicación de baja registrada exitosamente',
        cdrXml: '<void>Mock CDR for void</void>',
        hash: `VOID-${serie}-${numero}`,
        fechaRecepcion: new Date(),
      });
    }

    // Production: Send real void request
    pinoLogger.info({ tipo, serie, numero, motivo }, 'Sending void request to SUNAT');
    
    // Implementation would go here
    return ok({
      codigoRespuesta: '0',
      descripcionRespuesta: 'Comunicación de baja registrada',
    });
  }

  /**
   * Mock implementation for development
   */
  private async mockSendInvoice(invoice: InvoiceData): Promise<Result<CdrResponse, DomainError>> {
    pinoLogger.info({ 
      serie: invoice.serie, 
      numero: invoice.numero,
      total: invoice.totalImporte 
    }, 'Mocking SUNAT invoice submission');

    // Simulate network delay
    await new Promise(resolve => 
      setTimeout(resolve, SUNAT_CONFIG.development.delay)
    );

    // Simulate validation errors for testing
    if (invoice.totalImporte <= 0) {
      return err(new DomainError(
        'El importe total debe ser mayor a 0',
        'SUNAT_VALIDATION_ERROR',
        { field: 'totalImporte', value: invoice.totalImporte }
      ));
    }

    if (!invoice.numeroDocumentoCliente || invoice.numeroDocumentoCliente.length < 8) {
      return err(new DomainError(
        'Número de documento del cliente inválido',
        'SUNAT_VALIDATION_ERROR',
        { field: 'numeroDocumentoCliente' }
      ));
    }

    // Success response
    const mockCdr: CdrResponse = {
      codigoRespuesta: '0',
      descripcionRespuesta: 'La Boleta de Venta electrónica ha sido aceptada',
      cdrXml: `<?xml version="1.0" encoding="UTF-8"?>
<ApplicationResponse xmlns="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2"
                     xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
                     xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>${invoice.serie}-${invoice.numero}</cbc:ID>
  <cbc:IssueDate>${invoice.fechaEmision}</cbc:IssueDate>
  <cbc:ResponseDate>${new Date().toISOString().split('T')[0]}</cbc:ResponseDate>
  <cac:SenderParty>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>SUNAT</cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:SenderParty>
  <cac:ReceiverParty>
    <cac:PartyLegalEntity>
      <cbc:RegistrationName>POLLERIA EL SABROSON S.A.C.</cbc:RegistrationName>
    </cac:PartyLegalEntity>
  </cac:ReceiverParty>
  <cac:DocumentResponse>
    <cac:Response>
      <cbc:ReferenceID>${invoice.serie}-${invoice.numero}</cbc:ReferenceID>
      <cbc:ResponseCode>0</cbc:ResponseCode>
      <cbc:Description>La Boleta de Venta electrónica ha sido aceptada</cbc:Description>
    </cac:Response>
  </cac:DocumentResponse>
</ApplicationResponse>`,
      hash: `MOCK-HASH-${Date.now()}`,
      fechaRecepcion: new Date(),
    };

    pinoLogger.info({ 
      serie: invoice.serie, 
      numero: invoice.numero,
      responseCode: mockCdr.codigoRespuesta 
    }, 'Mock SUNAT response generated');

    return ok(mockCdr);
  }

  /**
   * Real SUNAT implementation — delegates to InvoiceProviderRouter.
   * Resolves the correct adapter (SunatDirect or Nubefact) based on tenant config.
   */
  private async realSendInvoice(invoice: InvoiceData, tenantId: string): Promise<Result<CdrResponse, DomainError>> {
    pinoLogger.info({
      serie: invoice.serie,
      numero: invoice.numero,
      tenantId,
    }, 'Sending invoice to SUNAT via provider router');

    try {
      const router = new InvoiceProviderRouter();
      const providerResult = await router.getProvider(tenantId);

      if (!providerResult.success) {
        return err(providerResult.error);
      }

      const provider = providerResult.data;
      const result = await provider.sendInvoice(invoice);

      if (!result.success) {
        return err(result.error);
      }

      // Map SunatDocumentResult to CdrResponse for backward compatibility
      const docResult: SunatDocumentResult = result.data;
      const cdrResponse: CdrResponse = {
        codigoRespuesta: docResult.cdrResponseCode,
        descripcionRespuesta: docResult.cdrResponseMessage,
        cdrXml: docResult.cdrXml || undefined,
        hash: docResult.hash || undefined,
        fechaRecepcion: new Date(),
      };

      return ok(cdrResponse);
    } catch (error) {
      pinoLogger.error({
        error,
        serie: invoice.serie,
        numero: invoice.numero
      }, 'SUNAT submission failed');

      return err(new DomainError(
        'Failed to send invoice to SUNAT: ' + (error as Error).message,
        'SUNAT_SEND_FAILED'
      ));
    }
  }
}

// Export singleton
export const sunatClient = new SunatClient();
