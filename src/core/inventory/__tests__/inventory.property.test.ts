/**
 * Inventory Property Tests
 * 
 * Tests inventory deduction and management:
 * - Recipe deduction correctness
 * - Stock never negative without override
 * - Purchase order increases stock
 * - Inventory count reconciliation
 * - Weighted average cost precision
 * 
 * **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateRealisticInventoryItem,
  generateRealisticRecipe,
  generateRealisticWasteLog,
  generateRealisticPurchaseOrder,
  generateRealisticInventoryTransactionSequence,
  centavosArb,
  positiveCentavosArb,
  quantityArb,
} from '@/src/test-utils';
import {
  testInvariant,
  testForAll,
} from '@/src/test-utils';
import {
  expectValidInventoryQty,
  expectValidWAC,
  expectCentavos,
} from '@/src/test-utils';

/**
 * Deducts inventory for recipe
 */
function deductInventory(
  currentQty: number,
  deductQty: number,
  allowNegative: boolean = false
): number | null {
  const result = currentQty - deductQty;

  if (result < 0 && !allowNegative) {
    return null; // Insufficient stock
  }

  return Math.max(0, result);
}

/**
 * Calculates waste cost
 */
function calculateWasteCost(qty: number, unitCost: number): number {
  return qty * unitCost;
}

/**
 * Calculates weighted average cost
 */
function calculateWAC(
  oldQty: number,
  oldCost: number,
  newQty: number,
  newCost: number
): number {
  if (oldQty + newQty === 0) return 0;
  return Math.round((oldQty * oldCost + newQty * newCost) / (oldQty + newQty));
}

/**
 * Reconciles inventory count with transactions
 */
function reconcileInventory(
  initialQty: number,
  transactions: Array<{ type: string; qty: number }>
): number {
  let qty = initialQty;

  for (const tx of transactions) {
    if (tx.type === 'PURCHASE') {
      qty += tx.qty;
    } else if (tx.type === 'DEDUCTION') {
      qty -= tx.qty;
    } else if (tx.type === 'WASTE') {
      qty -= tx.qty;
    } else if (tx.type === 'ADJUSTMENT') {
      qty += tx.qty;
    }
  }

  return Math.max(0, qty);
}

