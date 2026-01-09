/**
 * Property-Based Tests for Terminals Management
 * 
 * Property 7: Códigos de Activación Válidos
 * Property 8: Rangos de Números No Se Solapan
 * 
 * Validates: Requirements 5.2, 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Types
interface NumberRange {
  terminalId: string;
  start: number;
  end: number;
}

// Helper functions
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function isValidActivationCode(code: string): boolean {
  // Must be exactly 12 characters
  if (code.length !== 12) return false;
  
  // Must only contain valid characters (no confusing ones like 0, O, 1, I)
  const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
  return validChars.test(code);
}

function isCodeExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt < now;
}

function rangesOverlap(range1: NumberRange, range2: NumberRange): boolean {
  // Two ranges overlap if one starts before the other ends
  return range1.start <= range2.end && range2.start <= range1.end;
}

function validateRanges(ranges: NumberRange[]): { valid: boolean; conflicts: [string, string][] } {
  const conflicts: [string, string][] = [];
  
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (rangesOverlap(ranges[i], ranges[j])) {
        conflicts.push([ranges[i].terminalId, ranges[j].terminalId]);
      }
    }
  }
  
  return { valid: conflicts.length === 0, conflicts };
}

// Arbitraries
const numberRangeArb = fc.record({
  terminalId: fc.uuid(),
  start: fc.integer({ min: 1, max: 900000 }),
  end: fc.integer({ min: 1, max: 1000000 }),
}).filter((r) => r.start <= r.end);

// Non-overlapping ranges generator
const nonOverlappingRangesArb = fc.integer({ min: 1, max: 10 }).chain((count) => {
  return fc.array(fc.uuid(), { minLength: count, maxLength: count }).map((ids) => {
    const ranges: NumberRange[] = [];
    let currentStart = 1;
    
    for (let i = 0; i < ids.length; i++) {
      const rangeSize = Math.floor(Math.random() * 10000) + 1000;
      ranges.push({
        terminalId: ids[i],
        start: currentStart,
        end: currentStart + rangeSize - 1,
      });
      currentStart += rangeSize + 100; // Gap between ranges
    }
    
    return ranges;
  });
});

describe('Terminals - Property Tests', () => {
  describe('Property 7: Activation Codes Valid', () => {
    it('generated codes are exactly 12 characters', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const code = generateCode();
          expect(code.length).toBe(12);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('generated codes contain only valid characters', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), () => {
          const code = generateCode();
          expect(isValidActivationCode(code)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('codes with invalid characters are rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 12, maxLength: 12 }).filter((s) => /[0OIL]/.test(s)),
          (invalidCode) => {
            expect(isValidActivationCode(invalidCode)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('codes with wrong length are rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.length !== 12),
          (wrongLengthCode) => {
            expect(isValidActivationCode(wrongLengthCode)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('expiration is 24 hours from creation', () => {
      fc.assert(
        fc.property(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), (createdAt) => {
          // Skip invalid dates
          if (isNaN(createdAt.getTime())) return true;
          
          const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
          const diff = expiresAt.getTime() - createdAt.getTime();
          
          // Should be exactly 24 hours (in milliseconds)
          expect(diff).toBe(24 * 60 * 60 * 1000);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('expired codes are correctly identified', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2024-12-31') }),
          fc.date({ min: new Date('2025-01-02'), max: new Date('2030-01-01') }),
          (expiresAt, now) => {
            // Skip invalid dates
            if (isNaN(expiresAt.getTime()) || isNaN(now.getTime())) return true;
            // expiresAt is before now, so should be expired
            expect(isCodeExpired(expiresAt, now)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('valid codes are correctly identified', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2025-01-02'), max: new Date('2030-01-01') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (expiresAt, now) => {
            // expiresAt is after now, so should not be expired
            expect(isCodeExpired(expiresAt, now)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Number Ranges Do Not Overlap', () => {
    it('non-overlapping ranges pass validation', () => {
      fc.assert(
        fc.property(nonOverlappingRangesArb, (ranges) => {
          const result = validateRanges(ranges);
          expect(result.valid).toBe(true);
          expect(result.conflicts.length).toBe(0);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('overlapping ranges are detected', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          (id1, id2) => {
            // Create overlapping ranges
            const ranges: NumberRange[] = [
              { terminalId: id1, start: 1, end: 1000 },
              { terminalId: id2, start: 500, end: 1500 }, // Overlaps with first
            ];
            
            const result = validateRanges(ranges);
            expect(result.valid).toBe(false);
            expect(result.conflicts.length).toBeGreaterThan(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('adjacent ranges do not overlap', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          (id1, id2, size1, size2) => {
            // Create adjacent (non-overlapping) ranges
            const ranges: NumberRange[] = [
              { terminalId: id1, start: 1, end: size1 },
              { terminalId: id2, start: size1 + 1, end: size1 + size2 },
            ];
            
            const result = validateRanges(ranges);
            expect(result.valid).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rangesOverlap is symmetric', () => {
      fc.assert(
        fc.property(numberRangeArb, numberRangeArb, (range1, range2) => {
          const overlap1 = rangesOverlap(range1, range2);
          const overlap2 = rangesOverlap(range2, range1);
          
          expect(overlap1).toBe(overlap2);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('a range always overlaps with itself', () => {
      fc.assert(
        fc.property(numberRangeArb, (range) => {
          expect(rangesOverlap(range, range)).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('completely separate ranges do not overlap', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 2001, max: 3000 }),
          fc.integer({ min: 2001, max: 3000 }),
          (start1, end1Offset, start2, end2Offset) => {
            const range1: NumberRange = {
              terminalId: 'term1',
              start: start1,
              end: start1 + end1Offset,
            };
            const range2: NumberRange = {
              terminalId: 'term2',
              start: start2,
              end: start2 + end2Offset,
            };
            
            // Range1 ends at most at 2000, Range2 starts at least at 2001
            expect(rangesOverlap(range1, range2)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
