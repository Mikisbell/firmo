/**
 * Unit Tests: Lógica de Negocio - Apertura/Cierre de Caja con Reporte Z
 *
 * Valida la lógica pura de:
 * - Apertura de turno con validación de monto inicial
 * - Cierre de turno con conteo de billetes
 * - Cálculo de diferencia de caja
 * - Generación de Reporte Z
 * - Alertas de variación de efectivo
 *
 * REQUISITOS CRÍTICOS:
 * - Dinero SIEMPRE en centavos (enteros)
 * - NUNCA usar float/decimal para dinero
 * - Diferencia de caja documentada
 * - Reporte Z idempotente (uno por turno cerrado)
 */
import { describe, it, expect, vi } from 'vitest';

// ============================================================
// Tipos y constantes
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type ShiftStatus = 'OPEN' | 'CLOSED';
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN' | 'TRANSFER';

interface DenominationCount {
  faceCents: number;
  quantity: number;
}

interface PaymentBreakdown {
  method: PaymentMethod;
  count: number;
  totalCents: Centavos;
}

interface ShiftSummary {
  shiftId: string;
  tenantId: string;
  terminalId: string;
  status: ShiftStatus;
  cashOpeningCents: Centavos;
  cashExpectedCents: Centavos;
  cashCountedCents: Centavos;
  diffCents: Centavos;
  ordersCount: number;
  totalSalesCents: Centavos;
  paymentBreakdown: PaymentBreakdown[];
  openedAt: string;
  closedAt?: string;
}

interface ZReport {
  reportId: string;
  reportNumber: number;
  shiftId: string;
  reportType: 'Z' | 'X';
  grossSalesCents: Centavos;
  discountsCents: Centavos;
  voidsCents: Centavos;
  refundsCents: Centavos;
  netSalesCents: Centavos;
  igvBaseCents: Centavos;
  igvAmountCents: Centavos;
  ordersCount: number;
  paymentsBreakdown: PaymentBreakdown[];
  cashOpeningCents: Centavos;
  cashExpectedCents: Centavos;
  cashCountedCents: Centavos;
  cashDiffCents: Centavos;
  generatedAt: string;
}

const IGV_RATE = 0.18;
const MAX_CASH_OPENING_CENTS = 50_000; // S/. 500.00
const CASH_VARIANCE_THRESHOLD_CENTS = 5_000; // S/. 50.00

// ============================================================
// Funciones puras de negocio
// ============================================================

function centavos(value: number): Centavos {
  return Math.round(value) as Centavos;
}

/**
 * Valida monto de apertura de caja
 */
function validateOpeningCash(amountCents: Centavos): string | null {
  if (!Number.isInteger(amountCents)) {
    return 'MONTO_DEBE_SER_ENTERO';
  }
  if (amountCents < 0) {
    return 'MONTO_NO_PUEDE_SER_NEGATIVO';
  }
  if (amountCents > MAX_CASH_OPENING_CENTS) {
    return `MONTO_EXCEDE_MAXIMO: ${MAX_CASH_OPENING_CENTS} centavos (S/. ${(MAX_CASH_OPENING_CENTS / 100).toFixed(2)})`;
  }
  return null;
}

/**
 * Calcula total de conteo de denominaciones
 */
function calculateDenominationTotal(counts: DenominationCount[]): Centavos {
  const total = counts.reduce((sum, denom) => {
    if (denom.quantity < 0) {
      throw new Error(`CANTIDAD_NEGATIVA: ${denom.faceCents} centavos`);
    }
    return sum + denom.faceCents * denom.quantity;
  }, 0);

  return centavos(total);
}

/**
 * Calcula diferencia de caja
 */
function calculateCashDiff(
  countedCents: Centavos,
  expectedCents: Centavos
): Centavos {
  return centavos(countedCents - expectedCents);
}

/**
 * Determina severidad de alerta de variación
 */
function determineVarianceSeverity(diffCents: Centavos): 'OK' | 'WARNING' | 'CRITICAL' {
  const absDiff = Math.abs(diffCents);

  if (absDiff <= CASH_VARIANCE_THRESHOLD_CENTS) {
    return 'OK';
  }
  if (absDiff <= CASH_VARIANCE_THRESHOLD_CENTS * 5) {
    return 'WARNING';
  }
  return 'CRITICAL';
}

