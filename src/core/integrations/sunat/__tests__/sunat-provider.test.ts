/**
 * SUNAT Provider Tests
 *
 * Tests for provider config, nubefact adapter, receipt QR, and invoice PDF.
 *
 * @module core/integrations/sunat/__tests__/sunat-provider.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSunatProviderConfig, isMockProvider } from '../provider-config';
import { NubefactAdapter } from '../nubefact-adapter';
import { buildSunatQRString, generateSunatReceiptQR, type ReceiptQRParams } from '../receipt-qr';
import { generateInvoicePDFHtml, type InvoicePDFData } from '../invoice-pdf';

// Mock QR generator for receipt-qr tests
vi.mock('@/src/core/payments/qr-generator.service', () => ({
  qrGeneratorService: {
    generateGenericQR: vi.fn().mockResolvedValue({
      success: true,
      data: 'data:image/png;base64,MOCKQR',
    }),
  },
}));

vi.mock('@/src/core/observability/logger-pino', () => ({
  pinoLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// ============================================================================
// Provider Config Tests
// ============================================================================

describe('getSunatProviderConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('debe retornar mock como provider por defecto', () => {
    delete process.env.SUNAT_PROVIDER;
    const config = getSunatProviderConfig();
    expect(config.provider).toBe('mock');
  });

  it('debe retornar nubefact con token y URL', () => {
    process.env.SUNAT_PROVIDER = 'nubefact';
    process.env.NUBEFACT_TOKEN = 'test-token-123';
    process.env.NUBEFACT_URL = 'https://api.nubefact.com/v1';

    const config = getSunatProviderConfig();
    expect(config.provider).toBe('nubefact');
    expect(config.nubefact?.token).toBe('test-token-123');
    expect(config.nubefact?.url).toBe('https://api.nubefact.com/v1');
  });

  it('debe retornar sunat-direct con credenciales', () => {
    process.env.SUNAT_PROVIDER = 'sunat-direct';
    process.env.SUNAT_RUC = '20123456789';

    const config = getSunatProviderConfig();
    expect(config.provider).toBe('sunat-direct');
    expect(config.sunat?.ruc).toBe('20123456789');
  });

  it('isMockProvider debe ser true por defecto', () => {
    delete process.env.SUNAT_PROVIDER;
    expect(isMockProvider()).toBe(true);
  });

  it('isMockProvider debe ser false con nubefact', () => {
    process.env.SUNAT_PROVIDER = 'nubefact';
    expect(isMockProvider()).toBe(false);
  });
});

// ============================================================================
// Nubefact Adapter Tests
// ============================================================================

describe('NubefactAdapter', () => {
  describe('centsToSoles', () => {
    it('debe convertir centavos a soles con 2 decimales', () => {
      expect(NubefactAdapter.centsToSoles(1050)).toBe('10.50');
      expect(NubefactAdapter.centsToSoles(100)).toBe('1.00');
      expect(NubefactAdapter.centsToSoles(0)).toBe('0.00');
      expect(NubefactAdapter.centsToSoles(12345)).toBe('123.45');
    });
  });

  describe('buildInvoiceRequest', () => {
    it('debe construir request de factura correctamente', () => {
      const request = NubefactAdapter.buildInvoiceRequest({
        invoiceType: 'FACTURA',
        series: 'F001',
        number: '00000001',
        customerDocType: 'RUC',
        customerDoc: '20123456789',
        customerName: 'Empresa SAC',
        customerAddress: 'Av. Lima 123',
        date: new Date(2026, 1, 15), // Feb 15, 2026
        items: [
          { code: 'PROD-01', name: 'Pollo a la Brasa', qty: 2, unitPriceCents: 3500 },
        ],
        igvRate: 18,
      });

      expect(request.tipo_de_comprobante).toBe(1); // Factura
      expect(request.serie).toBe('F001');
      expect(request.numero).toBe('00000001');
      expect(request.cliente_tipo_de_documento).toBe('6'); // RUC
      expect(request.cliente_numero_de_documento).toBe('20123456789');
      expect(request.total).toBe('70.00');
      expect(request.items).toHaveLength(1);
      expect(request.fecha_de_emision).toBe('15-02-2026');
    });

    it('debe construir request de boleta correctamente', () => {
      const request = NubefactAdapter.buildInvoiceRequest({
        invoiceType: 'BOLETA',
        series: 'B001',
        number: '00000001',
        customerDocType: 'DNI',
        customerDoc: '12345678',
        customerName: 'Juan Pérez',
        customerAddress: '',
        date: new Date(2026, 0, 1),
        items: [
          { code: 'P1', name: 'Item 1', qty: 1, unitPriceCents: 1000 },
        ],
        igvRate: 18,
      });

      expect(request.tipo_de_comprobante).toBe(2); // Boleta
      expect(request.cliente_tipo_de_documento).toBe('1'); // DNI
    });

    it('debe calcular IGV correctamente', () => {
      const request = NubefactAdapter.buildInvoiceRequest({
        invoiceType: 'BOLETA',
        series: 'B001',
        number: '00000001',
        customerDocType: 'DNI',
        customerDoc: '12345678',
        customerName: 'Test',
        customerAddress: '',
        date: new Date(),
        items: [
          { code: 'P1', name: 'Item', qty: 1, unitPriceCents: 11800 },
        ],
        igvRate: 18,
      });

      expect(request.total).toBe('118.00');
      expect(parseFloat(request.total_gravada) + parseFloat(request.total_igv)).toBeCloseTo(118.0, 1);
    });
  });

  describe('sendInvoice', () => {
    it('debe enviar factura y retornar respuesta exitosa', async () => {
      const mockResponse = {
        aceptada_por_sunat: true,
        sunat_description: 'Aceptada',
        sunat_note: '',
        sunat_responsecode: '0',
        sunat_soap_error: '',
        cadena_para_codigo_qr: 'test|qr',
        codigo_hash: 'ABC123',
        pdf_zip_base64: '',
        xml_zip_base64: '',
        cdr_zip_base64: '',
        enlace: '',
        enlace_del_pdf: '',
        enlace_del_xml: '',
        enlace_del_cdr: '',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const adapter = new NubefactAdapter('test-token', 'https://api.test.com');
      const result = await adapter.sendInvoice({} as any);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.aceptada_por_sunat).toBe(true);
        expect(result.data.codigo_hash).toBe('ABC123');
      }
    });

    it('debe retornar error si API falla', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ errors: 'Invalid data' }),
      });

      const adapter = new NubefactAdapter('test-token', 'https://api.test.com');
      const result = await adapter.sendInvoice({} as any);

      expect(result.success).toBe(false);
    });
  });
});

// ============================================================================
// Receipt QR Tests
// ============================================================================

describe('Receipt QR', () => {
  const baseParams: ReceiptQRParams = {
    ruc: '20123456789',
    invoiceType: 'BOLETA',
    series: 'B001',
    number: '00000001',
    igvCents: 1800,
    totalCents: 11800,
    date: new Date(2026, 1, 15),
    customerDocType: 'DNI',
    customerDoc: '12345678',
    hash: 'ABC123',
  };

  describe('buildSunatQRString', () => {
    it('debe generar string pipe-separated correcto para boleta', () => {
      const qr = buildSunatQRString(baseParams);
      const parts = qr.split('|');

      expect(parts).toHaveLength(10);
      expect(parts[0]).toBe('20123456789'); // RUC
      expect(parts[1]).toBe('03'); // Boleta
      expect(parts[2]).toBe('B001'); // Serie
      expect(parts[3]).toBe('00000001'); // Número
      expect(parts[4]).toBe('18.00'); // IGV
      expect(parts[5]).toBe('118.00'); // Total
      expect(parts[6]).toBe('2026-02-15'); // Fecha
      expect(parts[7]).toBe('1'); // Tipo doc (DNI)
      expect(parts[8]).toBe('12345678'); // Nro doc
      expect(parts[9]).toBe('ABC123'); // Hash
    });

    it('debe usar tipo 01 para factura', () => {
      const qr = buildSunatQRString({ ...baseParams, invoiceType: 'FACTURA' });
      const parts = qr.split('|');
      expect(parts[1]).toBe('01');
    });

    it('debe manejar doc type RUC como 6', () => {
      const qr = buildSunatQRString({ ...baseParams, customerDocType: 'RUC' });
      const parts = qr.split('|');
      expect(parts[7]).toBe('6');
    });

    it('debe usar dash para doc vacío', () => {
      const qr = buildSunatQRString({ ...baseParams, customerDoc: '' });
      const parts = qr.split('|');
      expect(parts[8]).toBe('-');
    });
  });

  describe('generateSunatReceiptQR', () => {
    it('debe generar QR data URL exitosamente', async () => {
      const result = await generateSunatReceiptQR(baseParams);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toContain('data:image/png;base64,');
      }
    });
  });
});

// ============================================================================
// Invoice PDF Tests
// ============================================================================

describe('Invoice PDF HTML', () => {
  const basePDFData: InvoicePDFData = {
    invoiceType: 'BOLETA',
    series: 'B001',
    number: '00000001',
    date: '2026-02-15',
    ruc: '20123456789',
    tenantName: 'Pollería El Dorado',
    tenantAddress: 'Av. Principal 123, Lima',
    customerName: 'Juan Pérez',
    customerDoc: '12345678',
    customerDocType: 'DNI',
    items: [
      { code: 'P01', name: 'Pollo a la Brasa', qty: 2, unitPriceCents: 3500, totalCents: 7000 },
      { code: 'P02', name: 'Inca Kola 1L', qty: 1, unitPriceCents: 800, totalCents: 800 },
    ],
    subtotalCents: 6610,
    igvCents: 1190,
    totalCents: 7800,
  };

  it('debe generar HTML con título de boleta', () => {
    const html = generateInvoicePDFHtml(basePDFData);
    expect(html).toContain('BOLETA DE VENTA ELECTRÓNICA');
    expect(html).toContain('B001-00000001');
  });

  it('debe generar HTML con título de factura', () => {
    const html = generateInvoicePDFHtml({ ...basePDFData, invoiceType: 'FACTURA', series: 'F001' });
    expect(html).toContain('FACTURA ELECTRÓNICA');
  });

  it('debe incluir datos del comercio', () => {
    const html = generateInvoicePDFHtml(basePDFData);
    expect(html).toContain('Pollería El Dorado');
    expect(html).toContain('20123456789');
    expect(html).toContain('Av. Principal 123, Lima');
  });

  it('debe incluir items con precios en soles', () => {
    const html = generateInvoicePDFHtml(basePDFData);
    expect(html).toContain('Pollo a la Brasa');
    expect(html).toContain('S/ 35.00');
    expect(html).toContain('Inca Kola 1L');
  });

  it('debe incluir totales correctos', () => {
    const html = generateInvoicePDFHtml(basePDFData);
    expect(html).toContain('S/ 66.10'); // Subtotal
    expect(html).toContain('S/ 11.90'); // IGV
    expect(html).toContain('S/ 78.00'); // Total
  });

  it('debe incluir QR si proporcionado', () => {
    const html = generateInvoicePDFHtml({
      ...basePDFData,
      qrDataUrl: 'data:image/png;base64,TEST',
    });
    expect(html).toContain('data:image/png;base64,TEST');
    expect(html).toContain('QR SUNAT');
  });

  it('debe omitir QR si no proporcionado', () => {
    const html = generateInvoicePDFHtml(basePDFData);
    expect(html).not.toContain('QR SUNAT');
  });

  it('debe incluir logo si proporcionado', () => {
    const html = generateInvoicePDFHtml({
      ...basePDFData,
      logoUrl: 'https://cdn.example.com/logo.png',
    });
    expect(html).toContain('https://cdn.example.com/logo.png');
  });
});
