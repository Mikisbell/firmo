/**
 * Unit Tests: Lógica de Negocio - Facturación SUNAT con Contingencia
 *
 * Valida la lógica pura de:
 * - Cálculo de totales de factura (subtotal, IGV, total)
 * - Generación de QR para SUNAT
 * - Modo contingencia (activación, desactivación, registro)
 * - Reintentos con backoff
 * - Validación de datos de factura
 * - Ventana de reconciliación (7 días)
 *
 * REQUISITOS CRÍTICOS:
 * - Dinero SIEMPRE en centavos (enteros)
 * - QR formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|NRO_DOC|
 * - Contingencia: 7 días para reconciliar
 * - Reintentos: máximo 3, backoff lineal 5min × attempt
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Tipos y constantes
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type InvoiceType = 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
type InvoiceStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY' | 'FAILED';
type ContingencyReason = 'SUNAT_UNREACHABLE' | 'NETWORK_OUTAGE' | 'CERTIFICATE_ERROR' | 'MANUAL_ACTIVATION';
type ContingencyStatus = 'ACTIVE' | 'INACTIVE';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;
const IGV_RATE = 0.18;
const SUNAT_DOCUMENT_TYPES: Record<InvoiceType, string> = {
  'FACTURA': '01',
  'BOLETA': '03',
  'NOTA_CREDITO': '07',
  'NOTA_DEBITO': '08',
};

const MAX_RETRIES = 3;
const RETRY_BASE_MINUTES = 5;
const RECONCILIATION_WINDOW_DAYS = 7;

interface InvoiceLine {
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: Centavos;
}

interface Invoice {
  invoiceId: string;
  ruc: string;
  invoiceType: InvoiceType;
  series: string;
  number: number;
  customerRuc: string;
  customerName: string;
  lines: InvoiceLine[];
  subtotalCents: Centavos;
  igvCents: Centavos;
  totalCents: Centavos;
  status: InvoiceStatus;
  createdAt: string;
}

interface ContingencyInvoice {
  invoiceId: string;
  registeredAt: string;
  reconcileBy: string; // deadline
  isOverdue: boolean;
}

interface RetryConfig {
  attempt: number;
  nextRetryAt: string;
  isRetryable: boolean;
  backoffMinutes: number;
}

// ============================================================
// Funciones puras de negocio
// ============================================================

/**
 * Calcula totales de factura con IGV
 */
function calculateInvoiceTotals(lines: InvoiceLine[]): {
  subtotalCents: Centavos;
  igvCents: Centavos;
  totalCents: Centavos;
} {
  if (lines.length === 0) {
    throw new Error('FACTURA_DEBE_TENER_ITEMS');
  }

  for (const line of lines) {
    if (line.quantity <= 0) {
      throw new Error(`CANTIDAD_INVALIDA: ${line.description}`);
    }
    if (line.unitPriceCents < 0) {
      throw new Error(`PRECIO_INVALIDO: ${line.description}`);
    }
  }

  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  ) as Centavos;

  const baseCents = centavos(Math.round(subtotalCents / (1 + IGV_RATE)));
  const igvCents = centavos(subtotalCents - baseCents);

  return {
    subtotalCents,
    igvCents,
    totalCents: subtotalCents,
  };
}

/**
 * Genera string QR para SUNAT
 * Formato: RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPO_DOC|NRO_DOC|
 */
function generateSunatQR(params: {
  ruc: string;
  invoiceType: InvoiceType;
  series: string;
  number: number;
  igvCents: Centavos;
  totalCents: Centavos;
  fecha: string;
}): string {
  const tipoDoc = SUNAT_DOCUMENT_TYPES[params.invoiceType];
  const totalSoles = (params.totalCents / 100).toFixed(2);
  const igvSoles = (params.igvCents / 100).toFixed(2);
  const fechaStr = params.fecha.split('T')[0]; // YYYY-MM-DD

  return `${params.ruc}|${tipoDoc}|${params.series}|${String(params.number).padStart(8, '0')}|${igvSoles}|${totalSoles}|${fechaStr}|${tipoDoc}|${String(params.number).padStart(8, '0')}|`;
}

/**
 * Valida datos de factura antes de enviar a SUNAT
 */