/**
 * Calcula desglose de pagos por método
 */
function calculatePaymentBreakdown(
  payments: Array<{ method: PaymentMethod; amountCents: Centavos }>
): PaymentBreakdown[] {
  const breakdown = new Map<PaymentMethod, { count: number; totalCents: number }>();

  for (const payment of payments) {
    const existing = breakdown.get(payment.method) || { count: 0, totalCents: 0 };
    breakdown.set(payment.method, {
      count: existing.count + 1,
      totalCents: existing.totalCents + payment.amountCents,
    });
  }

  return Array.from(breakdown.entries()).map(([method, data]) => ({
    method,
    count: data.count,
    totalCents: centavos(data.totalCents),
  }));
}

/**
 * Calcula IGV desde ventas brutas (ya incluye IGV)
 */
function calculateIGVFromGross(grossCents: Centavos): { baseCents: Centavos; igvCents: Centavos } {
  const baseCents = centavos(Math.round(grossCents / (1 + IGV_RATE)));
  const igvCents = centavos(grossCents - baseCents);

  return { baseCents, igvCents };
}

/**
 * Genera Reporte Z
 */
function generateZReport(params: {
  reportNumber: number;
  shiftId: string;
  shiftStatus: ShiftStatus;
  grossSalesCents: Centavos;
  discountsCents: Centavos;
  voidsCents: Centavos;
  refundsCents: Centavos;
  payments: Array<{ method: PaymentMethod; amountCents: Centavos }>;
  cashOpeningCents: Centavos;
  cashExpectedCents: Centavos;
  cashCountedCents: Centavos;
}): ZReport {
  // Validar que el turno esté cerrado para Reporte Z
  if (params.shiftStatus !== 'CLOSED') {
    throw new Error('SHIFT_MUST_BE_CLOSED');
  }

  const netSalesCents = centavos(
    params.grossSalesCents - params.discountsCents - params.voidsCents - params.refundsCents
  );

  const { baseCents: igvBaseCents, igvCents: igvAmountCents } = calculateIGVFromGross(params.grossSalesCents);

  const paymentsBreakdown = calculatePaymentBreakdown(params.payments);

  const cashDiff = calculateCashDiff(params.cashCountedCents, params.cashExpectedCents);

  return {
    reportId: `z-${params.shiftId}`,
    reportNumber: params.reportNumber,
    shiftId: params.shiftId,
    reportType: 'Z',
    grossSalesCents: params.grossSalesCents,
    discountsCents: params.discountsCents,
    voidsCents: params.voidsCents,
    refundsCents: params.refundsCents,
    netSalesCents,
    igvBaseCents,
    igvAmountCents,
    ordersCount: params.payments.length,
    paymentsBreakdown,
    cashOpeningCents: params.cashOpeningCents,
    cashExpectedCents: params.cashExpectedCents,
    cashCountedCents: params.cashCountedCents,
    cashDiffCents: cashDiff,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================
// TESTS
// ============================================================

describe('Shift Open/Close - Business Logic', () => {

  // ----------------------------------------------------------
  // validateOpeningCash
  // ----------------------------------------------------------

  describe('validateOpeningCash', () => {

    it('should allow valid opening amounts', () => {
      expect(validateOpeningCash(0 as Centavos)).toBeNull();
      expect(validateOpeningCash(10000 as Centavos)).toBeNull(); // S/. 100.00
      expect(validateOpeningCash(50000 as Centavos)).toBeNull(); // S/. 500.00
    });

    it('should reject negative amounts', () => {
      expect(validateOpeningCash(-1 as any)).toBe('MONTO_NO_PUEDE_SER_NEGATIVO');
    });

    it('should reject amounts exceeding maximum', () => {
      expect(validateOpeningCash(50001 as Centavos)).toContain('MONTO_EXCEDE_MAXIMO');
      expect(validateOpeningCash(100000 as Centavos)).toContain('MONTO_EXCEDE_MAXIMO');
    });

    it('should reject non-integer amounts', () => {
      expect(validateOpeningCash(10000.5 as any)).toBe('MONTO_DEBE_SER_ENTERO');
    });
  });

  // ----------------------------------------------------------
  // calculateDenominationTotal
  // ----------------------------------------------------------

  describe('calculateDenominationTotal', () => {

    it('should calculate total correctly', () => {
      const counts: DenominationCount[] = [
        { faceCents: 20000, quantity: 2 }, // 2x S/. 200 = S/. 400
        { faceCents: 10000, quantity: 4 }, // 4x S/. 100 = S/. 400
        { faceCents: 1000, quantity: 10 }, // 10x S/. 10 = S/. 100
      ];

      const total = calculateDenominationTotal(counts);

      expect(total).toBe(90000); // S/. 900.00
    });

    it('should handle empty counts', () => {
      expect(calculateDenominationTotal([])).toBe(0);
    });

    it('should reject negative quantities', () => {
      const counts: DenominationCount[] = [
        { faceCents: 10000, quantity: -1 },
      ];

      expect(() => calculateDenominationTotal(counts)).toThrow('CANTIDAD_NEGATIVA');
    });

    it('should handle zero quantities', () => {
      const counts: DenominationCount[] = [
        { faceCents: 20000, quantity: 0 },
        { faceCents: 10000, quantity: 0 },
      ];

      expect(calculateDenominationTotal(counts)).toBe(0);
    });

    it('should handle all PEN denominations', () => {
      const counts: DenominationCount[] = [
        { faceCents: 20000, quantity: 1 },
        { faceCents: 10000, quantity: 2 },
        { faceCents: 5000, quantity: 3 },
        { faceCents: 2000, quantity: 4 },
        { faceCents: 1000, quantity: 5 },
        { faceCents: 500, quantity: 6 },
        { faceCents: 200, quantity: 7 },
        { faceCents: 100, quantity: 8 },
        { faceCents: 50, quantity: 9 },
        { faceCents: 20, quantity: 10 },
        { faceCents: 10, quantity: 11 },
      ];

      const total = calculateDenominationTotal(counts);

      // 20000 + 20000 + 15000 + 8000 + 5000 + 3000 + 1400 + 800 + 450 + 200 + 110 = 73960
      expect(total).toBe(73960); // S/. 739.60
    });
  });

  // ----------------------------------------------------------
  // calculateCashDiff
  // ----------------------------------------------------------

  describe('calculateCashDiff', () => {

    it('should calculate positive difference (sobrante)', () => {
      const diff = calculateCashDiff(31250 as Centavos, 30000 as Centavos);
      expect(diff).toBe(1250); // S/. 12.50 sobrante
    });

    it('should calculate negative difference (faltante)', () => {
      const diff = calculateCashDiff(29750 as Centavos, 30000 as Centavos);
      expect(diff).toBe(-250); // S/. 2.50 faltante
    });

    it('should return zero for exact match', () => {
      const diff = calculateCashDiff(30000 as Centavos, 30000 as Centavos);
      expect(diff).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // determineVarianceSeverity
  // ----------------------------------------------------------

  describe('determineVarianceSeverity', () => {

    it('should return OK for differences within threshold', () => {
      expect(determineVarianceSeverity(0 as Centavos)).toBe('OK');
      expect(determineVarianceSeverity(1000 as Centavos)).toBe('OK'); // S/. 10.00
      expect(determineVarianceSeverity(5000 as Centavos)).toBe('OK'); // S/. 50.00 (exact threshold)
    });

    it('should return WARNING for moderate differences', () => {
      expect(determineVarianceSeverity(5001 as Centavos)).toBe('WARNING');
      expect(determineVarianceSeverity(10000 as Centavos)).toBe('WARNING'); // S/. 100.00
      expect(determineVarianceSeverity(25000 as Centavos)).toBe('WARNING'); // S/. 250.00 (5x threshold)
    });

    it('should return CRITICAL for large differences', () => {
      expect(determineVarianceSeverity(25001 as Centavos)).toBe('CRITICAL');
      expect(determineVarianceSeverity(50000 as Centavos)).toBe('CRITICAL'); // S/. 500.00
    });

    it('should handle negative differences (absolute value)', () => {
      expect(determineVarianceSeverity(-1000 as Centavos)).toBe('OK');
      expect(determineVarianceSeverity(-10000 as Centavos)).toBe('WARNING');
      expect(determineVarianceSeverity(-50000 as Centavos)).toBe('CRITICAL');
    });
  });

  // ----------------------------------------------------------
  // calculatePaymentBreakdown
  // ----------------------------------------------------------

  describe('calculatePaymentBreakdown', () => {

    it('should group payments by method', () => {
      const payments = [
        { method: 'CASH' as PaymentMethod, amountCents: 5000 as Centavos },
        { method: 'CASH' as PaymentMethod, amountCents: 3000 as Centavos },
        { method: 'CARD' as PaymentMethod, amountCents: 10000 as Centavos },
      ];

      const breakdown = calculatePaymentBreakdown(payments);

      expect(breakdown).toHaveLength(2);
      expect(breakdown.find(b => b.method === 'CASH')?.count).toBe(2);
      expect(breakdown.find(b => b.method === 'CASH')?.totalCents).toBe(8000);
      expect(breakdown.find(b => b.method === 'CARD')?.count).toBe(1);
      expect(breakdown.find(b => b.method === 'CARD')?.totalCents).toBe(10000);
    });

    it('should handle empty payments', () => {
      expect(calculatePaymentBreakdown([])).toEqual([]);
    });

    it('should handle single payment', () => {
      const payments = [
        { method: 'YAPE' as PaymentMethod, amountCents: 5000 as Centavos },
      ];

      const breakdown = calculatePaymentBreakdown(payments);

      expect(breakdown).toHaveLength(1);
      expect(breakdown[0].method).toBe('YAPE');
      expect(breakdown[0].totalCents).toBe(5000);
    });
  });

  // ----------------------------------------------------------
  // calculateIGVFromGross
  // ----------------------------------------------------------

  describe('calculateIGVFromGross', () => {

    it('should calculate IGV correctly from gross sales', () => {
      const { baseCents, igvCents } = calculateIGVFromGross(11800 as Centavos); // S/. 118.00

      expect(baseCents).toBe(10000); // S/. 100.00
      expect(igvCents).toBe(1800); // S/. 18.00
    });

    it('should handle small amounts', () => {
      const { baseCents, igvCents } = calculateIGVFromGross(100 as Centavos); // S/. 1.00

      expect(baseCents).toBe(85); // S/. 0.85
      expect(igvCents).toBe(15); // S/. 0.15
    });

    it('should maintain base + IGV = gross', () => {
      const grossValues = [100, 1000, 5000, 10000, 50000, 100000];

      for (const gross of grossValues) {
        const { baseCents, igvCents } = calculateIGVFromGross(gross as Centavos);
        expect(baseCents + igvCents).toBe(gross);
      }
    });
  });

  // ----------------------------------------------------------
  // generateZReport
  // ----------------------------------------------------------

  describe('generateZReport', () => {

    it('should generate valid Z report for closed shift', () => {
      const report = generateZReport({
        reportNumber: 1,
        shiftId: 'shift-1',
        shiftStatus: 'CLOSED',
        grossSalesCents: 100000 as Centavos, // S/. 1000.00
        discountsCents: 5000 as Centavos, // S/. 50.00
        voidsCents: 2000 as Centavos, // S/. 20.00
        refundsCents: 1000 as Centavos, // S/. 10.00
        payments: [
          { method: 'CASH', amountCents: 40000 as Centavos },
          { method: 'CARD', amountCents: 60000 as Centavos },
        ],
        cashOpeningCents: 10000 as Centavos,
        cashExpectedCents: 50000 as Centavos,
        cashCountedCents: 50500 as Centavos,
      });

      expect(report.reportType).toBe('Z');
      expect(report.reportNumber).toBe(1);
      expect(report.grossSalesCents).toBe(100000);
      expect(report.netSalesCents).toBe(92000); // 100000 - 5000 - 2000 - 1000
      expect(report.cashDiffCents).toBe(500); // 50500 - 50000
    });

    it('should reject Z report for open shift', () => {
      expect(() => generateZReport({
        reportNumber: 1,
        shiftId: 'shift-1',
        shiftStatus: 'OPEN',
        grossSalesCents: 50000 as Centavos,
        discountsCents: 0 as Centavos,
        voidsCents: 0 as Centavos,
        refundsCents: 0 as Centavos,
        payments: [],
        cashOpeningCents: 10000 as Centavos,
        cashExpectedCents: 10000 as Centavos,
        cashCountedCents: 10000 as Centavos,
      })).toThrow('SHIFT_MUST_BE_CLOSED');
    });

    it('should calculate IGV breakdown correctly', () => {
      const report = generateZReport({
        reportNumber: 1,
        shiftId: 'shift-1',
        shiftStatus: 'CLOSED',
        grossSalesCents: 11800 as Centavos, // S/. 118.00 (includes 18% IGV)
        discountsCents: 0 as Centavos,
        voidsCents: 0 as Centavos,
        refundsCents: 0 as Centavos,
        payments: [{ method: 'CASH', amountCents: 11800 as Centavos }],
        cashOpeningCents: 0 as Centavos,
        cashExpectedCents: 0 as Centavos,
        cashCountedCents: 0 as Centavos,
      });

      expect(report.igvBaseCents).toBe(10000); // S/. 100.00
      expect(report.igvAmountCents).toBe(1800); // S/. 18.00
    });
  });

  // ----------------------------------------------------------
  // Escenarios reales
  // ----------------------------------------------------------

  describe('Real business scenarios', () => {

    it('should handle: Apertura normal de caja', () => {
      // Escenario: Cajero abre caja con S/. 200.00
      const openingCash = 20000 as Centavos;

      const error = validateOpeningCash(openingCash);
      expect(error).toBeNull();

      // Conteo de billetes
      const counts: DenominationCount[] = [
        { faceCents: 10000, quantity: 2 }, // 2x S/. 100
        { faceCents: 5000, quantity: 4 }, // 4x S/. 50
        { faceCents: 2000, quantity: 5 }, // 5x S/. 20
        { faceCents: 1000, quantity: 10 }, // 10x S/. 10
        { faceCents: 500, quantity: 10 }, // 10x S/. 5
        { faceCents: 100, quantity: 50 }, // 50x S/. 1
      ];

      const total = calculateDenominationTotal(counts);
      expect(total).toBe(70000); // S/. 700.00
    });

    it('should handle: Cierre con diferencia pequeña', () => {
      // Escenario: Cierre con S/. 2.50 de diferencia (dentro de umbral)
      const expected = 45000 as Centavos;
      const counted = 45250 as Centavos;

      const diff = calculateCashDiff(counted, expected);
      const severity = determineVarianceSeverity(diff);

      expect(diff).toBe(250); // S/. 2.50
      expect(severity).toBe('OK');
    });

    it('should handle: Cierre con diferencia crítica', () => {
      // Escenario: Faltante de S/. 500.00
      const expected = 50000 as Centavos;
      const counted = 0 as Centavos; // ¡Caja vacía!

      const diff = calculateCashDiff(counted, expected);
      const severity = determineVarianceSeverity(diff);

      expect(diff).toBe(-50000);
      expect(severity).toBe('CRITICAL');
    });

    it('should handle: Reporte Z con múltiples métodos de pago', () => {
      // Escenario: Turno con ventas mixtas
      const report = generateZReport({
        reportNumber: 42,
        shiftId: 'shift-daily-1',
        shiftStatus: 'CLOSED',
        grossSalesCents: 250000 as Centavos, // S/. 2500.00
        discountsCents: 10000 as Centavos,
        voidsCents: 5000 as Centavos,
        refundsCents: 2000 as Centavos,
        payments: [
          { method: 'CASH', amountCents: 80000 as Centavos },
          { method: 'CASH', amountCents: 40000 as Centavos },
          { method: 'CARD', amountCents: 100000 as Centavos },
          { method: 'CARD', amountCents: 50000 as Centavos },
          { method: 'YAPE', amountCents: 30000 as Centavos },
        ],
        cashOpeningCents: 20000 as Centavos,
        cashExpectedCents: 140000 as Centavos,
        cashCountedCents: 141500 as Centavos,
      });

      expect(report.netSalesCents).toBe(233000); // 250000 - 10000 - 5000 - 2000
      expect(report.paymentsBreakdown).toHaveLength(3); // CASH, CARD, YAPE

      const cashBreakdown = report.paymentsBreakdown.find(b => b.method === 'CASH');
      expect(cashBreakdown?.count).toBe(2);
      expect(cashBreakdown?.totalCents).toBe(120000);

      expect(report.cashDiffCents).toBe(1500); // S/. 15.00 sobrante
      expect(determineVarianceSeverity(report.cashDiffCents)).toBe('OK');
    });
  });
});
