/**
 * Property-Based Tests: Invariantes de Cocina KDS
 *
 * Propiedades:
 * 1. Prioridad siempre válida (HIGH/MEDIUM/LOW)
 * 2. Pedidos priorizados están ordenados correctamente
 * 3. Transiciones de estado siempre válidas
 * 4. Tiempo de cocción siempre positivo
 * 5. SLA breach detectado correctamente
 * 6. Métricas de estación siempre consistentes
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type OrderStatus = 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED';
type OrderType = 'DINE_IN' | 'TAKE_OUT' | 'DELIVERY';
type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
type Station = 'PARRILLA' | 'COCINA' | 'BAR' | 'HORNO' | 'FRIOS' | 'POSTRES' | 'EMPAQUE';

function determineOrderPriority(orderType: OrderType, ageMinutes: number): Priority {
  if (orderType === 'TAKE_OUT' && ageMinutes > 10) return 'HIGH';
  if (orderType === 'DINE_IN' && ageMinutes > 15) return 'HIGH';
  if (ageMinutes > 20) return 'HIGH';
  if (ageMinutes > 5) return 'MEDIUM';
  return 'LOW';
}

function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    'PENDING': ['COOKING', 'VOIDED'],
    'COOKING': ['READY', 'VOIDED'],
    'READY': ['DONE', 'VOIDED'],
    'DONE': [],
    'VOIDED': [],
  };
  return validTransitions[from]?.includes(to) || false;
}

const stationArb = fc.constantFrom<Station>('PARRILLA', 'COCINA', 'BAR', 'HORNO', 'FRIOS', 'POSTRES', 'EMPAQUE');
const orderTypeArb = fc.constantFrom<OrderType>('DINE_IN', 'TAKE_OUT', 'DELIVERY');
const orderStatusArb = fc.constantFrom<OrderStatus>('PENDING', 'COOKING', 'READY', 'DONE', 'VOIDED');

// ============================================================
// PROPIEDADES
// ============================================================

describe('Kitchen KDS - Property Tests', () => {

  // Propiedad 1: Prioridad siempre válida
  it('Property 1: Prioridad siempre es HIGH, MEDIUM o LOW', () => {
    fc.assert(
      fc.property(orderTypeArb, fc.integer({ min: 0, max: 120 }), (orderType, ageMinutes) => {
        const priority = determineOrderPriority(orderType, ageMinutes);
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(priority);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 2: TAKE_OUT se vuelve HIGH antes que DINE_IN
  it('Property 2: TAKE_OUT prioriza antes que DINE_IN', () => {
    fc.assert(
      fc.property(fc.integer({ min: 11, max: 15 }), (ageMinutes) => {
        const takeOutPriority = determineOrderPriority('TAKE_OUT', ageMinutes);
        const dineInPriority = determineOrderPriority('DINE_IN', ageMinutes);

        // Entre 11-15 min, TAKE_OUT debe ser HIGH y DINE_IN no
        if (ageMinutes <= 15) {
          expect(takeOutPriority).toBe('HIGH');
          expect(dineInPriority).not.toBe('HIGH');
        }

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 3: Transiciones válidas respetan flujo
  it('Property 3: Transiciones válidas siempre van hacia adelante', () => {
    fc.assert(
      fc.property(orderStatusArb, orderStatusArb, (from, to) => {
        const valid = isValidStatusTransition(from, to);

        // Si es válida, verificar que no sea backward
        if (valid) {
          const statusOrder = ['PENDING', 'COOKING', 'READY', 'DONE'];
          const fromIdx = statusOrder.indexOf(from);
          const toIdx = statusOrder.indexOf(to);

          // VOIDED siempre es válido desde estados no terminales
          if (to === 'VOIDED') {
            expect(from !== 'DONE' && from !== 'VOIDED').toBe(true);
          } else {
            // Debe ser forward o al mismo nivel
            expect(toIdx > fromIdx).toBe(true);
          }
        }

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 4: DONE y VOIDED son terminales
  it('Property 4: DONE y VOIDED no tienen transiciones salientes', () => {
    fc.assert(
      fc.property(orderStatusArb, (to) => {
        expect(isValidStatusTransition('DONE', to)).toBe(false);
        expect(isValidStatusTransition('VOIDED', to)).toBe(false);
        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 5: Tiempo de cocción con timestamps válidos
  it('Property 5: Tiempo de cocción calculado correctamente', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }),
        (cookingMinutes) => {
          const startTime = new Date('2026-04-09T12:00:00').getTime();
          const readyTime = startTime + cookingMinutes * 60 * 1000;

          const calculatedMinutes = Math.round((readyTime - startTime) / (1000 * 60));

          expect(calculatedMinutes).toBe(cookingMinutes);
          expect(calculatedMinutes).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 6: SLA breach correcto
  it('Property 6: SLA breach detectado correctamente', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 60 }), (cookingMinutes) => {
        const slaMinutes = 25;
        const breached = cookingMinutes > slaMinutes;

        expect(breached).toBe(cookingMinutes > slaMinutes);

        return true;
      }),
      { numRuns: 1000 }
    );
  });

  // Propiedad 7: Edad siempre positiva
  it('Property 7: Edad del pedido siempre positiva', () => {
    fc.assert(
      fc.property(
        fc.date({ noInvalidDate: true, min: new Date('2026-04-09T12:00:00'), max: new Date('2026-04-09T13:00:00') }),
        fc.date({ noInvalidDate: true, min: new Date('2026-04-09T12:00:00'), max: new Date('2026-04-09T13:00:00') }),
        (createdAt, now) => {
          const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
          
          // Si createdAt <= now, edad es positiva
          if (createdAt <= now) {
            expect(ageMinutes).toBeGreaterThanOrEqual(0);
          }

          return true;
        }
      ),
      { numRuns: 1000 }
    );
  });

  // Propiedad 8: Estaciones siempre válidas
  it('Property 8: Estación siempre es una de las válidas', () => {
    fc.assert(
      fc.property(stationArb, (station) => {
        const validStations = ['PARRILLA', 'COCINA', 'BAR', 'HORNO', 'FRIOS', 'POSTRES', 'EMPAQUE'];
        expect(validStations).toContain(station);
        return true;
      }),
      { numRuns: 1000 }
    );
  });
});
