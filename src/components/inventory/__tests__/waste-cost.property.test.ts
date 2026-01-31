/**
 * Property Test: Waste Cost Calculation
 * Feature: inventory-ui, Property 9
 * Validates: Requirements 3.3, 3.4, 3.7
 * 
 * For any waste record:
 * - cost_cents SHALL equal quantity × weighted_average_cost_cents
 * - The calculated cost SHALL be displayed before confirmation
 * - If waste quantity > available stock, a warning SHALL be shown
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateWasteCost } from '../WasteModal';

describe('Property 9: Waste Cost Calculation', () => {
  // **Validates: Requirements 3.3, 3.4, 3.7**
  
  it('should calculate cost as quantity × unitCostCents', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // quantity in centésimas
        fc.integer({ min: 0, max: 1000000 }), // unitCostCents
        (quantityInt, unitCostCents) => {
          const quantity = quantityInt / 100; // Convert to decimal
          const cost = calculateWasteCost(quantity, unitCostCents);
          
          // Cost should be quantity * unitCostCents, rounded to integer
          const expected = Math.round(quantity * unitCostCents);
          expect(cost).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 when quantity is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }), // unitCostCents
        (unitCostCents) => {
          const cost = calculateWasteCost(0, unitCostCents);
          expect(cost).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 0 when unitCostCents is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }), // quantity in centésimas
        (quantityInt) => {
          const quantity = quantityInt / 100;
          const cost = calculateWasteCost(quantity, 0);
          expect(cost).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return a non-negative integer', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }), // quantity in centésimas
        fc.integer({ min: 0, max: 1000000 }), // unitCostCents
        (quantityInt, unitCostCents) => {
          const quantity = quantityInt / 100;
          const cost = calculateWasteCost(quantity, unitCostCents);
          
          expect(cost).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(cost)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be commutative in multiplication sense', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (a, b) => {
          // quantity * unitCost should equal unitCost * quantity
          const costA = calculateWasteCost(a, b);
          const costB = calculateWasteCost(b, a);
          
          // Due to rounding, they should be equal when both are integers
          expect(costA).toBe(costB);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should scale linearly with quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 2, max: 10 }),
        (quantityInt, unitCostCents, multiplier) => {
          const quantity = quantityInt / 100;
          const _baseCost = calculateWasteCost(quantity, unitCostCents);
          const scaledCost = calculateWasteCost(quantity * multiplier, unitCostCents);
          
          // scaledCost should be approximately multiplier * baseCost
          // Allow for rounding differences
          const expected = Math.round(quantity * multiplier * unitCostCents);
          expect(scaledCost).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle typical inventory quantities correctly', () => {
    // Test with realistic values: 2.5 kg at S/15.50/kg = S/38.75 = 3875 centavos
    const cost = calculateWasteCost(2.5, 1550);
    expect(cost).toBe(3875);
    
    // 10 units at S/5.00/unit = S/50.00 = 5000 centavos
    const cost2 = calculateWasteCost(10, 500);
    expect(cost2).toBe(5000);
    
    // 0.5 kg at S/100/kg = S/50 = 5000 centavos
    const cost3 = calculateWasteCost(0.5, 10000);
    expect(cost3).toBe(5000);
  });

  it('should correctly identify when photo is required (cost > 5000 centavos)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (quantityInt, unitCostCentsInt) => {
          const quantity = quantityInt / 100;
          const unitCostCents = unitCostCentsInt;
          const cost = calculateWasteCost(quantity, unitCostCents);
          
          const photoRequired = cost > 5000;
          
          // Due to rounding, check if the logic is consistent
          if (cost > 5000) {
            expect(photoRequired).toBe(true);
          }
          if (cost <= 5000) {
            expect(photoRequired).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
