/**
 * Property-Based Tests for Configuration Management
 * 
 * Property 29: Configuration Value Validation
 * Property 31: Configuration Range Validation
 * 
 * Validates: Requirements 5.1, 5.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';

// Validation schema
const configSchema = z.object({
  business_name: z.string().min(1, 'El nombre del negocio es requerido'),
  business_phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres'),
  timezone: z.enum(['America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver']),
  currency: z.enum(['PEN', 'USD', 'EUR']),
  default_discount_percent: z.number().min(0).max(100).optional(),
  tax_percent: z.number().min(0).max(100).optional(),
  business_hours_open: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  business_hours_close: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

describe('Configuration - Property Tests', () => {
  describe('Property 29: Configuration Value Validation', () => {
    it('valid configuration values are accepted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          (name, phone, timezone, currency) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('invalid timezone is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.string().filter(s => !['America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'].includes(s)),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          (name, phone, invalidTimezone, currency) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone: invalidTimezone,
              currency,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('invalid currency is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.string().filter(s => !['PEN', 'USD', 'EUR'].includes(s)),
          (name, phone, timezone, invalidCurrency) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency: invalidCurrency,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('empty business name is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          (phone, timezone, currency) => {
            const data = {
              business_name: '',
              business_phone: phone,
              timezone,
              currency,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 31: Configuration Range Validation', () => {
    it('discount percent within 0-100 is accepted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          fc.integer({ min: 0, max: 100 }),
          (name, phone, timezone, currency, discountPercent) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency,
              default_discount_percent: discountPercent,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('discount percent below 0 is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          fc.integer({ min: -100, max: -1 }),
          (name, phone, timezone, currency, negativePercent) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency,
              default_discount_percent: negativePercent,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('discount percent above 100 is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          fc.integer({ min: 101, max: 1000 }),
          (name, phone, timezone, currency, highPercent) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency,
              default_discount_percent: highPercent,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('tax percent within 0-100 is accepted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          fc.constantFrom('America/Lima', 'America/New_York', 'America/Chicago', 'America/Denver'),
          fc.constantFrom('PEN', 'USD', 'EUR'),
          fc.integer({ min: 0, max: 100 }),
          (name, phone, timezone, currency, taxPercent) => {
            const data = {
              business_name: name,
              business_phone: phone,
              timezone,
              currency,
              tax_percent: taxPercent,
            };
            
            const result = configSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
