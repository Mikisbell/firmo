/**
 * Property Test: Stock Status Indicator Correctness
 * Feature: inventory-ui, Property 1
 * Validates: Requirements 1.2, 1.3
 * 
 * For any inventory item, the status indicator SHALL be:
 * - 🔴 CRITICAL when stock < minStock
 * - 🟡 LOW when minStock <= stock < 1.5 * minStock
 * - 🟢 OK when stock >= 1.5 * minStock
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateStatus } from '../StockView';

describe('Property 1: Stock Status Indicator Correctness', () => {
  // **Validates: Requirements 1.2, 1.3**
  
  it('should return CRITICAL when stock < minStock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 99 }),
        (minStockInt, percentInt) => {
          const minStock = minStockInt / 100;
          const stock = minStock * (percentInt / 100); // 1-99% of minStock
          
          const status = calculateStatus(stock, minStock);
          expect(status).toBe('CRITICAL');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return LOW when minStock <= stock < 1.5 * minStock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 100, max: 149 }),
        (minStockInt, percentInt) => {
          const minStock = minStockInt / 100;
          const stock = minStock * (percentInt / 100); // 100-149% of minStock
          
          const status = calculateStatus(stock, minStock);
          expect(status).toBe('LOW');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return OK when stock >= 1.5 * minStock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 150, max: 1000 }),
        (minStockInt, percentInt) => {
          const minStock = minStockInt / 100;
          const stock = minStock * (percentInt / 100); // 150%+ of minStock
          
          const status = calculateStatus(stock, minStock);
          expect(status).toBe('OK');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return OK when minStock is 0 or negative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: -100, max: 0 }),
        (stockInt, minStockInt) => {
          const stock = stockInt / 100;
          const minStock = minStockInt / 100;
          
          const status = calculateStatus(stock, minStock);
          expect(status).toBe('OK');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly classify any valid stock/minStock combination', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 10000 }),
        (stockInt, minStockInt) => {
          const stock = stockInt / 100;
          const minStock = minStockInt / 100;
          
          const status = calculateStatus(stock, minStock);
          
          // Verify the status matches the expected classification
          if (minStock <= 0) {
            expect(status).toBe('OK');
          } else if (stock < minStock) {
            expect(status).toBe('CRITICAL');
          } else if (stock < minStock * 1.5) {
            expect(status).toBe('LOW');
          } else {
            expect(status).toBe('OK');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Edge cases
  it('should handle exact boundary at minStock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (minStockInt) => {
          const minStock = minStockInt / 100;
          const status = calculateStatus(minStock, minStock);
          expect(status).toBe('LOW'); // stock == minStock is LOW, not CRITICAL
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle exact boundary at 1.5 * minStock', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (minStockInt) => {
          const minStock = minStockInt / 100;
          const stock = minStock * 1.5;
          const status = calculateStatus(stock, minStock);
          expect(status).toBe('OK'); // stock == 1.5 * minStock is OK
        }
      ),
      { numRuns: 100 }
    );
  });
});
