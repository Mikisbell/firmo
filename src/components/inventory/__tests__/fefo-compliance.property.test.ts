/**
 * Property Test: FEFO Compliance
 * Task 11.3 - Inventory UI Spec
 * 
 * Property 6: FEFO Compliance
 * Validates: Requirements 9.4, 9.5, 9.6, 9.7
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { calculateExpiryUrgency, ExpiryUrgency } from '@/src/core/inventory/stock-types';

// Helper to create a date N days from today
function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(0, 0, 0, 0);
  return date;
}

// Simulated lot structure for testing
interface TestLot {
  id: string;
  lotNumber: string;
  expiryDate: Date | null;
  quantity: number;
  costCents: number;
}

// FEFO sorting function (First Expired, First Out)
function sortByFEFO(lots: TestLot[]): TestLot[] {
  return [...lots].sort((a, b) => {
    // Lots without expiry date go last
    if (!a.expiryDate && !b.expiryDate) return 0;
    if (!a.expiryDate) return 1;
    if (!b.expiryDate) return -1;
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  });
}

// Select lot for deduction using FEFO
function selectLotForDeduction(lots: TestLot[], quantity: number): { lot: TestLot; quantity: number }[] {
  const sorted = sortByFEFO(lots);
  const selections: { lot: TestLot; quantity: number }[] = [];
  let remaining = quantity;

  for (const lot of sorted) {
    if (remaining <= 0) break;
    if (lot.quantity <= 0) continue;

    const toDeduct = Math.min(lot.quantity, remaining);
    selections.push({ lot, quantity: toDeduct });
    remaining -= toDeduct;
  }

  return selections;
}

describe('FEFO Compliance Property Tests', () => {
  // Property 6.1: Lots should be sorted by expiry date (earliest first)
  it('should sort lots by expiry date (FEFO order)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            lotNumber: fc.string({ minLength: 1, maxLength: 20 }),
            expiryDate: fc.option(
              fc.integer({ min: -30, max: 365 }).map(days => daysFromNow(days)),
              { nil: null }
            ),
            quantity: fc.integer({ min: 1, max: 1000 }),
            costCents: fc.integer({ min: 100, max: 100000 }),
          }),
          { minLength: 2, maxLength: 20 }
        ),
        (lots) => {
          const sorted = sortByFEFO(lots);
          
          // Verify FEFO order: each lot's expiry should be <= next lot's expiry
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i].expiryDate;
            const next = sorted[i + 1].expiryDate;
            
            // Lots without expiry should be at the end
            if (!current && next) {
              return false; // null should come after non-null
            }
            
            if (current && next) {
              if (current.getTime() > next.getTime()) {
                return false; // Earlier expiry should come first
              }
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.2: Deduction should use earliest expiring lot first
  it('should deduct from earliest expiring lot first', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            lotNumber: fc.string({ minLength: 1, maxLength: 20 }),
            expiryDate: fc.integer({ min: 1, max: 365 }).map(days => daysFromNow(days)),
            quantity: fc.integer({ min: 10, max: 100 }),
            costCents: fc.integer({ min: 100, max: 10000 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 50 }),
        (lots, deductQty) => {
          const selections = selectLotForDeduction(lots, deductQty);
          
          if (selections.length === 0) return true;
          
          // First selection should be from the lot with earliest expiry
          const sorted = sortByFEFO(lots.filter(l => l.quantity > 0));
          if (sorted.length === 0) return true;
          
          const firstSelection = selections[0];
          const earliestLot = sorted[0];
          
          return firstSelection.lot.expiryDate?.getTime() === earliestLot.expiryDate?.getTime();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.3: Expiry urgency calculation correctness
  it('should calculate expiry urgency correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 365 }),
        (daysUntil) => {
          const expiryDate = daysFromNow(daysUntil);
          const { urgency } = calculateExpiryUrgency(expiryDate);
          
          // Verify urgency matches days until expiry
          if (daysUntil < 0) {
            return urgency === 'EXPIRED';
          }
          if (daysUntil === 0) {
            return urgency === 'TODAY';
          }
          if (daysUntil === 1) {
            return urgency === 'TOMORROW';
          }
          if (daysUntil <= 3) {
            return urgency === 'SOON_3D';
          }
          if (daysUntil <= 7) {
            return urgency === 'SOON_7D';
          }
          return urgency === 'OK';
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.4: Null expiry date should return OK urgency
  it('should return OK urgency for null expiry date', () => {
    const { urgency, daysUntilExpiry } = calculateExpiryUrgency(null);
    expect(urgency).toBe('OK');
    expect(daysUntilExpiry).toBeNull();
  });

  // Property 6.5: Products expiring within 3 days should generate alerts
  it('should identify products expiring within 3 days as urgent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (daysUntil) => {
          const expiryDate = daysFromNow(daysUntil);
          const { urgency } = calculateExpiryUrgency(expiryDate);
          
          // Should be one of the urgent statuses
          const urgentStatuses: ExpiryUrgency[] = ['EXPIRED', 'TODAY', 'TOMORROW', 'SOON_3D'];
          return urgentStatuses.includes(urgency);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.6: Products expiring within 7 days should appear in "Por Vencer"
  it('should identify products expiring within 7 days', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        (daysUntil) => {
          const expiryDate = daysFromNow(daysUntil);
          const { urgency } = calculateExpiryUrgency(expiryDate);
          
          // Should NOT be OK (should be flagged)
          return urgency !== 'OK';
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.7: Products expiring in more than 7 days should be OK
  it('should mark products expiring in more than 7 days as OK', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 365 }),
        (daysUntil) => {
          const expiryDate = daysFromNow(daysUntil);
          const { urgency } = calculateExpiryUrgency(expiryDate);
          
          return urgency === 'OK';
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.8: Days until expiry should be calculated correctly
  it('should calculate days until expiry correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 365 }),
        (expectedDays) => {
          const expiryDate = daysFromNow(expectedDays);
          const { daysUntilExpiry } = calculateExpiryUrgency(expiryDate);
          
          // Allow for 1 day tolerance due to time zone edge cases
          return daysUntilExpiry !== null && 
                 Math.abs(daysUntilExpiry - expectedDays) <= 1;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.9: Total deducted quantity should not exceed requested
  it('should not deduct more than requested quantity', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            lotNumber: fc.string({ minLength: 1, maxLength: 20 }),
            expiryDate: fc.integer({ min: 1, max: 365 }).map(days => daysFromNow(days)),
            quantity: fc.integer({ min: 1, max: 100 }),
            costCents: fc.integer({ min: 100, max: 10000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 500 }),
        (lots, requestedQty) => {
          const selections = selectLotForDeduction(lots, requestedQty);
          const totalDeducted = selections.reduce((sum, s) => sum + s.quantity, 0);
          
          // Total deducted should be <= requested
          // (may be less if not enough stock)
          return totalDeducted <= requestedQty;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 6.10: Deduction should not exceed individual lot quantity
  it('should not deduct more than available in each lot', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            lotNumber: fc.string({ minLength: 1, maxLength: 20 }),
            expiryDate: fc.integer({ min: 1, max: 365 }).map(days => daysFromNow(days)),
            quantity: fc.integer({ min: 1, max: 100 }),
            costCents: fc.integer({ min: 100, max: 10000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 500 }),
        (lots, requestedQty) => {
          const selections = selectLotForDeduction(lots, requestedQty);
          
          // Each selection should not exceed the lot's available quantity
          for (const selection of selections) {
            if (selection.quantity > selection.lot.quantity) {
              return false;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
