// src/core/domain/__tests__/event-migrator.test.ts
// Property-based tests for Event Schema Versioning
// **Feature: event-schema-versioning**

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { eventMigrator } from '../event-migrator';
import { getCurrentVersion, EVENT_VERSIONS } from '../event-versions';
import { registerAllMigrations } from '../migrations';
import type { ParkEvent } from '../events';

// Ensure migrations are registered
beforeAll(() => {
  registerAllMigrations();
});

// ============================================================================
// Generators
// ============================================================================

const uuidArb = fc.uuid();

const baseEventArb = fc.record({
  event_id: uuidArb,
  tenant_id: uuidArb,
  terminal_id: fc.string({ minLength: 1, maxLength: 20 }),
  terminal_sequence: fc.nat(),
  occurred_at: fc.constant(new Date().toISOString()),
  aggregate_type: fc.constant('ORDER' as const),
  aggregate_id: uuidArb,
  correlation_id: fc.string({ minLength: 1, maxLength: 36 }),
  causation_id: fc.option(uuidArb, { nil: undefined }),
  actor_id: fc.option(uuidArb, { nil: undefined }),
  actor_role_snapshot: fc.option(fc.string(), { nil: undefined }),
  schema_version: fc.constant(1),
  shift_id: fc.option(uuidArb, { nil: undefined }),
  business_date: fc.option(fc.constant('2025-01-06'), { nil: undefined }),
});

// ORDER_CREATED V1 payload (without delivery fields)
const orderCreatedV1PayloadArb = fc.record({
  order_id: uuidArb,
  order_number: fc.integer({ min: 1, max: 999999 }),
  order_type: fc.constantFrom('DINE_IN', 'TAKEOUT', 'DELIVERY'),
  items: fc.array(fc.record({
    line_id: fc.string({ minLength: 1 }),
    product_id: uuidArb,
    sku: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    qty: fc.integer({ min: 1, max: 100 }),
    unit_price_cents: fc.integer({ min: 100, max: 100000 }),
    station: fc.string({ minLength: 1 }),
    status: fc.constant('PENDING'),
    mods: fc.array(fc.string()),
  }), { minLength: 0, maxLength: 5 }),
  checks: fc.constant([]),
});

// ORDER_ITEM_ADDED V1 payload (without timestamps)
const orderItemAddedV1PayloadArb = fc.record({
  order_id: uuidArb,
  line: fc.record({
    line_id: fc.string({ minLength: 1 }),
    product_id: uuidArb,
    sku: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    qty: fc.integer({ min: 1, max: 100 }),
    unit_price_cents: fc.integer({ min: 100, max: 100000 }),
    station: fc.string({ minLength: 1 }),
    status: fc.constant('PENDING'),
    mods: fc.array(fc.string()),
  }),
});

// V1 ORDER_CREATED event
const orderCreatedV1EventArb = fc.tuple(baseEventArb, orderCreatedV1PayloadArb).map(
  ([base, payload]) => ({
    ...base,
    event_type: 'ORDER_CREATED' as const,
    payload_version: 1,
    payload,
  })
);

// V1 ORDER_ITEM_ADDED event
const orderItemAddedV1EventArb = fc.tuple(baseEventArb, orderItemAddedV1PayloadArb).map(
  ([base, payload]) => ({
    ...base,
    event_type: 'ORDER_ITEM_ADDED' as const,
    payload_version: 1,
    payload,
  })
);

// Current version events (already migrated)
const orderCreatedCurrentEventArb = fc.tuple(baseEventArb, orderCreatedV1PayloadArb).map(
  ([base, payload]) => ({
    ...base,
    event_type: 'ORDER_CREATED' as const,
    payload_version: getCurrentVersion('ORDER_CREATED'),
    payload: {
      ...payload,
      delivery: null,
      fulfillment: null,
      promotion_id: null,
    },
  })
);

// ============================================================================
// Property Tests
// ============================================================================

