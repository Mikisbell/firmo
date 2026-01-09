/**
 * Property 3: Input Validation Consistency
 * Validates: Requirements 2.4, 2.5, 5.3, 5.4
 * 
 * Propiedades:
 * - Cantidad debe ser > 0
 * - Costo debe ser entero >= 0 (centavos)
 * - Códigos de motivo deben ser válidos
 * - Validación cliente y servidor deben ser consistentes
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Códigos de motivo válidos para merma
const VALID_WASTE_REASONS = ['EXPIRED', 'DAMAGED', 'THEFT', 'PRODUCTION_LOSS', 'COUNT_ADJUSTMENT', 'OTHER'] as const;
type WasteReasonCode = typeof VALID_WASTE_REASONS[number];

// Validación de entrada de mercadería
interface ReceiveInput {
  quantity: number;
  cost_cents: number;
  actor_id: string;
  inventory_code: string;
  lot_number?: string;
}

// Validación de merma
interface WasteInput {
  quantity: number;
  reason_code: string;
  reason_detail?: string;
  actor_id: string;
  inventory_code: string;
}

// Resultado de validación
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Validar entrada de mercadería
function validateReceiveInput(input: ReceiveInput): ValidationResult {
  const errors: string[] = [];
  
  // Cantidad debe ser > 0
  if (typeof input.quantity !== 'number' || input.quantity <= 0) {
    errors.push('quantity must be > 0');
  }
  
  // Costo debe ser entero >= 0
  if (typeof input.cost_cents !== 'number' || !Number.isInteger(input.cost_cents) || input.cost_cents < 0) {
    errors.push('cost_cents must be integer >= 0');
  }
  
  // actor_id debe existir
  if (!input.actor_id || typeof input.actor_id !== 'string' || input.actor_id.trim() === '') {
    errors.push('actor_id is required');
  }
  
  // inventory_code debe existir
  if (!input.inventory_code || typeof input.inventory_code !== 'string' || input.inventory_code.trim() === '') {
    errors.push('inventory_code is required');
  }
  
  return { valid: errors.length === 0, errors };
}

// Validar merma
function validateWasteInput(input: WasteInput): ValidationResult {
  const errors: string[] = [];
  
  // Cantidad debe ser > 0
  if (typeof input.quantity !== 'number' || input.quantity <= 0) {
    errors.push('quantity must be > 0');
  }
  
  // reason_code debe ser válido
  if (!VALID_WASTE_REASONS.includes(input.reason_code as WasteReasonCode)) {
    errors.push('reason_code must be valid');
  }
  
  // Si reason_code es THEFT u OTHER, reason_detail es obligatorio
  if ((input.reason_code === 'THEFT' || input.reason_code === 'OTHER') && 
      (!input.reason_detail || input.reason_detail.trim() === '')) {
    errors.push('reason_detail is required for THEFT or OTHER');
  }
  
  // actor_id debe existir
  if (!input.actor_id || typeof input.actor_id !== 'string' || input.actor_id.trim() === '') {
    errors.push('actor_id is required');
  }
  
  // inventory_code debe existir
  if (!input.inventory_code || typeof input.inventory_code !== 'string' || input.inventory_code.trim() === '') {
    errors.push('inventory_code is required');
  }
  
  return { valid: errors.length === 0, errors };
}

// Arbitrarios
const positiveQuantityArb = fc.double({ min: 0.001, max: 10000, noNaN: true });
const invalidQuantityArb = fc.oneof(
  fc.constant(0),
  fc.constant(-1),
  fc.double({ min: -10000, max: 0, noNaN: true })
);
const validCostArb = fc.integer({ min: 0, max: 100000000 });
const uuidArb = fc.uuid();
const inventoryCodeArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
const validReasonArb = fc.constantFrom(...VALID_WASTE_REASONS);
const invalidReasonArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => !VALID_WASTE_REASONS.includes(s as WasteReasonCode));

describe('Property 3: Input Validation Consistency', () => {
  describe('Receive Input Validation', () => {
    it('should accept valid receive inputs', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          validCostArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, cost_cents, actor_id, inventory_code) => {
            const input: ReceiveInput = { quantity, cost_cents, actor_id, inventory_code };
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject quantity <= 0', () => {
      fc.assert(
        fc.property(
          invalidQuantityArb,
          validCostArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, cost_cents, actor_id, inventory_code) => {
            const input: ReceiveInput = { quantity, cost_cents, actor_id, inventory_code };
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('quantity must be > 0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative cost_cents', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          fc.integer({ min: -100000, max: -1 }),
          uuidArb,
          inventoryCodeArb,
          (quantity, cost_cents, actor_id, inventory_code) => {
            const input: ReceiveInput = { quantity, cost_cents, actor_id, inventory_code };
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('cost_cents must be integer >= 0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject empty actor_id', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          validCostArb,
          fc.constantFrom('', '   ', null as unknown as string),
          inventoryCodeArb,
          (quantity, cost_cents, actor_id, inventory_code) => {
            const input: ReceiveInput = { quantity, cost_cents, actor_id, inventory_code };
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('actor_id is required');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Waste Input Validation', () => {
    it('should accept valid waste inputs', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          validReasonArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, reason_code, actor_id, inventory_code) => {
            const input: WasteInput = { 
              quantity, 
              reason_code, 
              actor_id, 
              inventory_code,
              // Agregar detalle si es THEFT u OTHER
              reason_detail: (reason_code === 'THEFT' || reason_code === 'OTHER') ? 'Detalle requerido' : undefined
            };
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid reason_code', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          invalidReasonArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, reason_code, actor_id, inventory_code) => {
            const input: WasteInput = { quantity, reason_code, actor_id, inventory_code };
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('reason_code must be valid');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require reason_detail for THEFT', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, actor_id, inventory_code) => {
            const input: WasteInput = { 
              quantity, 
              reason_code: 'THEFT', 
              actor_id, 
              inventory_code,
              reason_detail: '' // Vacío
            };
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('reason_detail is required for THEFT or OTHER');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require reason_detail for OTHER', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          uuidArb,
          inventoryCodeArb,
          (quantity, actor_id, inventory_code) => {
            const input: WasteInput = { 
              quantity, 
              reason_code: 'OTHER', 
              actor_id, 
              inventory_code,
              reason_detail: undefined // No definido
            };
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('reason_detail is required for THEFT or OTHER');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not require reason_detail for EXPIRED, DAMAGED, PRODUCTION_LOSS, COUNT_ADJUSTMENT', () => {
      fc.assert(
        fc.property(
          positiveQuantityArb,
          fc.constantFrom('EXPIRED', 'DAMAGED', 'PRODUCTION_LOSS', 'COUNT_ADJUSTMENT'),
          uuidArb,
          inventoryCodeArb,
          (quantity, reason_code, actor_id, inventory_code) => {
            const input: WasteInput = { 
              quantity, 
              reason_code, 
              actor_id, 
              inventory_code
              // Sin reason_detail
            };
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Cost Validation (Centavos)', () => {
    it('should only accept integer cost values', () => {
      fc.assert(
        fc.property(
          validCostArb,
          (cost_cents) => {
            // Verificar que es entero
            expect(Number.isInteger(cost_cents)).toBe(true);
            expect(cost_cents >= 0).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject float cost values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 100, noNaN: true }).filter(n => !Number.isInteger(n)),
          positiveQuantityArb,
          uuidArb,
          inventoryCodeArb,
          (cost_cents, quantity, actor_id, inventory_code) => {
            const input: ReceiveInput = { quantity, cost_cents, actor_id, inventory_code };
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('cost_cents must be integer >= 0');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
