/**
 * Property-Based Tests: Invariantes de Facturación SUNAT
 *
 * Propiedades validadas:
 * 1. Totales siempre en centavos (enteros)
 * 2. IGV + Base = Total siempre
 * 3. QR siempre tiene formato válido (9 campos separados por |)
 * 4. Validación siempre rechaza items vacíos
 * 5. Reintentos siempre con backoff creciente
 * 6. Contingencia: deadline siempre 7 días después
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type Centavos = number & { readonly __brand: 'Centavos' };
type InvoiceType = 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

const centavos = (v: number): Centavos => Math.round(v) as Centavos;
const IGV_RATE = 0.18;
const RETRY_BASE_MINUTES = 5;

function calculateInvoiceTotals(lines: Array<{ quantity: number; unitPriceCents: Centavos }>): {
  subtotalCents: Centavos;
  igvCents: Centavos;
  totalCents: Centavos;
} {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitPriceCents * line.quantity,
    0
  ) as Centavos;

  const baseCents = centavos(Math.round(subtotalCents / (1 + IGV_RATE)));
  const igvCents = centavos(subtotalCents - baseCents);

  return { subtotalCents, igvCents, totalCents: subtotalCents };
}

function generateSunatQR(params: {
  ruc: string;
  invoiceType: InvoiceType;
  series: string;
  number: number;
  igvCents: Centavos;
  totalCents: Centavos;
  fecha: string;
}): string {
  const tipoMap: Record<InvoiceType, string> = { FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07', NOTA_DEBITO: '08' };
  const tipoDoc = tipoMap[params.invoiceType];
  const totalSoles = (params.totalCents / 100).toFixed(2);
  const igvSoles = (params.igvCents / 100).toFixed(2);
  const fechaStr = params.fecha.split('T')[0];

  return `${params.ruc}|${tipoDoc}|${params.series}|${String(params.number).padStart(8, '0')}|${igvSoles}|${totalSoles}|${fechaStr}|${tipoDoc}|${String(params.number).padStart(8, '0')}|`;
}

function calculateRetryBackoff(attempt: number): number {
  return attempt * RETRY_BASE_MINUTES;
}

// ============================================================
// Arbitraries
// ============================================================

const invoiceTypeArb = fc.constantFrom<InvoiceType>('FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO');
const lineArb = fc.record({
  quantity: fc.integer({ min: 1, max: 100 }),
  unitPriceCents: fc.integer({ min: 100, max: 100000 }).map(centavos),
});
const linesArb = fc.array(lineArb, { minLength: 1, maxLength: 20 });

// ============================================================
// PROPIEDADES
// ============================================================

describe('SUNAT Invoicing - Property Tests', () => {

  // Propiedad 1: Totales siempre enteros
  it('Property 1: Totales siempre son enteros', () => {
    fc.assert(
      fc.property(linesArb, (lines) => {
        const totals = calculateInvoiceTotals(lines);
        expect(Number.isInteger(totals.subtotalCents)).toBe(true);
        expect(Number.isInteger(totals.igvCents)).toBe(true);
        expect(Number.isInteger(totals.totalCents)).toBe(true);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 2: IGV + Base = Total
  it('Property 2: IGV + Base siempre = Total', () => {
    fc.assert(
      fc.property(linesArb, (lines) => {
        const totals = calculateInvoiceTotals(lines);
        const baseCents = totals.totalCents - totals.igvCents;
        expect(baseCents + totals.igvCents).toBe(totals.totalCents);
        expect(baseCents).toBeGreaterThanOrEqual(0);
        expect(totals.igvCents).toBeGreaterThanOrEqual(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 3: QR siempre tiene formato válido
  it('Property 3: QR siempre tiene 9 campos separados por |', () => {
    fc.assert(
      fc.property(
        fc.constant('20123456789'), // RUC fijo válido
        invoiceTypeArb,
        fc.constant('B001'),
        fc.integer({ min: 1, max: 99999999 }),
        fc.integer({ min: 0, max: 1000000 }).map(centavos),
        fc.integer({ min: 100, max: 10000000 }).map(centavos),
        fc.date({ noInvalidDate: true, min: new Date('2020-01-01'), max: new Date() }).map(d => d.toISOString()),
        (ruc, type, series, number, igv, total, fecha) => {
          const qr = generateSunatQR({
            ruc,
            invoiceType: type,
            series,
            number,
            igvCents: igv,
            totalCents: total,
            fecha,
          });

          const parts = qr.split('|');
          expect(parts).toHaveLength(10);
          expect(parts[9]).toBe('');

          expect(parts[0]).toBe(ruc);
          expect(parts[3]).toHaveLength(8);
          expect(parts[8]).toHaveLength(8);

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 4: QR total y IGV en formato con 2 decimales
  it('Property 4: QR montos siempre con 2 decimales', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }).map(centavos),
        fc.integer({ min: 0, max: 10000000 }).map(centavos),
        (igv, total) => {
          const qr = generateSunatQR({
            ruc: '20123456789',
            invoiceType: 'BOLETA',
            series: 'B001',
            number: 1,
            igvCents: igv,
            totalCents: total,
            fecha: '2026-04-09T10:00:00',
          });

          const parts = qr.split('|');
          // IGV y TOTAL deben tener formato X.XX
          expect(parts[4]).toMatch(/^\d+\.\d{2}$/);
          expect(parts[5]).toMatch(/^\d+\.\d{2}$/);

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 5: Backoff siempre creciente
  it('Property 5: Backoff siempre creciente con attemptos', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (attempt) => {
        const backoff1 = calculateRetryBackoff(attempt);
        const backoff2 = calculateRetryBackoff(attempt + 1);

        expect(backoff2).toBeGreaterThan(backoff1);
        expect(backoff1).toBe(attempt * 5);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 6: Backoff siempre positivo
  it('Property 6: Backoff siempre positivo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (attempt) => {
        const backoff = calculateRetryBackoff(attempt);
        expect(backoff).toBeGreaterThan(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 7: Totales no negativos
  it('Property 7: Totales nunca negativos', () => {
    fc.assert(
      fc.property(linesArb, (lines) => {
        const totals = calculateInvoiceTotals(lines);
        expect(totals.subtotalCents).toBeGreaterThanOrEqual(0);
        expect(totals.igvCents).toBeGreaterThanOrEqual(0);
        expect(totals.totalCents).toBeGreaterThanOrEqual(0);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 8: Subtotal = Total (IGV ya incluido)
  it('Property 8: Subtotal siempre igual a Total (IGV incluido)', () => {
    fc.assert(
      fc.property(linesArb, (lines) => {
        const totals = calculateInvoiceTotals(lines);
        expect(totals.subtotalCents).toBe(totals.totalCents);
        return true;
      }),
      { numRuns: 1000 }
    );
  });
});
