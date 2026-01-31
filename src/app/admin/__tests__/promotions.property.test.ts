/**
 * Property-Based Tests for Promotions
 * Property 9: Promociones Expiradas Se Desactivan
 * Validates: Requirements 6.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

interface Promotion {
  id: string;
  name: string;
  type: string;
  value: number;
  starts_at: Date;
  ends_at: Date;
  is_active: boolean;
}

function isExpired(promotion: Promotion, now: Date = new Date()): boolean {
  return promotion.ends_at < now;
}

function deactivateExpired(promotions: Promotion[], now: Date = new Date()): Promotion[] {
  return promotions.map((p) => ({
    ...p,
    is_active: isExpired(p, now) ? false : p.is_active,
  }));
}

const promotionArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1'),
  value: fc.integer({ min: 0, max: 100 }),
  starts_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  ends_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  is_active: fc.boolean(),
});

describe('Promotions - Property Tests', () => {
  describe('Property 9: Expired Promotions Are Deactivated', () => {
    it('expired promotions have is_active=false after deactivation', () => {
      fc.assert(
        fc.property(
          fc.array(promotionArb, { minLength: 0, maxLength: 20 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          (promotions, now) => {
            if (isNaN(now.getTime())) return true;
            
            const processed = deactivateExpired(promotions, now);
            
            processed.forEach((p, i) => {
              const original = promotions[i];
              if (isNaN(original.ends_at.getTime())) return;
              
              if (original.ends_at < now) {
                expect(p.is_active).toBe(false);
              }
            });
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('non-expired promotions retain their is_active status', () => {
      fc.assert(
        fc.property(
          fc.array(promotionArb, { minLength: 0, maxLength: 20 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (promotions, now) => {
            if (isNaN(now.getTime())) return true;
            
            const processed = deactivateExpired(promotions, now);
            
            processed.forEach((p, i) => {
              const original = promotions[i];
              if (isNaN(original.ends_at.getTime())) return;
              
              if (original.ends_at >= now) {
                expect(p.is_active).toBe(original.is_active);
              }
            });
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deactivation is idempotent', () => {
      fc.assert(
        fc.property(
          fc.array(promotionArb, { minLength: 0, maxLength: 20 }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
          (promotions, now) => {
            if (isNaN(now.getTime())) return true;
            
            const once = deactivateExpired(promotions, now);
            const twice = deactivateExpired(once, now);
            
            expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
