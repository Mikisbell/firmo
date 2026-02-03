/**
 * Property-Based Tests for Promotions
 * Property 9: Promociones Expiradas Se Desactivan
 * Property 18: Promotion Type Validation
 * Validates: Requirements 6.3, 3.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';

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

// Validation schema
const promotionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO']),
  value: z.number().min(0),
  rules: z.record(z.unknown()).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  is_active: z.boolean().default(true),
}).refine(data => new Date(data.starts_at) < new Date(data.ends_at), {
  message: 'Start date must be before end date',
  path: ['starts_at'],
});

const promotionArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.constantFrom('PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO'),
  value: fc.integer({ min: 0, max: 100 }),
  starts_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  ends_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  is_active: fc.boolean(),
});

describe('Promotions - Property Tests', () => {
  describe('Property 18: Promotion Type Validation', () => {
    it('only valid promotion types are accepted', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO'),
          (validType) => {
            const data = {
              name: 'Test Promotion',
              type: validType,
              value: 10,
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 86400000).toISOString(),
            };
            
            const result = promotionSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('invalid promotion types are rejected', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => !['PERCENT', 'FIXED', 'HAPPY_HOUR', '2X1', 'COMBO'].includes(s)),
          (invalidType) => {
            const data = {
              name: 'Test Promotion',
              type: invalidType,
              value: 10,
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 86400000).toISOString(),
            };
            
            const result = promotionSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

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
