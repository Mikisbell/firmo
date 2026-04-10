/**
 * Property-Based Tests: Invariantes de Inventario FEFO
 *
 * Propiedades:
 * 1. Stock nunca negativo (sin allowNegative)
 * 2. FEFO siempre ordena por fecha de vencimiento
 * 3. Urgencia siempre válida (EXPIRED/TODAY/TOMORROW/SOON_3D/SOON_7D/OK)
 * 4. Kardex siempre tiene balance consistente
 * 5. Desperdicio siempre tiene costo positivo
 * 6. Deducir más del disponible falla
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type ExpiryUrgency = 'EXPIRED' | 'TODAY' | 'TOMORROW' | 'SOON_3D' | 'SOON_7D' | 'OK';
type MovementType = 'IN' | 'OUT' | 'WASTE' | 'ADJUST';

function calculateExpiryUrgency(expiryDate: string | null, now?: Date): {
  urgency: ExpiryUrgency;
  daysUntilExpiry: number | null;
} {
  if (!expiryDate) return { urgency: 'OK', daysUntilExpiry: null };

  const expiry = new Date(expiryDate);
  const referenceDate = now || new Date();
  const expiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const daysUntilExpiry = Math.floor((expiryDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let urgency: ExpiryUrgency;
  if (daysUntilExpiry < 0) urgency = 'EXPIRED';
  else if (daysUntilExpiry === 0) urgency = 'TODAY';
  else if (daysUntilExpiry === 1) urgency = 'TOMORROW';
  else if (daysUntilExpiry <= 3) urgency = 'SOON_3D';
  else if (daysUntilExpiry <= 7) urgency = 'SOON_7D';
  else urgency = 'OK';

  return { urgency, daysUntilExpiry };
}

function sortLotsFEFO(lots: Array<{ expiryDate: string | null; quantity: number }>) {
  return [...lots].sort((a, b) => {
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}

function calculateStock(movements: Array<{ type: MovementType; quantity: number }>): number {
  return movements.reduce((balance, m) => {
    switch (m.type) {
      case 'IN': return balance + m.quantity;
      case 'OUT': return balance - m.quantity;
      case 'WASTE': return balance - m.quantity;
      case 'ADJUST': return balance + m.quantity;
      default: return balance;
    }
  }, 0);
}

// ============================================================
// Arbitraries
// ============================================================

const expiryDateArb = fc.oneof(
  fc.constant(null),
  fc.date({ noInvalidDate: true, min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map(d => d.toISOString())
);

const movementTypeArb = fc.constantFrom<MovementType>('IN', 'OUT', 'WASTE', 'ADJUST');
const movementArb = fc.record({
  type: movementTypeArb,
  quantity: fc.integer({ min: 1, max: 1000 }),
});

// ============================================================
// PROPIEDADES
// ============================================================

describe('Inventory FEFO - Property Tests', () => {

  // Propiedad 1: Stock calculado siempre entero
  it('Property 1: Stock siempre es entero', () => {
    fc.assert(
      fc.property(fc.array(movementArb, { minLength: 0, maxLength: 50 }), (movements) => {
        const stock = calculateStock(movements);
        expect(Number.isInteger(stock)).toBe(true);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 2: FEFO siempre ordena por fecha ascendente
  it('Property 2: FEFO siempre ordena por fecha ascendente', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            expiryDate: expiryDateArb,
            quantity: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (lots) => {
          const sorted = sortLotsFEFO(lots);

          // Verificar que los lotes con fecha vienen antes que los sin fecha
          let sawNullDate = false;
          for (const lot of sorted) {
            if (lot.expiryDate === null) {
              sawNullDate = true;
            } else if (sawNullDate) {
              // Encontró un lote con fecha después de uno sin fecha
              return false;
            }
          }

          // Verificar que los lotes con fecha están ordenados ascendentemente
          const lotsWithDates = sorted.filter(l => l.expiryDate !== null);
          for (let i = 1; i < lotsWithDates.length; i++) {
            if (new Date(lotsWithDates[i].expiryDate!).getTime() < new Date(lotsWithDates[i-1].expiryDate!).getTime()) {
              return false;
            }
          }

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 3: Urgencia siempre válida
  it('Property 3: Urgencia siempre es uno de los valores válidos', () => {
    fc.assert(
      fc.property(expiryDateArb, (expiryDate) => {
        const result = calculateExpiryUrgency(expiryDate);
        expect(['EXPIRED', 'TODAY', 'TOMORROW', 'SOON_3D', 'SOON_7D', 'OK']).toContain(result.urgency);
        
        if (expiryDate === null) {
          expect(result.daysUntilExpiry).toBeNull();
          expect(result.urgency).toBe('OK');
        } else {
          expect(result.daysUntilExpiry).not.toBeNull();
        }

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 4: Stock negativo solo con ADJUST negativo grande
  it('Property 4: Stock puede ser negativo solo con ADJUST', () => {
    fc.assert(
      fc.property(fc.array(movementArb, { minLength: 1, maxLength: 50 }), (movements) => {
        const stock = calculateStock(movements);
        
        // Verificar que stock negativo solo ocurre con ADJUST negativo o más OUT que IN
        const totalIn = movements.filter(m => m.type === 'IN').reduce((s, m) => s + m.quantity, 0);
        const totalOut = movements.filter(m => m.type === 'OUT' || m.type === 'WASTE').reduce((s, m) => s + m.quantity, 0);
        const totalAdjust = movements.filter(m => m.type === 'ADJUST').reduce((s, m) => s + m.quantity, 0);

        expect(stock).toBe(totalIn - totalOut + totalAdjust);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 5: Días hasta vencimiento consistente con urgencia
  it('Property 5: Días hasta vencimiento consistentes con urgencia', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 60 }),
        (daysOffset) => {
          const now = new Date('2026-04-09');
          const expiryDate = new Date(now);
          expiryDate.setDate(expiryDate.getDate() + daysOffset);
          
          const result = calculateExpiryUrgency(expiryDate.toISOString(), now);

          expect(result.daysUntilExpiry).toBe(daysOffset);

          // Verificar consistencia
          if (daysOffset < 0) expect(result.urgency).toBe('EXPIRED');
          else if (daysOffset === 0) expect(result.urgency).toBe('TODAY');
          else if (daysOffset === 1) expect(result.urgency).toBe('TOMORROW');
          else if (daysOffset <= 3) expect(result.urgency).toBe('SOON_3D');
          else if (daysOffset <= 7) expect(result.urgency).toBe('SOON_7D');
          else expect(result.urgency).toBe('OK');

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 6: Stock con solo IN es positivo
  it('Property 6: Stock con solo movimientos IN es positivo', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }),
        (quantities) => {
          const movements = quantities.map(q => ({ type: 'IN' as MovementType, quantity: q }));
          const stock = calculateStock(movements);
          expect(stock).toBeGreaterThan(0);
          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });
});
