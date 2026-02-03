/**
 * Property-Based Tests for Drivers Management
 * 
 * Property 24: Driver Required Field Validation
 * 
 * Validates: Requirements 4.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { z } from 'zod';

// Validation schema
const driverSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres').optional(),
});

describe('Drivers - Property Tests', () => {
  describe('Property 24: Driver Required Field Validation', () => {
    it('name is required and cannot be empty', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (name) => {
            const data = { name };
            const result = driverSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('phone is optional', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.option(fc.string({ minLength: 9, maxLength: 20 }), { freq: 2 }),
          (name, phone) => {
            const data = phone ? { name, phone } : { name };
            const result = driverSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('empty name is rejected', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 9, maxLength: 20 }), { freq: 2 }),
          (phone) => {
            const data = phone ? { name: '', phone } : { name: '' };
            const result = driverSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('phone with less than 9 characters is rejected', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 8 }),
          (name, shortPhone) => {
            const data = { name, phone: shortPhone };
            const result = driverSchema.safeParse(data);
            expect(result.success).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('valid phone with 9+ characters is accepted', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 9, maxLength: 20 }),
          (name, validPhone) => {
            const data = { name, phone: validPhone };
            const result = driverSchema.safeParse(data);
            expect(result.success).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
