/**
 * SunatDirectAdapter Unit Tests
 *
 * Tests the direct SUNAT SOAP integration adapter with mocked nodefact.
 * Validates: happy paths (boleta, factura, credit note), error handling,
 * data mapping (centavos -> soles), PDF/QR generation.
 *
 * @module core/integrations/sunat/__tests__/sunat-direct-adapter.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SunatDirectConfig, SunatDocumentResult, CreditNoteData, VoidData, DailySummaryData } from '../sunat-direct-adapter';
import type { InvoiceData } from '../client';

// ============================================================================
// Mock nodefact module
// ============================================================================

const mockSendBill = vi.fn();
const mockSendSummary = vi.fn();
const mockGetStatus = vi.fn();

vi.mock('nodefact', () => ({
  generateXML: vi.fn().mockReturnValue('<Invoice>mock-xml</Invoice>'),
  signXml: vi.fn().mockResolvedValue({
    success: true,
    signedXml: '<SignedInvoice>mock-signed-xml</SignedInvoice>',
  }),
  createSunatClient: vi.fn().mockReturnValue({
    sendBill: mockSendBill,
    sendSummary: mockSendSummary,
    getStatus: mockGetStatus,
  }),
  generatePdf: vi.fn().mockResolvedValue({
    success: true,
    buffer: Buffer.from('mock-pdf-content'),
  }),
  SunatEndpoints: {
    BETA_FACTURA: 'https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService',
    PRODUCCION_FACTURA: 'https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService',
  },
  TipoDocumento: {
    FACTURA: '01',
    BOLETA: '03',
    NOTA_CREDITO: '07',
    NOTA_DEBITO: '08',
    RESUMEN_DIARIO: 'RC',
    COMUNICACION_BAJA: 'RA',
  },
  TipoIGV: {
    GRAVADO_OPERACION_ONEROSA: '10',
  },
  TipoMoneda: {
    PEN: 'PEN',
    USD: 'USD',
  },
}));

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
// Test Fixtures
// ============================================================================

const testConfig: SunatDirectConfig = {
  ruc: '20123456789',
  solUser: 'MODDATOS',
  solPassword: 'moddatos',
  certificatePem: '-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----',
  privateKeyPem: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----',
  mode: 'BETA',
};

// InvoiceData uses CENTAVOS for money fields (project rule)
const testBoleta: InvoiceData = {
  serie: 'B001',
  numero: '00000001',
  tipo: '03',
  fechaEmision: '2026-03-02',
  tipoDocumentoCliente: '1',
  numeroDocumentoCliente: '12345678',
  razonSocialCliente: 'Juan Perez',
  moneda: 'PEN',
  totalGravadas: 4237,   // S/42.37 in centavos
  totalIgv: 763,          // S/7.63 in centavos
  totalImporte: 5000,     // S/50.00 in centavos
  items: [{
    codigo: 'POLLO001',
    descripcion: 'Pollo a la brasa 1/4',
    cantidad: 2,
    unidadMedida: 'NIU',
    precioUnitario: 2500,  // S/25.00 in centavos
    precioTotal: 5000,     // S/50.00 in centavos
    igv: 763,              // S/7.63 in centavos
  }],
};

const testFactura: InvoiceData = {
  ...testBoleta,
  serie: 'F001',
  tipo: '01',
  tipoDocumentoCliente: '6',
  numeroDocumentoCliente: '20123456781',
  razonSocialCliente: 'Empresa SAC',
  direccionCliente: 'Av. Lima 123',
};

const testCreditNote: CreditNoteData = {
  serie: 'BC01',
  numero: '00000001',
  fechaEmision: '2026-03-02',
  invoiceReference: {
    serie: 'B001',
    numero: '00000001',
    tipo: '03',
  },
  motivo: 'Devolucion de producto',
  tipoDocumentoCliente: '1',
  numeroDocumentoCliente: '12345678',
  razonSocialCliente: 'Juan Perez',
  moneda: 'PEN',
  totalGravadas: 4237,
  totalIgv: 763,
  totalImporte: 5000,
  items: [{
    codigo: 'POLLO001',
    descripcion: 'Pollo a la brasa 1/4',
    cantidad: 2,
    unidadMedida: 'NIU',
    precioUnitario: 2500,
    precioTotal: 5000,
    igv: 763,
  }],
};

// ============================================================================
// Tests
// ============================================================================

describe('SunatDirectAdapter', () => {
  let adapter: InstanceType<typeof import('../sunat-direct-adapter').SunatDirectAdapterImpl>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset nodefact mocks to default success
    mockSendBill.mockResolvedValue({
      success: true,
      cdr: '<ApplicationResponse><cbc:ID>B001-00000001</cbc:ID></ApplicationResponse>',
    });

    mockSendSummary.mockResolvedValue({
      success: true,
      ticket: '202603021234567890',
    });

    mockGetStatus.mockResolvedValue({
      success: true,
      cdr: '<StatusResponse>OK</StatusResponse>',
    });

    // Dynamic import to ensure mocks are set up before module loads
    const { SunatDirectAdapterImpl } = await import('../sunat-direct-adapter');
    adapter = new SunatDirectAdapterImpl(testConfig);
  });

  // ==========================================================================
  // Happy Path: Boleta
  // ==========================================================================

  describe('sendInvoice - Boleta', () => {
    it('debe enviar boleta exitosamente a SUNAT', async () => {
      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cdrResponseCode).toBe('0');
        expect(result.data.signedXml).toBeDefined();
        expect(result.data.cdrXml).toContain('ApplicationResponse');
      }
    });

    it('debe incluir PDF en el resultado de boleta', async () => {
      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pdfBase64).toBeDefined();
        expect(result.data.pdfBase64!.length).toBeGreaterThan(0);
      }
    });

    it('debe incluir QR string en el resultado de boleta', async () => {
      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.qrString).toBeDefined();
        expect(result.data.qrString).toContain('20123456789');
        expect(result.data.qrString).toContain('03'); // tipo boleta
        expect(result.data.qrString).toContain('B001');
      }
    });
  });

  // ==========================================================================
  // Happy Path: Factura
  // ==========================================================================

  describe('sendInvoice - Factura', () => {
    it('debe enviar factura exitosamente a SUNAT', async () => {
      const result = await adapter.sendInvoice(testFactura);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cdrResponseCode).toBe('0');
        expect(result.data.success).toBe(true);
      }
    });

    it('debe usar tipo de documento correcto para factura', async () => {
      const { generateXML } = await import('nodefact');

      await adapter.sendInvoice(testFactura);

      expect(generateXML).toHaveBeenCalledWith(
        expect.anything(),
        '01', // TipoDocumento.FACTURA
      );
    });
  });

  // ==========================================================================
  // Happy Path: Credit Note
  // ==========================================================================

  describe('sendCreditNote', () => {
    it('debe enviar nota de credito exitosamente', async () => {
      const result = await adapter.sendCreditNote(testCreditNote);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cdrResponseCode).toBe('0');
        expect(result.data.signedXml).toBeDefined();
      }
    });

    it('debe usar tipo de documento "07" para nota de credito', async () => {
      const { generateXML } = await import('nodefact');

      await adapter.sendCreditNote(testCreditNote);

      expect(generateXML).toHaveBeenCalledWith(
        expect.anything(),
        '07', // TipoDocumento.NOTA_CREDITO
      );
    });
  });

  // ==========================================================================
  // Error Paths: SUNAT Rejection
  // ==========================================================================

  describe('SUNAT rejection handling', () => {
    it('debe mapear CDR code != "0" a SUNAT_REJECTED', async () => {
      mockSendBill.mockResolvedValue({
        success: false,
        error: 'El comprobante fue rechazado por SUNAT',
      });

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_REJECTED');
        expect(result.error.message).toContain('SUNAT rechazo');
      }
    });
  });

  // ==========================================================================
  // Error Paths: Timeout
  // ==========================================================================

  describe('SUNAT timeout handling', () => {
    it('debe mapear timeout a SUNAT_TIMEOUT', async () => {
      mockSendBill.mockRejectedValue(new Error('ECONNABORTED: Request timeout'));

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_TIMEOUT');
      }
    });

    it('debe mapear "timedout" a SUNAT_TIMEOUT', async () => {
      mockSendBill.mockRejectedValue(new Error('Request timedout after 30000ms'));

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_TIMEOUT');
      }
    });
  });

  // ==========================================================================
  // Error Paths: Certificate Expired
  // ==========================================================================

  describe('Certificate expired handling', () => {
    it('debe mapear error de certificado expirado a SUNAT_CERT_EXPIRED', async () => {
      mockSendBill.mockRejectedValue(new Error('Certificate expired: validity period ended'));

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_CERT_EXPIRED');
      }
    });
  });

  // ==========================================================================
  // Error Paths: HTTP 500
  // ==========================================================================

  describe('HTTP 500 handling', () => {
    it('debe mapear HTTP 500 a SUNAT_SERVER_ERROR (retryable)', async () => {
      mockSendBill.mockRejectedValue(new Error('HTTP 500 Internal Server Error'));

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_SERVER_ERROR');
      }
    });

    it('SUNAT_SERVER_ERROR debe ser retryable', async () => {
      const { SunatDirectAdapterImpl } = await import('../sunat-direct-adapter');
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_SERVER_ERROR')).toBe(true);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_TIMEOUT')).toBe(true);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_NETWORK_ERROR')).toBe(true);
    });
  });

  // ==========================================================================
  // Error Paths: HTTP 403
  // ==========================================================================

  describe('HTTP 403 handling', () => {
    it('debe mapear HTTP 403 a SUNAT_AUTH_FAILED (non-retryable)', async () => {
      mockSendBill.mockRejectedValue(new Error('HTTP 403 Forbidden'));

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_AUTH_FAILED');
      }
    });

    it('SUNAT_AUTH_FAILED NO debe ser retryable', async () => {
      const { SunatDirectAdapterImpl } = await import('../sunat-direct-adapter');
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_AUTH_FAILED')).toBe(false);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_REJECTED')).toBe(false);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_CERT_EXPIRED')).toBe(false);
    });
  });

  // ==========================================================================
  // Error Paths: Signing Error
  // ==========================================================================

  describe('Signing error handling', () => {
    it('debe retornar SUNAT_SIGNING_ERROR cuando firma falla', async () => {
      const { signXml } = await import('nodefact');
      vi.mocked(signXml).mockResolvedValueOnce({
        success: false,
        error: 'Invalid PEM certificate',
      });

      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_SIGNING_ERROR');
        expect(result.error.message).toContain('firmar XML');
      }
    });
  });

  // ==========================================================================
  // Data Mapping: Centavos Conversion
  // ==========================================================================

  describe('Data mapping - centavos to soles', () => {
    it('debe convertir centavos a soles correctamente en generateXML', async () => {
      const { generateXML } = await import('nodefact');

      await adapter.sendInvoice(testBoleta);

      expect(generateXML).toHaveBeenCalledWith(
        expect.objectContaining({
          totalGravadas: 42.37,     // 4237 centavos -> 42.37 soles
          totalIgv: 7.63,           // 763 centavos -> 7.63 soles
          totalVenta: 50.00,        // 5000 centavos -> 50.00 soles
        }),
        expect.anything(),
      );
    });

    it('debe mapear items con precios en soles', async () => {
      const { generateXML } = await import('nodefact');

      await adapter.sendInvoice(testBoleta);

      const callArgs = vi.mocked(generateXML).mock.calls[0][0] as Record<string, unknown>;
      const items = (callArgs as any).items;

      expect(items).toBeDefined();
      expect(items[0].precioUnitario).toBe(25); // 2500 centavos -> 25.00 soles
    });
  });

  // ==========================================================================
  // PDF and QR Generation
  // ==========================================================================

  describe('PDF/QR generation', () => {
    it('debe generar PDF aunque falle (non-blocking)', async () => {
      const { generatePdf } = await import('nodefact');
      vi.mocked(generatePdf).mockRejectedValueOnce(new Error('PDF generation failed'));

      const result = await adapter.sendInvoice(testBoleta);

      // Should still succeed even if PDF fails
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.pdfBase64).toBeUndefined();
      }
    });

    it('debe generar QR string con formato SUNAT correcto', async () => {
      const result = await adapter.sendInvoice(testBoleta);

      expect(result.success).toBe(true);
      if (result.success) {
        const parts = result.data.qrString!.split('|');
        expect(parts[0]).toBe('20123456789');  // RUC
        expect(parts[1]).toBe('03');           // Tipo (Boleta)
        expect(parts[2]).toBe('B001');         // Serie
        expect(parts[3]).toBe('00000001');     // Numero
        expect(parts[4]).toBe('7.63');         // IGV in soles
        expect(parts[5]).toBe('50.00');        // Total in soles
      }
    });
  });

  // ==========================================================================
  // Void Communication
  // ==========================================================================

  describe('sendVoidCommunication', () => {
    it('debe enviar comunicacion de baja exitosamente', async () => {
      const voidData: VoidData = {
        serie: 'B001',
        numero: '00000001',
        tipo: '03',
        motivo: 'Error en emision',
        fechaEmision: '2026-03-01',
        fechaComunicacion: '2026-03-02',
      };

      const result = await adapter.sendVoidCommunication(voidData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticketNumber).toBe('202603021234567890');
      }
    });
  });

  // ==========================================================================
  // Daily Summary
  // ==========================================================================

  describe('sendDailySummary', () => {
    it('debe enviar resumen diario exitosamente', async () => {
      const summaryData: DailySummaryData = {
        summaryNumber: 'RC-20260301-00001',
        summaryDate: '2026-03-02',
        referenceDate: '2026-03-01',
        ruc: '20123456789',
        razonSocial: 'Polleria El Sabroson SAC',
        boletas: [{
          serie: 'B001',
          numero: '00000001',
          tipoDocumentoCliente: '1',
          numeroDocumentoCliente: '12345678',
          totalGravadas: 4237,
          totalIgv: 763,
          totalImporte: 5000,
          estado: '1',
        }],
      };

      const result = await adapter.sendDailySummary(summaryData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticketNumber).toBe('202603021234567890');
        expect(result.data.signedXml).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Ticket Status Query
  // ==========================================================================

  describe('queryTicketStatus', () => {
    it('debe retornar ACCEPTED cuando SUNAT responde exitosamente', async () => {
      const result = await adapter.queryTicketStatus('202603021234567890');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('ACCEPTED');
      }
    });

    it('debe retornar PENDING cuando ticket esta en proceso', async () => {
      mockGetStatus.mockResolvedValue({
        success: false,
        error: 'El ticket esta en proceso de validacion',
      });

      const result = await adapter.queryTicketStatus('202603021234567890');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('PENDING');
      }
    });
  });

  // ==========================================================================
  // Test Connection
  // ==========================================================================

  describe('testConnection', () => {
    it('debe probar conexion exitosamente', async () => {
      const result = await adapter.testConnection();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.message).toContain('Conexion exitosa');
      }
    });

    it('debe retornar error cuando conexion falla', async () => {
      const { createSunatClient } = await import('nodefact');
      const failingGetStatus = vi.fn().mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      // First call: constructor, Second call: testConnection (creates BETA client)
      vi.mocked(createSunatClient)
        .mockReturnValueOnce({ sendBill: mockSendBill, sendSummary: mockSendSummary, getStatus: mockGetStatus } as any)
        .mockReturnValueOnce({ sendBill: mockSendBill, sendSummary: mockSendSummary, getStatus: failingGetStatus } as any);

      const { SunatDirectAdapterImpl } = await import('../sunat-direct-adapter');
      const failAdapter = new SunatDirectAdapterImpl(testConfig);

      const result = await failAdapter.testConnection();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SUNAT_NETWORK_ERROR');
      }
    });
  });

  // ==========================================================================
  // Static Helper: isRetryable
  // ==========================================================================

  describe('isRetryable', () => {
    it('debe identificar errores retryable correctamente', async () => {
      const { SunatDirectAdapterImpl } = await import('../sunat-direct-adapter');

      // Retryable
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_TIMEOUT')).toBe(true);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_SERVER_ERROR')).toBe(true);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_NETWORK_ERROR')).toBe(true);

      // Non-retryable
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_REJECTED')).toBe(false);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_AUTH_FAILED')).toBe(false);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_CERT_EXPIRED')).toBe(false);
      expect(SunatDirectAdapterImpl.isRetryable('SUNAT_SIGNING_ERROR')).toBe(false);
    });
  });
});
