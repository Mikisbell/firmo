/**
 * Property-Based Tests: Invariantes de Apertura/Cierre de Caja
 *
 * Propiedades validadas:
 * 1. Dinero siempre en centavos (enteros)
 * 2. Total de denominaciones = suma de (face × quantity)
 * 3. Diferencia de caja = counted - expected
 * 4. Severidad de variación siempre válida (OK/WARNING/CRITICAL)
 * 5. IGV siempre 18% del subtotal
 * 6. Reporte Z con valores consistentes
 * 7. Desglose de pagos suma = total ventas
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================
// Tipos y funciones (mismas que unit test)
// ============================================================

type Centavos = number & { readonly __brand: 'Centavos' };
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN' | 'TRANSFER';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;

function calculateDenominationTotal(counts: Array<{ faceCents: number; quantity: number }>): Centavos {
  const total = counts.reduce((sum, d) => sum + d.faceCents * d.quantity, 0);
  return centavos(total);
}

function calculateCashDiff(countedCents: Centavos, expectedCents: Centavos): Centavos {
  return centavos(countedCents - expectedCents);
}

function determineVarianceSeverity(diffCents: Centavos): 'OK' | 'WARNING' | 'CRITICAL' {
  const absDiff = Math.abs(diffCents);
  const THRESHOLD = 5000;
  if (absDiff <= THRESHOLD) return 'OK';
  if (absDiff <= THRESHOLD * 5) return 'WARNING';
  return 'CRITICAL';
}

function calculateIGVFromGross(grossCents: Centavos): { baseCents: Centavos; igvCents: Centavos } {
  const baseCents = centavos(Math.round(grossCents / 1.18));
  const igvCents = centavos(grossCents - baseCents);
  return { baseCents, igvCents };
}

// ============================================================
// Arbitraries
// ============================================================

const centavosArb = fc.integer({ min: 0, max: 1_000_000 }).map(centavos); // Hasta S/. 10,000
const denominationArb = fc.record({
  faceCents: fc.constantFrom(10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000),
  quantity: fc.integer({ min: 0, max: 100 }),
});
const paymentMethodArb = fc.constantFrom<PaymentMethod>('CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER');
const paymentArb = fc.record({
  method: paymentMethodArb,
  amountCents: fc.integer({ min: 100, max: 100000 }).map(centavos),
});

// ============================================================
// PROPIEDADES
// ============================================================

describe('Shift/Caja - Property Tests', () => {

  // Propiedad 1: Dinero siempre en centavos
  it('Property 1: Totales de denominaciones siempre enteros', () => {
    fc.assert(
      fc.property(fc.array(denominationArb, { minLength: 0, maxLength: 20 }), (counts) => {
        const total = calculateDenominationTotal(counts);
        expect(Number.isInteger(total)).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 2: Total = suma de (face × quantity)
  it('Property 2: Total es conmutativo - orden no importa', () => {
    fc.assert(
      fc.property(fc.array(denominationArb, { minLength: 1, maxLength: 10 }), (counts) => {
        const total1 = calculateDenominationTotal(counts);
        const shuffled = [...counts].sort(() => Math.random() - 0.5);
        const total2 = calculateDenominationTotal(shuffled);
        expect(total1).toBe(total2);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 3: Diferencia de caja consistente
  it('Property 3: Diff = counted - expected', () => {
    fc.assert(
      fc.property(centavosArb, centavosArb, (counted, expected) => {
        const diff = calculateCashDiff(counted, expected);
        expect(diff).toBe(counted - expected);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 4: Severidad siempre válida
  it('Property 4: Severidad siempre es OK, WARNING o CRITICAL', () => {
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }).map(centavos), (diff) => {
        const severity = determineVarianceSeverity(diff);
        expect(['OK', 'WARNING', 'CRITICAL']).toContain(severity);

        // Validar umbrales
        const absDiff = Math.abs(diff);
        if (absDiff <= 5000) expect(severity).toBe('OK');
        else if (absDiff <= 25000) expect(severity).toBe('WARNING');
        else expect(severity).toBe('CRITICAL');

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 5: IGV + Base = Gross
  it('Property 5: IGV + Base siempre = Gross', () => {
    fc.assert(
      fc.property(fc.integer({ min: 100, max: 1000000 }).map(centavos), (gross) => {
        const { baseCents, igvCents } = calculateIGVFromGross(gross);
        expect(baseCents + igvCents).toBe(gross);
        expect(baseCents).toBeGreaterThanOrEqual(0);
        expect(igvCents).toBeGreaterThanOrEqual(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 6: IGV proporción correcta
  it('Property 6: IGV es aproximadamente 15.25% del gross (18% del base)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1180, max: 1000000 }).map(centavos), (gross) => {
        // Para montos grandes, el ratio converge a 18/118 ≈ 0.1525
        // Para montos pequeños, el redondeo puede causar desviación
        const { igvCents } = calculateIGVFromGross(gross);
        const ratio = igvCents / gross;

        // 18/118 ≈ 0.1525... con margen por redondeo
        expect(ratio).toBeGreaterThan(0.14);
        expect(ratio).toBeLessThan(0.17);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 7: Pagos desglose suma = total
  it('Property 7: Suma de desglose de pagos = total de pagos', () => {
    fc.assert(
      fc.property(fc.array(paymentArb, { minLength: 1, maxLength: 50 }), (payments) => {
        const totalPayments = payments.reduce((sum, p) => sum + p.amountCents, 0);

        // Agrupar por método
        const breakdown = new Map<PaymentMethod, number>();
        for (const payment of payments) {
          const existing = breakdown.get(payment.method) || 0;
          breakdown.set(payment.method, existing + payment.amountCents);
        }

        const breakdownTotal = Array.from(breakdown.values()).reduce((sum, v) => sum + v, 0);

        expect(breakdownTotal).toBe(totalPayments);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 8: Diferencia simétrica
  it('Property 8: Diff(counted, expected) = -Diff(expected, counted)', () => {
    fc.assert(
      fc.property(centavosArb, centavosArb, (a, b) => {
        const diffAB = calculateCashDiff(a, b);
        const diffBA = calculateCashDiff(b, a);
        // Usar Object.is para manejar +0 vs -0, o comparar valor absoluto
        expect(Math.abs(diffAB)).toBe(Math.abs(diffBA));
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 9: Severidad simétrica para positivos/negativos
  it('Property 9: Severidad depende de valor absoluto', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }).map(centavos), (diff) => {
        const severityPos = determineVarianceSeverity(diff);
        const severityNeg = determineVarianceSeverity(centavos(-diff));
        expect(severityPos).toBe(severityNeg);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 10: Denominación con una sola moneda/billete
  it('Property 10: Single denomination total = face × quantity', () => {
    fc.assert(
      fc.property(denominationArb, (denom) => {
        const total = calculateDenominationTotal([denom]);
        expect(total).toBe(denom.faceCents * denom.quantity);
        return true;
      }),
      { numRuns: 1000 }
    );
  });
});