function validateInvoiceData(invoice: {
  invoiceType: InvoiceType;
  lines: InvoiceLine[];
  customerRuc: string;
  customerName: string;
}): string | null {
  if (invoice.lines.length === 0) {
    return 'FACTURA_SIN_ITEMS';
  }

  if (invoice.invoiceType === 'FACTURA' && (!invoice.customerName || invoice.customerName.trim() === '')) {
    return 'FACTURA_REQUIERE_NOMBRE_CLIENTE';
  }

  if (invoice.invoiceType === 'FACTURA' && (!invoice.customerRuc || invoice.customerRuc.length !== 11)) {
    return 'FACTURA_REQUIERE_RUC_VALIDO';
  }

  return null;
}

/**
 * Calcula configuración de reintento
 */
function calculateRetryConfig(attempt: number, error: string): RetryConfig {
  const retryableErrors = new Set(['SUNAT_TIMEOUT', 'SUNAT_SERVER_ERROR', 'SUNAT_NETWORK_ERROR']);
  const isRetryable = retryableErrors.has(error);

  if (!isRetryable || attempt >= MAX_RETRIES) {
    return {
      attempt,
      nextRetryAt: new Date().toISOString(),
      isRetryable: false,
      backoffMinutes: 0,
    };
  }

  const backoffMinutes = attempt * RETRY_BASE_MINUTES;
  const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString();

  return {
    attempt,
    nextRetryAt,
    isRetryable: true,
    backoffMinutes,
  };
}

/**
 * Calcula deadline de reconciliación para factura en contingencia
 */
function calculateReconciliationDeadline(registeredAt: Date): Date {
  const deadline = new Date(registeredAt);
  deadline.setDate(deadline.getDate() + RECONCILIATION_WINDOW_DAYS);
  return deadline;
}

/**
 * Determina si una factura de contingencia está vencida
 */
function isContingencyOverdue(reconcileBy: string, now?: Date): boolean {
  const deadline = new Date(reconcileBy);
  const currentTime = now || new Date();
  return currentTime > deadline;
}

/**
 * Determina si se debe activar contingencia automática
 */
function shouldActivateContingency(consecutiveFailures: number, threshold: number = 5): boolean {
  return consecutiveFailures >= threshold;
}

// ============================================================
// TESTS
// ============================================================

