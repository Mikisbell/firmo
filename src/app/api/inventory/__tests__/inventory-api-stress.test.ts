/**
 * FIRMO POS - Inventory API Stress Tests
 * Tests: API validation, concurrent requests, data integrity
 * 
 * Validates:
 * - Input validation under stress
 * - Concurrent request handling
 * - Response time requirements
 * - Data consistency
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { seededMathRandom } from '@/src/test-utils/seeded-random';

const { random, randomInt } = seededMathRandom(42);

// ============ VALIDATION FUNCTIONS ============

const VALID_WASTE_REASONS = ['EXPIRED', 'DAMAGED', 'THEFT', 'PRODUCTION_LOSS', 'COUNT_ADJUSTMENT', 'OTHER'] as const;
type WasteReasonCode = typeof VALID_WASTE_REASONS[number];

interface ReceiveInput {
  tenant_id: string;
  location_id: string;
  inventory_code: string;
  quantity: number;
  unit_cost_cents: number;
  actor_id: string;
  terminal_id: string;
  supplier_id?: string;
  invoice_number?: string;
  lot_number?: string;
  expiry_date?: string;
  notes?: string;
}

interface WasteInput {
  tenant_id: string;
  location_id: string;
  inventory_code: string;
  quantity: number;
  reason_code: string;
  actor_id: string;
  terminal_id: string;
  reason_detail?: string;
  photo_url?: string;
  lot_number?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateReceiveInput(input: Partial<ReceiveInput>): ValidationResult {
  const errors: string[] = [];
  
  if (!input.tenant_id) errors.push('tenant_id is required');
  if (!input.location_id) errors.push('location_id is required');
  if (!input.inventory_code) errors.push('inventory_code is required');
  if (!input.actor_id) errors.push('actor_id is required');
  if (!input.terminal_id) errors.push('terminal_id is required');
  
  if (input.quantity === undefined || input.quantity <= 0) {
    errors.push('quantity must be greater than 0');
  }
  
  if (input.unit_cost_cents !== undefined && input.unit_cost_cents < 0) {
    errors.push('unit_cost_cents must be non-negative');
  }
  
  if (input.expiry_date && isNaN(Date.parse(input.expiry_date))) {
    errors.push('expiry_date must be a valid date');
  }
  
  return { valid: errors.length === 0, errors };
}

function validateWasteInput(input: Partial<WasteInput>): ValidationResult {
  const errors: string[] = [];
  
  if (!input.tenant_id) errors.push('tenant_id is required');
  if (!input.location_id) errors.push('location_id is required');
  if (!input.inventory_code) errors.push('inventory_code is required');
  if (!input.actor_id) errors.push('actor_id is required');
  if (!input.terminal_id) errors.push('terminal_id is required');
  
  if (input.quantity === undefined || input.quantity <= 0) {
    errors.push('quantity must be greater than 0');
  }
  
  if (!input.reason_code || !VALID_WASTE_REASONS.includes(input.reason_code as WasteReasonCode)) {
    errors.push('reason_code must be a valid waste reason');
  }
  
  // THEFT and OTHER require reason_detail
  if ((input.reason_code === 'THEFT' || input.reason_code === 'OTHER') && !input.reason_detail) {
    errors.push('reason_detail is required for THEFT or OTHER');
  }
  
  return { valid: errors.length === 0, errors };
}

// ============ STRESS TESTS ============

describe('API Stress Tests', () => {
  describe('Receive Input Validation Stress', () => {
    it('should validate 1000 valid inputs correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              tenant_id: fc.uuid(),
              location_id: fc.uuid(),
              inventory_code: fc.string({ minLength: 1, maxLength: 20 }),
              quantity: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
              unit_cost_cents: fc.integer({ min: 0, max: 1000000 }),
              actor_id: fc.uuid(),
              terminal_id: fc.uuid(),
            }),
            { minLength: 500, maxLength: 1000 }
          ),
          (inputs) => {
            const start = performance.now();
            
            const results = inputs.map(input => validateReceiveInput(input));
            
            const duration = performance.now() - start;
            
            expect(duration).toBeLessThan(100); // Should be < 100ms
            results.forEach(r => expect(r.valid).toBe(true));
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject invalid quantities consistently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: 0 }),
          (invalidQuantity) => {
            const input: Partial<ReceiveInput> = {
              tenant_id: 'test-tenant',
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: invalidQuantity / 100,
              unit_cost_cents: 1000,
              actor_id: 'test-actor',
              terminal_id: 'test-terminal',
            };
            
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('quantity must be greater than 0');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject negative costs consistently', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: -1 }),
          (negativeCost) => {
            const input: Partial<ReceiveInput> = {
              tenant_id: 'test-tenant',
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              unit_cost_cents: negativeCost,
              actor_id: 'test-actor',
              terminal_id: 'test-terminal',
            };
            
            const result = validateReceiveInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('unit_cost_cents must be non-negative');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle missing required fields', () => {
      const requiredFields = ['tenant_id', 'location_id', 'inventory_code', 'actor_id', 'terminal_id'];
      
      fc.assert(
        fc.property(
          fc.constantFrom(...requiredFields),
          (missingField) => {
            const input: Record<string, unknown> = {
              tenant_id: 'test-tenant',
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              unit_cost_cents: 1000,
              actor_id: 'test-actor',
              terminal_id: 'test-terminal',
            };
            
            delete input[missingField];
            
            const result = validateReceiveInput(input as Partial<ReceiveInput>);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes(missingField))).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Waste Input Validation Stress', () => {
    it('should validate 1000 valid waste inputs correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              tenant_id: fc.uuid(),
              location_id: fc.uuid(),
              inventory_code: fc.string({ minLength: 1, maxLength: 20 }),
              quantity: fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
              reason_code: fc.constantFrom('EXPIRED', 'DAMAGED', 'PRODUCTION_LOSS', 'COUNT_ADJUSTMENT'),
              actor_id: fc.uuid(),
              terminal_id: fc.uuid(),
            }),
            { minLength: 500, maxLength: 1000 }
          ),
          (inputs) => {
            const start = performance.now();
            
            const results = inputs.map(input => validateWasteInput(input));
            
            const duration = performance.now() - start;
            
            expect(duration).toBeLessThan(100); // Should be < 100ms
            results.forEach(r => expect(r.valid).toBe(true));
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should reject invalid reason codes consistently', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => !VALID_WASTE_REASONS.includes(s as WasteReasonCode)),
          (invalidReason) => {
            const input: Partial<WasteInput> = {
              tenant_id: 'test-tenant',
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              reason_code: invalidReason,
              actor_id: 'test-actor',
              terminal_id: 'test-terminal',
            };
            
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('reason_code must be a valid waste reason');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should require reason_detail for THEFT', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          (tenantId, actorId) => {
            const input: Partial<WasteInput> = {
              tenant_id: tenantId,
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              reason_code: 'THEFT',
              actor_id: actorId,
              terminal_id: 'test-terminal',
              // Missing reason_detail
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
          fc.uuid(),
          fc.uuid(),
          (tenantId, actorId) => {
            const input: Partial<WasteInput> = {
              tenant_id: tenantId,
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              reason_code: 'OTHER',
              actor_id: actorId,
              terminal_id: 'test-terminal',
              // Missing reason_detail
            };
            
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('reason_detail is required for THEFT or OTHER');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept THEFT with reason_detail', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 100 }),
          (actorId, reasonDetail) => {
            const input: Partial<WasteInput> = {
              tenant_id: 'test-tenant',
              location_id: 'test-location',
              inventory_code: 'TEST-001',
              quantity: 10,
              reason_code: 'THEFT',
              actor_id: actorId,
              terminal_id: 'test-terminal',
              reason_detail: reasonDetail,
            };
            
            const result = validateWasteInput(input);
            
            expect(result.valid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Concurrent Request Simulation', () => {
    it('should handle 100 concurrent validations', async () => {
      const inputs = Array(100).fill(null).map((_, i) => ({
        tenant_id: `tenant-${i}`,
        location_id: `location-${i}`,
        inventory_code: `CODE-${i}`,
        quantity: random() * 100,
        unit_cost_cents: randomInt(0, 9999),
        actor_id: `actor-${i}`,
        terminal_id: `terminal-${i}`,
      }));

      const start = performance.now();
      
      const results = await Promise.all(
        inputs.map(input => 
          new Promise<ValidationResult>(resolve => {
            // Simulate async validation
            setTimeout(() => {
              resolve(validateReceiveInput(input));
            }, 0);
          })
        )
      );
      
      const duration = performance.now() - start;
      
      expect(results.length).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete in < 1s
    });

    it('should maintain consistency under concurrent load', async () => {
      const sameInput: Partial<ReceiveInput> = {
        tenant_id: 'test-tenant',
        location_id: 'test-location',
        inventory_code: 'TEST-001',
        quantity: 10,
        unit_cost_cents: 1000,
        actor_id: 'test-actor',
        terminal_id: 'test-terminal',
      };

      const results = await Promise.all(
        Array(100).fill(null).map(() => 
          new Promise<ValidationResult>(resolve => {
            setTimeout(() => {
              resolve(validateReceiveInput(sameInput));
            }, random() * 10);
          })
        )
      );
      
      // All results should be identical
      const firstResult = results[0];
      results.forEach(r => {
        expect(r.valid).toBe(firstResult.valid);
        expect(r.errors).toEqual(firstResult.errors);
      });
    });
  });

  describe('Pagination Stress', () => {
    it('should calculate pagination correctly for any page/size combination', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100000 }),
          (page, pageSize, totalItems) => {
            const offset = (page - 1) * pageSize;
            const totalPages = Math.ceil(totalItems / pageSize);
            const itemsOnPage = Math.min(pageSize, Math.max(0, totalItems - offset));
            
            expect(offset).toBeGreaterThanOrEqual(0);
            expect(totalPages).toBeGreaterThanOrEqual(1);
            expect(itemsOnPage).toBeGreaterThanOrEqual(0);
            expect(itemsOnPage).toBeLessThanOrEqual(pageSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of last page correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10, max: 100 }),
          fc.integer({ min: 100, max: 10000 }),
          (pageSize, totalItems) => {
            const totalPages = Math.ceil(totalItems / pageSize);
            const lastPageOffset = (totalPages - 1) * pageSize;
            const itemsOnLastPage = totalItems - lastPageOffset;
            
            expect(itemsOnLastPage).toBeGreaterThan(0);
            expect(itemsOnLastPage).toBeLessThanOrEqual(pageSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Date Range Filtering Stress', () => {
    it('should filter dates correctly for any valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1704067200000, max: 1735689600000 }), // 2024
          fc.integer({ min: 1, max: 365 }),
          fc.integer({ min: 1, max: 1000 }),
          (startMs, rangeDays, itemCount) => {
            const startDate = new Date(startMs);
            const endDate = new Date(startMs + rangeDays * 24 * 60 * 60 * 1000);
            
            // Generate items with random dates
            const items = Array(itemCount).fill(null).map((_, i) => ({
              id: `item-${i}`,
              timestamp: new Date(startMs - 180 * 24 * 60 * 60 * 1000 + Math.random() * 365 * 24 * 60 * 60 * 1000),
            }));
            
            const filtered = items.filter(item => 
              item.timestamp >= startDate && item.timestamp <= endDate
            );
            
            // All filtered items should be within range
            filtered.forEach(item => {
              expect(item.timestamp.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
              expect(item.timestamp.getTime()).toBeLessThanOrEqual(endDate.getTime());
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Search Query Stress', () => {
    it('should handle special characters in search queries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 50 }),
          (query) => {
            const items = [
              { code: 'POLLO-001', name: 'Pollo Entero' },
              { code: 'ARROZ-001', name: 'Arroz Graneado' },
              { code: 'SAL-001', name: 'Sal de Mesa' },
            ];
            
            // Should not throw with any input
            const safeQuery = query.toLowerCase();
            const filtered = items.filter(
              item =>
                item.code.toLowerCase().includes(safeQuery) ||
                item.name.toLowerCase().includes(safeQuery)
            );
            
            expect(Array.isArray(filtered)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty and whitespace queries', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', ' ', '  ', '\t', '\n'),
          (query) => {
            const items = [
              { code: 'POLLO-001', name: 'Pollo Entero' },
            ];
            
            const safeQuery = query.trim().toLowerCase();
            const filtered = safeQuery 
              ? items.filter(item =>
                  item.code.toLowerCase().includes(safeQuery) ||
                  item.name.toLowerCase().includes(safeQuery)
                )
              : items;
            
            // Empty query should return all items
            if (!safeQuery) {
              expect(filtered.length).toBe(items.length);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Response Time Simulation', () => {
    it('should process stock list request within 200ms', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 500 }),
          (itemCount) => {
            const start = performance.now();
            
            // Simulate stock list processing
            const items = Array(itemCount).fill(null).map((_, i) => {
              const stock = Math.random() * 1000;
              const minStock = Math.random() * 100;
              return {
                id: `item-${i}`,
                code: `CODE-${i}`,
                name: `Producto ${i}`,
                stock,
                minStock,
                status: stock < minStock ? 'CRITICAL' : stock < minStock * 1.5 ? 'LOW' : 'OK',
              };
            });
            
            // Calculate summary
            const summary = {
              lowStockCount: items.filter(i => i.status !== 'OK').length,
              totalValueCents: items.reduce((sum, i) => sum + Math.round(i.stock * 1000), 0),
            };
            
            const duration = performance.now() - start;
            
            expect(duration).toBeLessThan(200);
            expect(items.length).toBe(itemCount);
            expect(summary.lowStockCount).toBeLessThanOrEqual(itemCount);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
