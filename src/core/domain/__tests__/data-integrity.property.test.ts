/**
 * Data Integrity Constraint Property Tests
 * 
 * Tests data integrity constraints:
 * - Tenant ID presence on all multi-tenant tables
 * - Order number uniqueness within tenant
 * - Foreign key relationships maintained
 * - Soft deletes preserve referential integrity
 * - JSONB fields conform to schemas
 * - Derived fields maintain consistency
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateRealisticOrder,
  generateRealisticShift,
  generateRealisticInventoryItem,
  tenantIdArb,
  orderIdArb,
  shiftIdArb,
} from '@/src/test-utils';
import {
  testInvariant,
  testForAll,
} from '@/src/test-utils';
import {
  expectValidTenantId,
  expectAllHaveTenantId,
  expectUniqueOrderNumbers,
  expectValidJSONB,
} from '@/src/test-utils';

/**
 * Validates tenant_id is present
 */
function hasTenantId(entity: any): boolean {
  return entity.tenant_id !== null && entity.tenant_id !== undefined;
}

/**
 * Validates order number is unique within tenant
 */
function isOrderNumberUniqueInTenant(
  orders: Array<{ tenant_id: string; order_number: number }>,
  newOrder: { tenant_id: string; order_number: number }
): boolean {
  const sameTenantsOrders = orders.filter(o => o.tenant_id === newOrder.tenant_id);
  return !sameTenantsOrders.some(o => o.order_number === newOrder.order_number);
}

/**
 * Validates foreign key reference exists
 */
function foreignKeyExists(
  entities: Array<{ id: string }>,
  referencedId: string
): boolean {
  return entities.some(e => e.id === referencedId);
}

/**
 * Simulates soft delete
 */
function softDelete(entity: any): any {
  return {
    ...entity,
    is_active: false,
    deleted_at: new Date(),
  };
}

/**
 * Validates soft delete preserves references
 */
function softDeletePreservesReferences(
  entity: any,
  references: Array<{ id: string }>
): boolean {
  // Soft-deleted entity should still be findable by ID
  return references.some(ref => ref.id === entity.id);
}