describe('SUNAT Invoicing - Business Logic', () => {

  // ----------------------------------------------------------
  // calculateInvoiceTotals
  // ----------------------------------------------------------

  describe('calculateInvoiceTotals', () => {

    it('should calculate totals correctly', () => {
      const lines: InvoiceLine[] = [
        { productId: '1', description: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
        { productId: '2', description: 'Inca Kola 1.5L', quantity: 2, unitPriceCents: 900 as Centavos },
      ];

      const totals = calculateInvoiceTotals(lines);

      expect(totals.subtotalCents).toBe(7300); // 5500 + 1800
      expect(totals.igvCents).toBe(1114); // 7300 - 6186
      expect(totals.totalCents).toBe(7300);
    });

    it('should throw for empty lines', () => {
      expect(() => calculateInvoiceTotals([])).toThrow('FACTURA_DEBE_TENER_ITEMS');
    });

    it('should reject negative prices', () => {
      const lines: InvoiceLine[] = [
        { productId: '1', description: 'Item', quantity: 1, unitPriceCents: -100 as Centavos },
      ];

      expect(() => calculateInvoiceTotals(lines)).toThrow('PRECIO_INVALIDO');
    });

    it('should reject zero or negative quantities', () => {
      const lines: InvoiceLine[] = [
        { productId: '1', description: 'Item', quantity: 0, unitPriceCents: 1000 as Centavos },
      ];

      expect(() => calculateInvoiceTotals(lines)).toThrow('CANTIDAD_INVALIDA');
    });
  });

  // ----------------------------------------------------------
  // generateSunatQR
  // ----------------------------------------------------------

  describe('generateSunatQR', () => {

    it('should generate valid QR string for BOLETA', () => {
      const qr = generateSunatQR({
        ruc: '20123456789',
        invoiceType: 'BOLETA',
        series: 'B001',
        number: 1,
        igvCents: 1800 as Centavos,
        totalCents: 11800 as Centavos,
        fecha: '2026-04-09T10:30:00',
      });

      expect(qr).toBe('20123456789|03|B001|00000001|18.00|118.00|2026-04-09|03|00000001|');
    });

    it('should generate valid QR string for FACTURA', () => {
      const qr = generateSunatQR({
        ruc: '20123456789',
        invoiceType: 'FACTURA',
        series: 'F001',
        number: 42,
        igvCents: 31864 as Centavos,
        totalCents: 208664 as Centavos,
        fecha: '2026-04-09T15:00:00',
      });

      expect(qr).toBe('20123456789|01|F001|00000042|318.64|2086.64|2026-04-09|01|00000042|');
    });

    it('should pad number with zeros to 8 digits', () => {
      const qr = generateSunatQR({
        ruc: '20123456789',
        invoiceType: 'BOLETA',
        series: 'B001',
        number: 123,
        igvCents: 100 as Centavos,
        totalCents: 1000 as Centavos,
        fecha: '2026-04-09T10:00:00',
      });

      expect(qr).toContain('00000123');
    });
  });

  // ----------------------------------------------------------
  // validateInvoiceData
  // ----------------------------------------------------------

  describe('validateInvoiceData', () => {

    it('should accept valid BOLETA', () => {
      const result = validateInvoiceData({
        invoiceType: 'BOLETA',
        lines: [{ productId: '1', description: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos }],
        customerRuc: '-',
        customerName: 'Cliente',
      });

      expect(result).toBeNull();
    });

    it('should reject BOLETA without items', () => {
      const result = validateInvoiceData({
        invoiceType: 'BOLETA',
        lines: [],
        customerRuc: '-',
        customerName: 'Cliente',
      });

      expect(result).toBe('FACTURA_SIN_ITEMS');
    });

    it('should reject FACTURA without customer name', () => {
      const result = validateInvoiceData({
        invoiceType: 'FACTURA',
        lines: [{ productId: '1', description: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos }],
        customerRuc: '20123456789',
        customerName: '',
      });

      expect(result).toBe('FACTURA_REQUIERE_NOMBRE_CLIENTE');
    });

    it('should reject FACTURA without valid RUC', () => {
      const result = validateInvoiceData({
        invoiceType: 'FACTURA',
        lines: [{ productId: '1', description: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos }],
        customerRuc: '123', // Invalid (too short)
        customerName: 'Empresa SAC',
      });

      expect(result).toBe('FACTURA_REQUIERE_RUC_VALIDO');
    });

    it('should allow BOLETA with "-" as customer name', () => {
      const result = validateInvoiceData({
        invoiceType: 'BOLETA',
        lines: [{ productId: '1', description: 'Pollo', quantity: 1, unitPriceCents: 5500 as Centavos }],
        customerRuc: '-',
        customerName: '-',
      });

      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // calculateRetryConfig
  // ----------------------------------------------------------

  describe('calculateRetryConfig', () => {

    it('should calculate backoff for retryable errors', () => {
      const config1 = calculateRetryConfig(1, 'SUNAT_TIMEOUT');
      const config2 = calculateRetryConfig(2, 'SUNAT_TIMEOUT');

      expect(config1.isRetryable).toBe(true);
      expect(config1.backoffMinutes).toBe(5); // 1 * 5

      expect(config2.isRetryable).toBe(true);
      expect(config2.backoffMinutes).toBe(10); // 2 * 5
    });

    it('should not retry for non-retryable errors', () => {
      const config = calculateRetryConfig(1, 'SUNAT_AUTH_FAILED');

      expect(config.isRetryable).toBe(false);
      expect(config.backoffMinutes).toBe(0);
    });

    it('should not retry after max attempts', () => {
      const config = calculateRetryConfig(3, 'SUNAT_TIMEOUT');

      expect(config.isRetryable).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // Contingency logic
  // ----------------------------------------------------------

  describe('Contingency Logic', () => {

    it('should calculate reconciliation deadline (7 days)', () => {
      const registeredAt = new Date(Date.UTC(2026, 3, 9, 10, 0, 0)); // April 9, 2026 10:00 UTC
      const deadline = calculateReconciliationDeadline(registeredAt);

      expect(deadline.getUTCDate()).toBe(16); // April 16
      expect(deadline.getUTCHours()).toBe(10);
    });

    it('should detect overdue invoices', () => {
      const registeredAt = new Date('2026-04-01T10:00:00');
      const deadline = calculateReconciliationDeadline(registeredAt); // April 8

      const isOverdue = isContingencyOverdue(deadline.toISOString(), new Date('2026-04-10T10:00:00'));
      expect(isOverdue).toBe(true);
    });

    it('should not detect non-overdue invoices', () => {
      const registeredAt = new Date('2026-04-09T10:00:00');
      const deadline = calculateReconciliationDeadline(registeredAt); // April 16

      const isOverdue = isContingencyOverdue(deadline.toISOString(), new Date('2026-04-10T10:00:00'));
      expect(isOverdue).toBe(false);
    });

    it('should activate contingency after threshold failures', () => {
      expect(shouldActivateContingency(4, 5)).toBe(false);
      expect(shouldActivateContingency(5, 5)).toBe(true);
      expect(shouldActivateContingency(6, 5)).toBe(true);
      expect(shouldActivateContingency(10, 5)).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Real business scenarios
  // ----------------------------------------------------------

  describe('Real business scenarios', () => {

    it('should handle: Emisión de boleta normal', () => {
      // Escenario: Cliente compra pollo entero + bebidas
      const lines: InvoiceLine[] = [
        { productId: '1', description: 'Pollo Entero', quantity: 1, unitPriceCents: 5500 as Centavos },
        { productId: '2', description: 'Inca Kola 1.5L', quantity: 2, unitPriceCents: 900 as Centavos },
        { productId: '3', description: 'Papas Fritas Grande', quantity: 1, unitPriceCents: 1200 as Centavos },
      ];

      const totals = calculateInvoiceTotals(lines);
      expect(totals.totalCents).toBe(8500); // S/. 85.00

      const validation = validateInvoiceData({
        invoiceType: 'BOLETA',
        lines,
        customerRuc: '-',
        customerName: '-',
      });
      expect(validation).toBeNull();

      const qr = generateSunatQR({
        ruc: '20123456789',
        invoiceType: 'BOLETA',
        series: 'B001',
        number: 1234,
        igvCents: totals.igvCents,
        totalCents: totals.totalCents,
        fecha: '2026-04-09T12:00:00',
      });

      expect(qr).toContain('20123456789');
      expect(qr).toContain('03'); // Tipo boleta
      expect(qr).toContain('00001234');
    });

    it('should handle: Factura para empresa', () => {
      // Escenario: Empresa compra para evento corporativo
      const lines: InvoiceLine[] = [
        { productId: '1', description: 'Pollo Entero', quantity: 10, unitPriceCents: 5500 as Centavos },
        { productId: '2', description: 'Chicha Morada Jarra', quantity: 5, unitPriceCents: 1200 as Centavos },
      ];

      const totals = calculateInvoiceTotals(lines);
      expect(totals.totalCents).toBe(61000); // S/. 610.00

      const validation = validateInvoiceData({
        invoiceType: 'FACTURA',
        lines,
        customerRuc: '20601234567',
        customerName: 'EMPRESA SAC',
      });
      expect(validation).toBeNull();

      const qr = generateSunatQR({
        ruc: '20123456789',
        invoiceType: 'FACTURA',
        series: 'F001',
        number: 5678,
        igvCents: totals.igvCents,
        totalCents: totals.totalCents,
        fecha: '2026-04-09T18:00:00',
      });

      expect(qr).toContain('01'); // Tipo factura
      expect(qr).toContain('00005678');
    });

    it('should handle: Contingencia con SUNAT caído', () => {
      // Escenario: SUNAT no responde, activar contingencia
      const consecutiveFailures = 5;
      const shouldActivate = shouldActivateContingency(consecutiveFailures, 5);
      expect(shouldActivate).toBe(true);

      // Registrar factura en contingencia
      const registeredAt = new Date('2026-04-09T10:00:00');
      const deadline = calculateReconciliationDeadline(registeredAt);

      expect(deadline.getDate()).toBe(16); // 7 días después

      // Verificar que no está vencida inmediatamente
      expect(isContingencyOverdue(deadline.toISOString(), new Date('2026-04-10'))).toBe(false);

      // Verificar que SÍ está vencida después de 7 días
      expect(isContingencyOverdue(deadline.toISOString(), new Date('2026-04-17'))).toBe(true);
    });

    it('should handle: Reintentos con backoff antes de contingencia', () => {
      // Escenario: 3 reintentos con backoff antes de fallar
      const errors = ['SUNAT_TIMEOUT', 'SUNAT_TIMEOUT', 'SUNAT_TIMEOUT'];

      for (let attempt = 1; attempt <= errors.length; attempt++) {
        const config = calculateRetryConfig(attempt, errors[attempt - 1]);

        if (attempt < 3) {
          expect(config.isRetryable).toBe(true);
          expect(config.backoffMinutes).toBe(attempt * 5);
        } else {
          // Último intento
          expect(config.isRetryable).toBe(false);
        }
      }

      // Después de 3 fallos consecutivos, verificar si se activa contingencia
      expect(shouldActivateContingency(3, 5)).toBe(false); // No, necesitan 5
      expect(shouldActivateContingency(5, 5)).toBe(true); // Sí
    });
  });
});