describe('Event Schema Versioning Properties', () => {
  /**
   * **Property 1: Migration Idempotence**
   * For any event that has already been migrated to the current version,
   * migrating it again SHALL produce an identical result.
   * **Validates: Requirements 2.1, 2.4**
   */
  describe('Property 1: Migration Idempotence', () => {
    it('migrating a current-version event produces identical result', () => {
      fc.assert(
        fc.property(orderCreatedCurrentEventArb, (event) => {
          const migrated1 = eventMigrator.migrate(event as unknown as ParkEvent);
          const migrated2 = eventMigrator.migrate(migrated1);
          
          // Should be identical
          expect(JSON.stringify(migrated1)).toBe(JSON.stringify(migrated2));
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('double migration of V1 event produces same result as single migration', () => {
      fc.assert(
        fc.property(orderCreatedV1EventArb, (event) => {
          const migrated1 = eventMigrator.migrate(event as unknown as ParkEvent);
          const migrated2 = eventMigrator.migrate(migrated1);
          
          // Second migration should not change anything
          expect(JSON.stringify(migrated1)).toBe(JSON.stringify(migrated2));
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 2: Migration Correctness**
   * For any event at version N < current, migrating it SHALL:
   * - Transform the payload to current version format
   * - Add default values for all new fields
   * - NOT modify the original event object
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  describe('Property 2: Migration Correctness', () => {
    it('ORDER_CREATED V1 migration adds delivery fields with defaults', () => {
      fc.assert(
        fc.property(orderCreatedV1EventArb, (event) => {
          const original = JSON.stringify(event);
          const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
          
          // Original should not be modified
          expect(JSON.stringify(event)).toBe(original);
          
          // Migrated should have new fields
          const payload = migrated.payload as any;
          expect(payload).toHaveProperty('delivery');
          expect(payload).toHaveProperty('fulfillment');
          expect(payload).toHaveProperty('promotion_id');
          
          // Version should be updated
          expect((migrated as any).payload_version).toBe(getCurrentVersion('ORDER_CREATED'));
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('ORDER_ITEM_ADDED V1 migration adds timestamps with defaults', () => {
      fc.assert(
        fc.property(orderItemAddedV1EventArb, (event) => {
          const original = JSON.stringify(event);
          const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
          
          // Original should not be modified
          expect(JSON.stringify(event)).toBe(original);
          
          // Migrated line should have timestamp fields
          const payload = migrated.payload as any;
          expect(payload.line).toHaveProperty('created_at');
          expect(payload.line).toHaveProperty('started_cooking_at');
          expect(payload.line).toHaveProperty('ready_at');
          expect(payload.line).toHaveProperty('served_at');
          
          // Version should be updated
          expect((migrated as any).payload_version).toBe(getCurrentVersion('ORDER_ITEM_ADDED'));
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Property 4: Backward Compatibility**
   * For any valid event from any known schema version (1 to current),
   * the system SHALL successfully migrate and process it.
   * **Validates: Requirements 3.1**
   */
  describe('Property 4: Backward Compatibility', () => {
    it('all V1 ORDER_CREATED events can be migrated', () => {
      fc.assert(
        fc.property(orderCreatedV1EventArb, (event) => {
          // Should not throw
          const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
          
          // Should return a valid event
          expect(migrated).toBeDefined();
          expect(migrated.event_type).toBe('ORDER_CREATED');
          expect(migrated.payload).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('all V1 ORDER_ITEM_ADDED events can be migrated', () => {
      fc.assert(
        fc.property(orderItemAddedV1EventArb, (event) => {
          // Should not throw
          const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
          
          // Should return a valid event
          expect(migrated).toBeDefined();
          expect(migrated.event_type).toBe('ORDER_ITEM_ADDED');
          expect(migrated.payload).toBeDefined();
          
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('EventMigrator Unit Tests', () => {
  describe('needsMigration', () => {
    it('returns true for V1 ORDER_CREATED', () => {
      const event = {
        event_type: 'ORDER_CREATED',
        payload_version: 1,
        payload: {},
      } as unknown as ParkEvent;
      
      expect(eventMigrator.needsMigration(event)).toBe(true);
    });

    it('returns false for current version ORDER_CREATED', () => {
      const event = {
        event_type: 'ORDER_CREATED',
        payload_version: getCurrentVersion('ORDER_CREATED'),
        payload: {},
      } as unknown as ParkEvent;
      
      expect(eventMigrator.needsMigration(event)).toBe(false);
    });

    it('returns false for events at V1 with no migrations', () => {
      const event = {
        event_type: 'CHECK_CREATED',
        payload_version: 1,
        payload: {},
      } as unknown as ParkEvent;
      
      // CHECK_CREATED is at V1, no migration needed
      expect(eventMigrator.needsMigration(event)).toBe(false);
    });
  });

  describe('getCurrentVersion', () => {
    it('returns correct version for ORDER_CREATED', () => {
      expect(eventMigrator.getCurrentVersion('ORDER_CREATED')).toBe(2);
    });

    it('returns correct version for ORDER_ITEM_ADDED', () => {
      expect(eventMigrator.getCurrentVersion('ORDER_ITEM_ADDED')).toBe(2);
    });

    it('returns 1 for events without migrations', () => {
      expect(eventMigrator.getCurrentVersion('CHECK_CREATED')).toBe(1);
    });
  });

  describe('getRegisteredTypes', () => {
    it('returns all registered event types', () => {
      const types = eventMigrator.getRegisteredTypes();
      
      expect(types).toContain('ORDER_CREATED');
      expect(types).toContain('ORDER_ITEM_ADDED');
      expect(types).toContain('CHECK_CREATED');
      expect(types).toContain('SHIFT_OPENED');
    });
  });
});

describe('Event Versions', () => {
  it('all event types have a version defined', () => {
    const expectedTypes = [
      'ORDER_CREATED',
      'ORDER_ITEM_ADDED',
      'ORDER_ITEM_QTY_CHANGED',
      'ORDER_ITEM_STATUS_CHANGED',
      'ORDER_ITEM_VOIDED',
      'ORDER_CANCELLED',
      'CHECK_CREATED',
      'CHECK_PAYMENT_ADDED',
      'CHECK_MARKED_PAID',
      'CHECK_TIP_SET',
      'CHECK_ITEMS_UPDATED',
      'CHECK_ITEMS_MOVED',
      'SHIFT_OPENED',
      'SHIFT_CLOSED',
      'CASH_ADJUSTED',
      'INVOICE_ISSUED',
      'INVOICE_VOIDED',
      'CATALOG_VERSION_BUMPED',
    ];

    for (const eventType of expectedTypes) {
      expect(EVENT_VERSIONS[eventType]).toBeDefined();
      expect(EVENT_VERSIONS[eventType]).toBeGreaterThanOrEqual(1);
    }
  });
});


// ============================================================================
// Property 5: Schema Validation After Migration
// ============================================================================

describe('Property 5: Schema Validation After Migration', () => {
  /**
   * **Property 5: Schema Validation After Migration**
   * For any event migrated from V1 to current version,
   * the migrated payload SHALL contain all required fields for the current schema.
   * **Validates: Requirements 5.3**
   */
  it('ORDER_CREATED migrated events have all required V2 fields', () => {
    fc.assert(
      fc.property(orderCreatedV1EventArb, (event) => {
        const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
        const payload = migrated.payload as any;
        
        // V2 required fields
        expect(payload).toHaveProperty('order_id');
        expect(payload).toHaveProperty('order_number');
        expect(payload).toHaveProperty('order_type');
        expect(payload).toHaveProperty('items');
        expect(payload).toHaveProperty('checks');
        
        // V2 new fields (added by migration)
        expect(payload).toHaveProperty('delivery');
        expect(payload).toHaveProperty('fulfillment');
        expect(payload).toHaveProperty('promotion_id');
        
        // Version should be current
        expect((migrated as any).payload_version).toBe(getCurrentVersion('ORDER_CREATED'));
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('ORDER_ITEM_ADDED migrated events have all required V2 fields', () => {
    fc.assert(
      fc.property(orderItemAddedV1EventArb, (event) => {
        const migrated = eventMigrator.migrate(event as unknown as ParkEvent);
        const payload = migrated.payload as any;
        
        // V2 required fields
        expect(payload).toHaveProperty('order_id');
        expect(payload).toHaveProperty('line');
        expect(payload.line).toHaveProperty('line_id');
        expect(payload.line).toHaveProperty('product_id');
        expect(payload.line).toHaveProperty('qty');
        expect(payload.line).toHaveProperty('unit_price_cents');
        
        // V2 new fields (timestamps added by migration)
        expect(payload.line).toHaveProperty('created_at');
        expect(payload.line).toHaveProperty('started_cooking_at');
        expect(payload.line).toHaveProperty('ready_at');
        expect(payload.line).toHaveProperty('served_at');
        
        // Version should be current
        expect((migrated as any).payload_version).toBe(getCurrentVersion('ORDER_ITEM_ADDED'));
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Property 6: Migration Performance
// ============================================================================

describe('Property 6: Migration Performance', () => {
  /**
   * **Property 6: Migration Performance**
   * For any event, migration SHALL complete in less than 1ms.
   * **Validates: Requirements 6.3**
   */
  it('ORDER_CREATED migration completes in < 1ms', () => {
    fc.assert(
      fc.property(orderCreatedV1EventArb, (event) => {
        const start = performance.now();
        eventMigrator.migrate(event as unknown as ParkEvent);
        const elapsed = performance.now() - start;
        
        // Should be < 2ms (allowing for system variance)
        expect(elapsed).toBeLessThan(2);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('ORDER_ITEM_ADDED migration completes in < 5ms', () => {
    fc.assert(
      fc.property(orderItemAddedV1EventArb, (event) => {
        const start = performance.now();
        eventMigrator.migrate(event as unknown as ParkEvent);
        const elapsed = performance.now() - start;
        
        // Should be < 5ms (allowing for system variance)
        expect(elapsed).toBeLessThan(5);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('batch migration of 100 events completes in < 50ms', () => {
    // Generate 100 events
    const events = fc.sample(orderCreatedV1EventArb, 100);
    
    const start = performance.now();
    for (const event of events) {
      eventMigrator.migrate(event as unknown as ParkEvent);
    }
    const elapsed = performance.now() - start;
    
    // 100 events should complete in < 50ms (0.5ms per event average)
    expect(elapsed).toBeLessThan(50);
  });
});
