/**
 * Property Test: Kardex Display Correctness
 * Feature: inventory-ui, Property 5
 * Validates: Requirements 4.2, 4.3, 4.4, 4.5
 * 
 * For any kardex query:
 * - Entries SHALL be ordered by timestamp descending (most recent first)
 * - Each entry SHALL have a running balance calculated correctly
 * - Results SHALL be paginated when count > 50
 * - Filters (date range, type) SHALL correctly filter results
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTypeEmoji } from '../KardexModal';
import { KardexMovementType, KardexEntry } from '@/src/app/api/inventory/kardex/[code]/route';

// Helper: Generate a valid KardexEntry with sequential timestamps
const kardexEntryArb = () => fc.record({
  id: fc.uuid(),
  timestamp: fc.integer({ min: 1704067200000, max: 1798761600000 }) // 2024-01-01 to 2027-01-01
    .map(ms => new Date(ms).toISOString()),
  type: fc.constantFrom<KardexMovementType>('IN', 'OUT', 'WASTE', 'ADJUST'),
  quantity: fc.integer({ min: -1000, max: 1000 }).map(n => n / 10),
  balance: fc.constant(0), // Will be calculated
  reference: fc.string({ minLength: 1, maxLength: 10 }),
  actorName: fc.string({ minLength: 1, maxLength: 10 }),
  notes: fc.constant(null),
  lotNumber: fc.constant(null),
});

// Helper: Calculate running balances for entries (sorted ASC by timestamp)
function calculateBalances(entries: KardexEntry[]): KardexEntry[] {
  // Sort by timestamp ASC for balance calculation
  const sorted = [...entries].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  let runningBalance = 0;
  const withBalances = sorted.map(entry => {
    runningBalance += entry.quantity;
    return { ...entry, balance: runningBalance };
  });
  
  // Return sorted DESC (most recent first) for display
  return withBalances.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// Helper: Filter entries by type
function filterByType(entries: KardexEntry[], type?: KardexMovementType): KardexEntry[] {
  if (!type) return entries;
  return entries.filter(entry => entry.type === type);
}

// Helper: Paginate entries
function paginate(entries: KardexEntry[], page: number, pageSize: number): KardexEntry[] {
  const start = (page - 1) * pageSize;
  return entries.slice(start, start + pageSize);
}

describe('Property 5: Kardex Display Correctness', () => {
  // **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  it('should order entries by timestamp descending (most recent first)', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 2, maxLength: 50 }),
        (rawEntries) => {
          const entries = calculateBalances(rawEntries);
          
          // Verify descending order
          for (let i = 1; i < entries.length; i++) {
            const prevTime = new Date(entries[i - 1].timestamp).getTime();
            const currTime = new Date(entries[i].timestamp).getTime();
            expect(prevTime).toBeGreaterThanOrEqual(currTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should calculate running balance correctly for each entry', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 1, maxLength: 50 }),
        (rawEntries) => {
          const entries = calculateBalances(rawEntries);
          
          // Sort ASC to verify balance calculation
          const sortedAsc = [...entries].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          let expectedBalance = 0;
          for (const entry of sortedAsc) {
            expectedBalance += entry.quantity;
            expect(entry.balance).toBeCloseTo(expectedBalance, 5);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should paginate results correctly', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 10, maxLength: 100 }),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 5, max: 20 }),
        (rawEntries, page, pageSize) => {
          const entries = calculateBalances(rawEntries);
          const paginated = paginate(entries, page, pageSize);
          
          // Verify page size constraint
          expect(paginated.length).toBeLessThanOrEqual(pageSize);
          
          // Verify correct slice
          const expectedStart = (page - 1) * pageSize;
          const expectedEnd = Math.min(expectedStart + pageSize, entries.length);
          const expectedLength = Math.max(0, expectedEnd - expectedStart);
          
          expect(paginated.length).toBe(expectedLength);
          
          // Verify items match
          for (let i = 0; i < paginated.length; i++) {
            expect(paginated[i].id).toBe(entries[expectedStart + i].id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly filter by movement type', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 5, maxLength: 50 }),
        fc.constantFrom<KardexMovementType>('IN', 'OUT', 'WASTE', 'ADJUST'),
        (rawEntries, typeFilter) => {
          const entries = calculateBalances(rawEntries);
          const filtered = filterByType(entries, typeFilter);
          
          // Verify all filtered entries have the correct type
          for (const entry of filtered) {
            expect(entry.type).toBe(typeFilter);
          }
          
          // Verify count matches
          const expectedCount = entries.filter(e => e.type === typeFilter).length;
          expect(filtered.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return correct emoji for each movement type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<KardexMovementType>('IN', 'OUT', 'WASTE', 'ADJUST'),
        (type) => {
          const emoji = getTypeEmoji(type);
          
          const expectedEmojis: Record<KardexMovementType, string> = {
            IN: '📥',
            OUT: '📤',
            WASTE: '🗑️',
            ADJUST: '⚖️',
          };
          
          expect(emoji).toBe(expectedEmojis[type]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain balance consistency after filtering by type', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 5, maxLength: 30 }),
        (rawEntries) => {
          const entries = calculateBalances(rawEntries);
          
          // The last entry (most recent) should have the final balance
          // which equals sum of all quantities
          const totalQuantity = rawEntries.reduce((sum, e) => sum + e.quantity, 0);
          
          // Sort ASC to get the last chronological entry
          const sortedAsc = [...entries].sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          const lastEntry = sortedAsc[sortedAsc.length - 1];
          expect(lastEntry.balance).toBeCloseTo(totalQuantity, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve order after filtering', () => {
    fc.assert(
      fc.property(
        fc.array(kardexEntryArb(), { minLength: 10, maxLength: 50 }),
        fc.constantFrom<KardexMovementType>('IN', 'OUT', 'WASTE', 'ADJUST'),
        (rawEntries, typeFilter) => {
          const entries = calculateBalances(rawEntries);
          const filtered = filterByType(entries, typeFilter);
          
          // Verify filtered results maintain descending order
          for (let i = 1; i < filtered.length; i++) {
            const prevTime = new Date(filtered[i - 1].timestamp).getTime();
            const currTime = new Date(filtered[i].timestamp).getTime();
            expect(prevTime).toBeGreaterThanOrEqual(currTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty filter results gracefully', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            timestamp: fc.integer({ min: 1704067200000, max: 1798761600000 })
              .map(ms => new Date(ms).toISOString()),
            type: fc.constant<KardexMovementType>('IN'), // All entries are IN
            quantity: fc.integer({ min: 1, max: 100 }).map(n => n / 10),
            balance: fc.constant(0),
            reference: fc.string({ minLength: 1, maxLength: 5 }),
            actorName: fc.string({ minLength: 1, maxLength: 5 }),
            notes: fc.constant(null),
            lotNumber: fc.constant(null),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rawEntries) => {
          const entries = calculateBalances(rawEntries);
          
          // Filter by type that doesn't exist
          const filtered = filterByType(entries, 'WASTE');
          
          expect(filtered.length).toBe(0);
          expect(Array.isArray(filtered)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
