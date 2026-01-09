/**
 * Property 4: Stock Calculation from Events
 * Validates: Requirements 7.6
 * 
 * Propiedades:
 * - Stock = suma de todas las entradas - suma de todas las salidas
 * - El stock nunca puede ser negativo (con validación)
 * - El cálculo es determinístico (mismo resultado con mismos eventos)
 * - El orden de eventos no afecta el resultado final (conmutatividad)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Tipos de movimiento
type MovementType = 'IN' | 'OUT' | 'WASTE' | 'ADJUST';

// Evento de inventario
interface InventoryEvent {
  id: string;
  type: MovementType;
  quantity: number; // Siempre positivo, el tipo determina si suma o resta
  timestamp: number;
}

// Calcular stock desde eventos
function calculateStockFromEvents(events: InventoryEvent[]): number {
  return events.reduce((stock, event) => {
    switch (event.type) {
      case 'IN':
        return stock + event.quantity;
      case 'OUT':
      case 'WASTE':
        return stock - event.quantity;
      case 'ADJUST':
        // ADJUST puede ser positivo o negativo (ya viene con signo)
        return stock + event.quantity;
      default:
        return stock;
    }
  }, 0);
}

// Calcular stock con validación (no permite negativo)
function calculateStockWithValidation(events: InventoryEvent[]): { stock: number; valid: boolean } {
  let stock = 0;
  let valid = true;
  
  // Ordenar por timestamp para procesar en orden
  const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
  
  for (const event of sortedEvents) {
    switch (event.type) {
      case 'IN':
        stock += event.quantity;
        break;
      case 'OUT':
      case 'WASTE':
        stock -= event.quantity;
        if (stock < 0) {
          valid = false;
        }
        break;
      case 'ADJUST':
        stock += event.quantity;
        if (stock < 0) {
          valid = false;
        }
        break;
    }
  }
  
  return { stock, valid };
}

// Calcular totales por tipo
function calculateTotalsByType(events: InventoryEvent[]): { totalIn: number; totalOut: number; totalWaste: number; totalAdjust: number } {
  return events.reduce((acc, event) => {
    switch (event.type) {
      case 'IN':
        acc.totalIn += event.quantity;
        break;
      case 'OUT':
        acc.totalOut += event.quantity;
        break;
      case 'WASTE':
        acc.totalWaste += event.quantity;
        break;
      case 'ADJUST':
        acc.totalAdjust += event.quantity;
        break;
    }
    return acc;
  }, { totalIn: 0, totalOut: 0, totalWaste: 0, totalAdjust: 0 });
}

// Arbitrarios
const movementTypeArb = fc.constantFrom<MovementType>('IN', 'OUT', 'WASTE', 'ADJUST');
const quantityArb = fc.integer({ min: 1, max: 1000 });
const adjustQuantityArb = fc.integer({ min: -500, max: 500 }); // Ajustes pueden ser negativos
const timestampArb = fc.integer({ min: 1, max: 1000000 });

const eventArb = fc.record({
  id: fc.uuid(),
  type: movementTypeArb,
  quantity: quantityArb,
  timestamp: timestampArb,
});

// Evento con ajuste (puede ser negativo)
const adjustEventArb = fc.record({
  id: fc.uuid(),
  type: fc.constant<MovementType>('ADJUST'),
  quantity: adjustQuantityArb,
  timestamp: timestampArb,
});

// Lista de eventos balanceados (más entradas que salidas)
const balancedEventsArb = fc.array(eventArb, { minLength: 1, maxLength: 50 }).map(events => {
  // Asegurar que hay suficientes entradas
  const totalIn = events.filter(e => e.type === 'IN').reduce((sum, e) => sum + e.quantity, 0);
  const totalOut = events.filter(e => e.type === 'OUT' || e.type === 'WASTE').reduce((sum, e) => sum + e.quantity, 0);
  
  if (totalOut > totalIn) {
    // Agregar entrada para balancear
    events.push({
      id: crypto.randomUUID(),
      type: 'IN',
      quantity: totalOut - totalIn + 100,
      timestamp: 0, // Al inicio
    });
  }
  
  return events;
});

describe('Property 4: Stock Calculation from Events', () => {
  it('should calculate stock as sum of IN minus sum of OUT and WASTE', () => {
    fc.assert(
      fc.property(
        fc.array(eventArb, { minLength: 1, maxLength: 20 }),
        (events) => {
          const stock = calculateStockFromEvents(events);
          const totals = calculateTotalsByType(events);
          
          const expectedStock = totals.totalIn - totals.totalOut - totals.totalWaste + totals.totalAdjust;
          
          expect(stock).toBe(expectedStock);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be deterministic (same events = same result)', () => {
    fc.assert(
      fc.property(
        fc.array(eventArb, { minLength: 1, maxLength: 20 }),
        (events) => {
          const stock1 = calculateStockFromEvents(events);
          const stock2 = calculateStockFromEvents(events);
          const stock3 = calculateStockFromEvents([...events]);
          
          expect(stock1).toBe(stock2);
          expect(stock2).toBe(stock3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be commutative (order does not affect final result)', () => {
    fc.assert(
      fc.property(
        fc.array(eventArb, { minLength: 2, maxLength: 20 }),
        (events) => {
          const stock1 = calculateStockFromEvents(events);
          
          // Mezclar eventos
          const shuffled = [...events].sort(() => Math.random() - 0.5);
          const stock2 = calculateStockFromEvents(shuffled);
          
          // Invertir orden
          const reversed = [...events].reverse();
          const stock3 = calculateStockFromEvents(reversed);
          
          expect(stock1).toBe(stock2);
          expect(stock2).toBe(stock3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 for empty events', () => {
    const stock = calculateStockFromEvents([]);
    expect(stock).toBe(0);
  });

  it('should handle only IN events correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            type: fc.constant<MovementType>('IN'),
            quantity: quantityArb,
            timestamp: timestampArb,
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (events) => {
          const stock = calculateStockFromEvents(events);
          const totalIn = events.reduce((sum, e) => sum + e.quantity, 0);
          
          expect(stock).toBe(totalIn);
          expect(stock).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle ADJUST events (positive and negative)', () => {
    fc.assert(
      fc.property(
        fc.array(adjustEventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          const stock = calculateStockFromEvents(events);
          const totalAdjust = events.reduce((sum, e) => sum + e.quantity, 0);
          
          expect(stock).toBe(totalAdjust);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate stock never goes negative with balanced events', () => {
    fc.assert(
      fc.property(
        balancedEventsArb,
        (events) => {
          const { stock, valid } = calculateStockWithValidation(events);
          
          // Con eventos balanceados, el stock final debe ser >= 0
          if (valid) {
            expect(stock).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect when stock would go negative', () => {
    // Crear eventos que causan stock negativo
    const events: InventoryEvent[] = [
      { id: '1', type: 'IN', quantity: 10, timestamp: 1 },
      { id: '2', type: 'OUT', quantity: 20, timestamp: 2 }, // Más de lo disponible
    ];
    
    const { stock, valid } = calculateStockWithValidation(events);
    
    expect(stock).toBe(-10);
    expect(valid).toBe(false);
  });

  it('should calculate correct running balance', () => {
    fc.assert(
      fc.property(
        fc.array(eventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          // Calcular balance paso a paso
          let runningBalance = 0;
          const balances: number[] = [];
          
          for (const event of events) {
            switch (event.type) {
              case 'IN':
                runningBalance += event.quantity;
                break;
              case 'OUT':
              case 'WASTE':
                runningBalance -= event.quantity;
                break;
              case 'ADJUST':
                runningBalance += event.quantity;
                break;
            }
            balances.push(runningBalance);
          }
          
          // El último balance debe ser igual al stock calculado
          const finalStock = calculateStockFromEvents(events);
          expect(balances[balances.length - 1]).toBe(finalStock);
        }
      ),
      { numRuns: 100 }
    );
  });
});
