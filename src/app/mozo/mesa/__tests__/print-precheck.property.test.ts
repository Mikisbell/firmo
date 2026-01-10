/**
 * Property-based tests for Print Precheck functionality
 * Task 5.3 - Frontend Cleanup Spec
 * 
 * NOTE: These tests use the actual transformLinesToPrint function
 * from src/core/printing/utils.ts to ensure the implementation
 * matches the specification.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { transformLinesToPrint, calculatePrintTotal, OrderLineInput } from '@/src/core/printing/utils';

// Arbitraries
const orderLineArb: fc.Arbitrary<OrderLineInput> = fc.record({
  line_id: fc.uuid(),
  product_id: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  qty: fc.integer({ min: 1, max: 99 }),
  unit_price_cents: fc.integer({ min: 100, max: 100000 }),
  line_total_cents: fc.integer({ min: 100, max: 1000000 }),
  station: fc.option(fc.constantFrom('PARRILLA', 'COCINA', 'BAR', 'FRIOS'), { nil: undefined })
});

describe('Print Precheck Properties', () => {
  describe('Property 1: Precheck Contains All Order Items', () => {
    /**
     * **Validates: Requirements 4.1**
     * WHEN a waiter clicks the print precheck button, THE System SHALL generate 
     * a precheck document with current order items and totals
     */
    it('all order items appear in precheck output', () => {
      fc.assert(
        fc.property(
          fc.array(orderLineArb, { minLength: 1, maxLength: 20 }),
          (items) => {
            const printLines = transformLinesToPrint(items);
            
            // Property: Same number of items
            expect(printLines.length).toBe(items.length);
            
            // Property: Each item is represented correctly
            items.forEach((item, idx) => {
              const printLine = printLines[idx];
              expect(printLine.name).toBe(item.name || item.product_id);
              expect(printLine.qty).toBe(item.qty);
              expect(printLine.total).toBe(item.line_total_cents);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('item order is preserved in precheck', () => {
      fc.assert(
        fc.property(
          fc.array(orderLineArb, { minLength: 2, maxLength: 10 }),
          (items) => {
            const printLines = transformLinesToPrint(items);
            
            // Property: Order is preserved
            for (let i = 0; i < items.length; i++) {
              expect(printLines[i].name).toBe(items[i].name || items[i].product_id);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: Precheck Totals Are Accurate', () => {
    /**
     * **Validates: Requirements 4.1**
     * Totals must be preserved exactly without rounding errors
     */
    it('sum of print line totals equals sum of order line totals', () => {
      fc.assert(
        fc.property(
          fc.array(orderLineArb, { minLength: 1, maxLength: 20 }),
          (items) => {
            const printLines = transformLinesToPrint(items);
            
            const orderTotal = items.reduce((sum, item) => sum + item.line_total_cents, 0);
            const printTotal = calculatePrintTotal(printLines);
            
            // Property: Totals match exactly
            expect(printTotal).toBe(orderTotal);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('individual line totals are preserved exactly', () => {
      fc.assert(
        fc.property(
          orderLineArb,
          (item) => {
            const [printLine] = transformLinesToPrint([item]);
            
            // Property: Line total is preserved exactly (no rounding errors)
            expect(printLine.total).toBe(item.line_total_cents);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Name Fallback Behavior', () => {
    /**
     * Ensures name fallback to product_id works correctly
     */
    it('uses product_id when name is empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            line_id: fc.uuid(),
            product_id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.constant(''), // Empty name
            qty: fc.integer({ min: 1, max: 99 }),
            unit_price_cents: fc.integer({ min: 100, max: 100000 }),
            line_total_cents: fc.integer({ min: 100, max: 1000000 }),
          }),
          (item) => {
            const [printLine] = transformLinesToPrint([item as OrderLineInput]);
            
            // Property: Falls back to product_id when name is empty
            expect(printLine.name).toBe(item.product_id);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('uses name when available', () => {
      fc.assert(
        fc.property(
          fc.record({
            line_id: fc.uuid(),
            product_id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 }), // Non-empty name
            qty: fc.integer({ min: 1, max: 99 }),
            unit_price_cents: fc.integer({ min: 100, max: 100000 }),
            line_total_cents: fc.integer({ min: 100, max: 1000000 }),
          }),
          (item) => {
            const [printLine] = transformLinesToPrint([item as OrderLineInput]);
            
            // Property: Uses name when available
            expect(printLine.name).toBe(item.name);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 4: Quantity Preservation', () => {
    /**
     * Quantities must be preserved as positive integers
     */
    it('quantities are always positive integers', () => {
      fc.assert(
        fc.property(
          fc.array(orderLineArb, { minLength: 1, maxLength: 10 }),
          (items) => {
            const printLines = transformLinesToPrint(items);
            
            // Property: All quantities are positive integers
            printLines.forEach(line => {
              expect(Number.isInteger(line.qty)).toBe(true);
              expect(line.qty).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 5: Empty Order Handling', () => {
    /**
     * Edge case: Empty orders should produce empty print lines
     */
    it('empty order produces empty print lines', () => {
      const printLines = transformLinesToPrint([]);
      expect(printLines).toEqual([]);
      expect(calculatePrintTotal(printLines)).toBe(0);
    });
  });
});