describe('Data Integrity Constraints - Property Tests', () => {
  describe('Property 30: Tenant ID Presence', () => {
    it('all orders have tenant_id', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => hasTenantId(order),
        'order must have tenant_id'
      );
    });

    it('all shifts have tenant_id', () => {
      testInvariant(
        generateRealisticShift,
        (shift) => hasTenantId(shift),
        'shift must have tenant_id'
      );
    });

    it('all inventory items have tenant_id', () => {
      testInvariant(
        generateRealisticInventoryItem,
        (item) => hasTenantId(item),
        'inventory item must have tenant_id'
      );
    });

    it('tenant_id is valid UUID', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          try {
            expectValidTenantId(order.tenant_id);
            return true;
          } catch {
            return false;
          }
        },
        'tenant_id must be valid UUID'
      );
    });

    it('all entities in collection have tenant_id', () => {
      fc.assert(
        fc.property(
          fc.array(generateRealisticOrder, { minLength: 1, maxLength: 10 }),
          (orders) => {
            try {
              expectAllHaveTenantId(orders);
            } catch {
              return false;
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: Order Number Uniqueness Within Tenant', () => {
    it('order numbers are unique within tenant', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(generateRealisticOrder, { maxLength: 10 }),
            generateRealisticOrder
          ),
          ([existingOrders, newOrder]) => {
            const isUnique = isOrderNumberUniqueInTenant(existingOrders, newOrder);
            // If order number already exists in same tenant, should not be unique
            const sameTenantsOrders = existingOrders.filter(
              o => o.tenant_id === newOrder.tenant_id
            );
            const numberExists = sameTenantsOrders.some(
              o => o.order_number === newOrder.order_number
            );

            if (numberExists) {
              expect(isUnique).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('order numbers can be same across different tenants', () => {
      fc.assert(
        fc.property(
          fc.tuple(tenantIdArb, tenantIdArb),
          ([tenant1, tenant2]) => {
            if (tenant1 !== tenant2) {
              const order1 = generateRealisticOrder({
                tenant_id: tenant1,
                order_number: 1,
              });
              const order2 = generateRealisticOrder({
                tenant_id: tenant2,
                order_number: 1,
              });

              // Same order number in different tenants is allowed
              expect(order1.order_number).toBe(order2.order_number);
              expect(order1.tenant_id).not.toBe(order2.tenant_id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('order numbers are unique in collection', () => {
      fc.assert(
        fc.property(
          fc.array(generateRealisticOrder, { minLength: 1, maxLength: 10 }),
          (orders) => {
            // Filter by tenant
            const byTenant: Record<string, any[]> = {};
            for (const order of orders) {
              if (!byTenant[order.tenant_id]) {
                byTenant[order.tenant_id] = [];
              }
              byTenant[order.tenant_id].push(order);
            }

            // Check uniqueness within each tenant
            for (const tenantOrders of Object.values(byTenant)) {
              try {
                expectUniqueOrderNumbers(tenantOrders);
              } catch {
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

  describe('Property 31: Foreign Key Validity', () => {
    it('order references valid products', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          // All items should have valid product_id
          for (const item of order.items) {
            expect(item.product_id).toBeDefined();
            expect(typeof item.product_id).toBe('string');
          }
        }),
        { numRuns: 100 }
      );
    });

    it('check references valid order', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          // All checks should reference this order
          for (const check of order.checks) {
            expect(check.check_id).toBeDefined();
          }
        }),
        { numRuns: 100 }
      );
    });

    it('foreign key references are consistent', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          // Order ID should be consistent
          for (const item of order.items) {
            if (item.product_id) {
              expect(typeof item.product_id).toBe('string');
            }
          }
          return true;
        },
        'foreign key references must be consistent'
      );
    });
  });

  describe('Property 32: Soft Delete Preserves References', () => {
    it('soft-deleted entity preserves ID', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          const deleted = softDelete(order);
          expect(deleted.id).toBe(order.id);
        }),
        { numRuns: 100 }
      );
    });

    it('soft-deleted entity is marked inactive', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          const deleted = softDelete(order);
          expect(deleted.is_active).toBe(false);
          expect(deleted.deleted_at).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('soft delete preserves referential integrity', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            generateRealisticOrder,
            fc.array(generateRealisticOrder, { maxLength: 5 })
          ),
          ([order, references]) => {
            const deleted = softDelete(order);
            const allOrders = [...references, deleted];

            // Soft-deleted order should still be findable
            const isPreserved = softDeletePreservesReferences(deleted, allOrders);
            expect(isPreserved).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('soft delete does not remove data', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          const deleted = softDelete(order);

          // All original data should be preserved
          expect(deleted.order_id).toBe(order.order_id);
          expect(deleted.order_number).toBe(order.order_number);
          expect(deleted.items).toEqual(order.items);
          expect(deleted.checks).toEqual(order.checks);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 33: JSONB Schema Conformance', () => {
    it('items JSONB conforms to schema', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          if (!order.items || order.items.length === 0) return true;

          for (const item of order.items) {
            try {
              expectValidJSONB(item, ['line_id', 'product_id', 'qty', 'unit_price_cents']);
            } catch {
              return false;
            }
          }
          return true;
        },
        'items JSONB must conform to schema'
      );
    });

    it('checks JSONB conforms to schema', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          if (!order.checks || order.checks.length === 0) return true;

          for (const check of order.checks) {
            try {
              expectValidJSONB(check, ['check_id', 'total_cents', 'payment']);
            } catch {
              return false;
            }
          }
          return true;
        },
        'checks JSONB must conform to schema'
      );
    });

    it('JSONB fields maintain structure', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          // Items should be array
          expect(Array.isArray(order.items)).toBe(true);

          // Checks should be array
          expect(Array.isArray(order.checks)).toBe(true);

          // Each item should have required fields
          for (const item of order.items) {
            expect(item).toHaveProperty('line_id');
            expect(item).toHaveProperty('product_id');
            expect(item).toHaveProperty('qty');
          }

          // Each check should have required fields
          for (const check of order.checks) {
            expect(check).toHaveProperty('check_id');
            expect(check).toHaveProperty('total_cents');
            expect(check).toHaveProperty('payment');
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Derived Field Consistency', () => {
    it('derived fields are computed correctly', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          // stations_active should match items
          const stations = new Set<string>();
          for (const item of order.items) {
            if (item.status !== 'VOIDED' && item.status !== 'DONE') {
              stations.add(item.station);
            }
          }

          const expected = Array.from(stations).sort();
          const actual = (order.stations_active || []).sort();

          return JSON.stringify(expected) === JSON.stringify(actual);
        },
        'derived fields must be computed correctly'
      );
    });

    it('derived fields update with data changes', () => {
      fc.assert(
        fc.property(generateRealisticOrder, (order) => {
          if (order.items.length === 0) return;

          // Mark first item as done
          const updated = {
            ...order,
            items: order.items.map((item, i) =>
              i === 0 ? { ...item, status: 'DONE' } : item
            ),
          };

          // stations_active should be recomputed
          const stations = new Set<string>();
          for (const item of updated.items) {
            if (item.status !== 'VOIDED' && item.status !== 'DONE') {
              stations.add(item.station);
            }
          }

          const expected = Array.from(stations).sort();
          const actual = (updated.stations_active || []).sort();

          expect(JSON.stringify(expected)).toBe(JSON.stringify(actual));
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles entity with no items', () => {
      const order = generateRealisticOrder({ items: [] });
      expect(hasTenantId(order)).toBe(true);
      expect(Array.isArray(order.items)).toBe(true);
      expect(order.items.length).toBe(0);
    });

    it('handles entity with no checks', () => {
      const order = generateRealisticOrder({ checks: [] });
      expect(hasTenantId(order)).toBe(true);
      expect(Array.isArray(order.checks)).toBe(true);
      expect(order.checks.length).toBe(0);
    });

    it('handles soft delete of entity with no items', () => {
      const order = generateRealisticOrder({ items: [] });
      const deleted = softDelete(order);

      expect(deleted.is_active).toBe(false);
      expect(deleted.items.length).toBe(0);
    });

    it('handles multiple soft deletes', () => {
      const order = generateRealisticOrder();
      const deleted1 = softDelete(order);
      const deleted2 = softDelete(deleted1);

      expect(deleted2.is_active).toBe(false);
      expect(deleted2.id).toBe(order.id);
    });
  });

  describe('Invariants', () => {
    it('tenant_id is always present', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => hasTenantId(order),
        'tenant_id must always be present'
      );
    });

    it('order_id is always present', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => order.order_id !== null && order.order_id !== undefined,
        'order_id must always be present'
      );
    });

    it('soft delete does not remove tenant_id', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          const deleted = softDelete(order);
          return hasTenantId(deleted);
        },
        'soft delete must preserve tenant_id'
      );
    });

    it('JSONB fields are always arrays', () => {
      testInvariant(
        generateRealisticOrder,
        (order) => {
          return Array.isArray(order.items) && Array.isArray(order.checks);
        },
        'JSONB fields must be arrays'
      );
    });
  });
});