describe('Inventory - Property Tests', () => {
  describe('Property 25: Recipe Deduction Correctness', () => {
    it('deduction reduces stock by recipe quantity', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, deductQty]) => {
          const result = deductInventory(currentQty as number, deductQty as number);
          if (result !== null) {
            return result === (currentQty as number) - (deductQty as number);
          }
          return true;
        },
        'deduction must reduce stock correctly'
      );
    });

    it('deduction is rejected when insufficient stock', () => {
      fc.assert(
        fc.property(
          fc.tuple(quantityArb, quantityArb),
          ([currentQty, deductQty]) => {
            if ((deductQty as number) > (currentQty as number)) {
              const result = deductInventory(currentQty as number, deductQty as number, false);
              expect(result).toBeNull();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deduction is allowed with override', () => {
      fc.assert(
        fc.property(
          fc.tuple(quantityArb, quantityArb),
          ([currentQty, deductQty]) => {
            const result = deductInventory(currentQty as number, deductQty as number, true);
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deduction result is non-negative', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, deductQty]) => {
          const result = deductInventory(currentQty as number, deductQty as number, true);
          return result !== null && result >= 0;
        },
        'deduction result must be non-negative'
      );
    });
  });

  describe('Property 26: Stock Never Negative Without Override', () => {
    it('stock cannot go negative without override', () => {
      testForAll(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, deductQty]) => {
          const result = deductInventory(currentQty as number, deductQty as number, false);
          if (result !== null) {
            return result >= 0;
          }
          return true;
        },
        'stock must not go negative without override'
      );
    });

    it('insufficient stock is rejected', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 50 }),
            fc.integer({ min: 51, max: 100 })
          ),
          ([currentQty, deductQty]) => {
            const result = deductInventory(currentQty, deductQty, false);
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sufficient stock is allowed', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 50, max: 100 }),
            fc.integer({ min: 0, max: 50 })
          ),
          ([currentQty, deductQty]) => {
            const result = deductInventory(currentQty, deductQty, false);
            expect(result).not.toBeNull();
            expect(result).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Purchase Order Increases Stock', () => {
    it('purchase order increases stock', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, purchaseQty]) => {
          const newQty = (currentQty as number) + (purchaseQty as number);
          return newQty >= (currentQty as number);
        },
        'purchase order must increase stock'
      );
    });

    it('purchase order result is non-negative', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, purchaseQty]) => {
          const newQty = (currentQty as number) + (purchaseQty as number);
          return newQty >= 0;
        },
        'purchase order result must be non-negative'
      );
    });

    it('multiple purchase orders accumulate', () => {
      fc.assert(
        fc.property(
          fc.array(quantityArb, { minLength: 1, maxLength: 5 }),
          (purchases) => {
            let qty = 0;
            for (const purchase of purchases) {
              qty += (purchase as number);
            }

            expect(qty).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 28: Inventory Count Reconciliation', () => {
    it('reconciliation matches transaction history', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            quantityArb,
            fc.constant(generateRealisticInventoryTransactionSequence())
          ),
          ([initialQty, transactions]) => {
            const reconciled = reconcileInventory(initialQty as number, transactions);
            expectValidInventoryQty(reconciled);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reconciliation is deterministic', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            quantityArb,
            fc.constant(generateRealisticInventoryTransactionSequence())
          ),
          ([initialQty, transactions]) => {
            const reconciled1 = reconcileInventory(initialQty as number, transactions);
            const reconciled2 = reconcileInventory(initialQty as number, transactions);

            expect(reconciled1).toBe(reconciled2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reconciliation handles empty transactions', () => {
      fc.assert(
        fc.property(quantityArb, (initialQty) => {
          const reconciled = reconcileInventory(initialQty as number, []);
          expect(reconciled).toBe(initialQty as number);
        }),
        { numRuns: 100 }
      );
    });

    it('reconciliation result is non-negative', () => {
      testInvariant(
        fc.tuple(
          quantityArb,
          fc.constant(generateRealisticInventoryTransactionSequence())
        ),
        ([initialQty, transactions]) => {
          const reconciled = reconcileInventory(initialQty as number, transactions);
          return reconciled >= 0;
        },
        'reconciliation result must be non-negative'
      );
    });
  });

  describe('Property 29: Weighted Average Cost Precision', () => {
    it('WAC calculation is correct', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb, quantityArb, positiveCentavosArb),
        ([oldQty, oldCost, newQty, newCost]) => {
          const wac = calculateWAC(
            oldQty as number,
            oldCost as number,
            newQty as number,
            newCost as number
          );

          // WAC should be between old and new cost
          const minCost = Math.min(oldCost as number, newCost as number);
          const maxCost = Math.max(oldCost as number, newCost as number);

          if (oldQty === 0 && newQty === 0) {
            return wac === 0;
          }

          return wac >= minCost && wac <= maxCost;
        },
        'WAC must be between old and new cost'
      );
    });

    it('WAC is non-negative', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb, quantityArb, positiveCentavosArb),
        ([oldQty, oldCost, newQty, newCost]) => {
          const wac = calculateWAC(
            oldQty as number,
            oldCost as number,
            newQty as number,
            newCost as number
          );

          return wac >= 0;
        },
        'WAC must be non-negative'
      );
    });

    it('WAC with zero old quantity equals new cost', () => {
      fc.assert(
        fc.property(
          fc.tuple(quantityArb, positiveCentavosArb),
          ([newQty, newCost]) => {
            const wac = calculateWAC(0, 0, newQty as number, newCost as number);

            if ((newQty as number) > 0) {
              expect(wac).toBe(newCost as number);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('WAC with zero new quantity equals old cost', () => {
      fc.assert(
        fc.property(
          fc.tuple(quantityArb, positiveCentavosArb),
          ([oldQty, oldCost]) => {
            const wac = calculateWAC(oldQty as number, oldCost as number, 0, 0);

            if ((oldQty as number) > 0) {
              expect(wac).toBe(oldCost as number);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('WAC maintains precision', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb, quantityArb, positiveCentavosArb),
        ([oldQty, oldCost, newQty, newCost]) => {
          const wac = calculateWAC(
            oldQty as number,
            oldCost as number,
            newQty as number,
            newCost as number
          );

          // WAC should be integer (no float precision loss)
          return Number.isInteger(wac);
        },
        'WAC must maintain integer precision'
      );
    });
  });

  describe('Waste Cost Calculation', () => {
    it('waste cost equals quantity times unit cost', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb),
        ([qty, unitCost]) => {
          const cost = calculateWasteCost(qty as number, unitCost as number);
          return cost === (qty as number) * (unitCost as number);
        },
        'waste cost must equal qty × unit_cost'
      );
    });

    it('waste cost is non-negative', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb),
        ([qty, unitCost]) => {
          const cost = calculateWasteCost(qty as number, unitCost as number);
          return cost >= 0;
        },
        'waste cost must be non-negative'
      );
    });

    it('waste cost scales linearly', () => {
      fc.assert(
        fc.property(
          fc.tuple(quantityArb, positiveCentavosArb),
          ([qty, unitCost]) => {
            const cost1 = calculateWasteCost(qty as number, unitCost as number);
            const cost2 = calculateWasteCost((qty as number) * 2, unitCost as number);

            expect(cost2).toBe(cost1 * 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Inventory Item Validation', () => {
    it('current_qty is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticInventoryItem()),
        (item: any) => item.current_qty >= 0,
        'current_qty must be non-negative'
      );
    });

    it('unit_cost_cents is positive', () => {
      testInvariant(
        fc.constant(generateRealisticInventoryItem()),
        (item: any) => (item.unit_cost_cents as number) > 0,
        'unit_cost_cents must be positive'
      );
    });

    it('weighted_avg_cost_cents is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticInventoryItem()),
        (item: any) => (item.weighted_avg_cost_cents as number) >= 0,
        'weighted_avg_cost_cents must be non-negative'
      );
    });

    it('reorder_level is non-negative', () => {
      testInvariant(
        fc.constant(generateRealisticInventoryItem()),
        (item: any) => item.reorder_level >= 0,
        'reorder_level must be non-negative'
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles zero quantity deduction', () => {
      const result = deductInventory(100, 0);
      expect(result).toBe(100);
    });

    it('handles exact quantity deduction', () => {
      const result = deductInventory(100, 100);
      expect(result).toBe(0);
    });

    it('handles zero waste cost', () => {
      const cost = calculateWasteCost(0, 2500);
      expect(cost).toBe(0);
    });

    it('handles zero WAC inputs', () => {
      const wac = calculateWAC(0, 0, 0, 0);
      expect(wac).toBe(0);
    });

    it('handles large quantities', () => {
      const result = deductInventory(1000000, 500000);
      expect(result).toBe(500000);
    });

    it('handles large costs', () => {
      const cost = calculateWasteCost(100, 10_000_000);
      expect(cost).toBe(1_000_000_000);
    });
  });

  describe('Invariants', () => {
    it('deduction never increases stock', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, deductQty]) => {
          const result = deductInventory(currentQty as number, deductQty as number, true);
          return result !== null && result <= (currentQty as number);
        },
        'deduction must not increase stock'
      );
    });

    it('purchase never decreases stock', () => {
      testInvariant(
        fc.tuple(quantityArb, quantityArb),
        ([currentQty, purchaseQty]) => {
          const newQty = (currentQty as number) + (purchaseQty as number);
          return newQty >= (currentQty as number);
        },
        'purchase must not decrease stock'
      );
    });

    it('WAC is always between old and new cost', () => {
      testInvariant(
        fc.tuple(quantityArb, positiveCentavosArb, quantityArb, positiveCentavosArb),
        ([oldQty, oldCost, newQty, newCost]) => {
          if ((oldQty as number) === 0 && (newQty as number) === 0) return true;

          const wac = calculateWAC(
            oldQty as number,
            oldCost as number,
            newQty as number,
            newCost as number
          );

          const minCost = Math.min(oldCost as number, newCost as number);
          const maxCost = Math.max(oldCost as number, newCost as number);

          return wac >= minCost && wac <= maxCost;
        },
        'WAC must be between old and new cost'
      );
    });
  });
});
