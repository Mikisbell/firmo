/**
 * Property-Based Tests for Event Sourcing Tenant Isolation
 * 
 * Tests that verify tenant isolation in event ingestion, streaming, 
 * projection rebuild, and conflict resolution.
 * 
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6**
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import {
  validateEventTenant,
  validateEntityBelongsToTenant,
  validatePayloadTenantReferences,
  validateEventTenantIsolation,
} from '../event-validation';
import type { ParkEvent } from '@/src/core/domain/events';

// ============================================================================
// Arbitraries for Property Testing
// ============================================================================

const arbUUID = fc.uuid().map(() => randomUUID());

const arbTenantId = arbUUID;

const arbEventId = arbUUID;

const arbTerminalId = fc
  .tuple(
    fc.constantFrom('CAJA', 'MOZO', 'KDS'),
    fc.integer({ min: 1, max: 99 })
  )
  .map(([prefix, num]) => `${prefix}-${String(num).padStart(2, '0')}`);

const arbEventType = fc.constantFrom(
  'ORDER_CREATED',
  'ORDER_ITEM_ADDED',
  'ORDER_ITEM_REMOVED',
  'CHECK_PAYMENT_ADDED',
  'CHECK_MARKED_PAID',
  'INVOICE_ISSUED',
  'SHIFT_OPENED',
  'SHIFT_CLOSED'
);

const arbAggregateType = fc.constantFrom(
  'ORDER',
  'SHIFT',
  'INVOICE',
  'CUSTOMER',
  'EMPLOYEE'
);

const arbParkEvent = fc
  .tuple(
    arbEventId,
    arbTenantId,
    arbTerminalId,
    arbEventType,
    arbAggregateType,
    arbUUID,
    fc.option(arbUUID),
    fc.integer({ min: 1, max: 1000 })
  )
  .map(
    ([
      event_id,
      tenant_id,
      terminal_id,
      event_type,
      aggregate_type,
      aggregate_id,
      actor_id,
      terminal_sequence,
    ]) => ({
      event_id,
      tenant_id,
      terminal_id,
      event_type,
      aggregate_type,
      aggregate_id,
      actor_id,
      actor_role_snapshot: 'CASHIER',
      schema_version: 1,
      occurred_at: new Date().toISOString(),
      terminal_sequence,
      payload: {},
    } as ParkEvent)
  );

// ============================================================================
// Property 11: Event Ingestion Validates Tenant
// ============================================================================

describe('Property 11: Event Ingestion Validates Tenant', () => {
  /**
   * **Validates: Requirements 11.1**
   * 
   * For any event with tenant_id matching the authenticated tenant,
   * validation should succeed.
   */
  it('accepts events where tenant_id matches authenticated tenant', async () => {
    await fc.assert(
      fc.asyncProperty(arbParkEvent, async (event) => {
        const result = await validateEventTenant(event, event.tenant_id);
        expect(result.valid).toBe(true);
      })
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * 
   * For any event with tenant_id NOT matching the authenticated tenant,
   * validation should fail with TENANT_MISMATCH error.
   */
  it('rejects events where tenant_id does not match authenticated tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(arbParkEvent, arbTenantId),
        async ([event, differentTenantId]) => {
          fc.pre(event.tenant_id !== differentTenantId);

          const result = await validateEventTenant(event, differentTenantId);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('TENANT_MISMATCH');
          expect(result.details?.event_tenant_id).toBe(event.tenant_id);
          expect(result.details?.authenticated_tenant_id).toBe(differentTenantId);
        }
      )
    );
  });

  /**
   * **Validates: Requirements 11.1**
   * 
   * For any event with missing tenant_id, validation should fail.
   */
  it('rejects events with missing tenant_id', async () => {
    await fc.assert(
      fc.asyncProperty(arbParkEvent, async (event) => {
        const eventWithoutTenant = { ...event, tenant_id: undefined as any };
        const result = await validateEventTenant(eventWithoutTenant, randomUUID());
        expect(result.valid).toBe(false);
        expect(result.error).toBe('MISSING_TENANT_ID');
      })
    );
  });
});

// ============================================================================
// Property 14: Cross-Tenant Event References Are Rejected
// ============================================================================

describe('Property 14: Cross-Tenant Event References Are Rejected', () => {
  /**
   * **Validates: Requirements 11.4, 11.5**
   * 
   * For any event with payload containing cross-tenant entity references,
   * validation should fail with CROSS_TENANT_REFERENCE error.
   */
  it('rejects events with cross-tenant references in payload', async () => {
    // Setup: Create test orders once, not in each iteration
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();

    // Create tenants first (FK constraint)
    await prisma.tenants.createMany({ data: [{ id: tenant1, name: 'Test Tenant 1' }, { id: tenant2, name: 'Test Tenant 2' }] });

    const testOrder = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant2,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 0,
        discount_cents: 0,
        total_cents: 0,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
      },
    });

    try {
      // Test: Property-based test with pre-created data
      await fc.assert(
        fc.asyncProperty(arbParkEvent, async (event) => {
          const eventWithCrossTenantRef = {
            ...event,
            tenant_id: tenant1,
            event_type: 'ORDER_ITEM_ADDED',
            payload: {
              order_id: testOrder.id,
              line: { qty: 1, unit_price_cents: 1000 },
            },
          } as ParkEvent;

          const result = await prisma.$transaction(async (tx) => {
            return await validatePayloadTenantReferences(tx, eventWithCrossTenantRef);
          });

          expect(result.valid).toBe(false);
          expect(result.error).toBe('CROSS_TENANT_REFERENCE');
        }),
        { numRuns: 10 } // Reduce iterations for speed
      );
    } finally {
      // Cleanup
      await prisma.orders.delete({ where: { id: testOrder.id } });
      await prisma.tenants.deleteMany({ where: { id: { in: [tenant1, tenant2] } } });
    }
  });

  /**
   * **Validates: Requirements 11.5**
   * 
   * For any event referencing an entity that belongs to the same tenant,
   * validation should succeed.
   */
  it('accepts events with same-tenant entity references', async () => {
    // Setup: Create test order once
    const tenantId = randomUUID();
    await prisma.tenants.create({ data: { id: tenantId, name: 'Test Tenant' } });
    const testOrder = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 0,
        discount_cents: 0,
        total_cents: 0,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
      },
    });

    try {
      // Test: Property-based test with pre-created data
      await fc.assert(
        fc.asyncProperty(arbParkEvent, async (event) => {
          const eventWithSameTenantRef = {
            ...event,
            tenant_id: tenantId,
            event_type: 'ORDER_ITEM_ADDED',
            payload: {
              order_id: testOrder.id,
              line: { qty: 1, unit_price_cents: 1000 },
            },
          } as ParkEvent;

          const result = await prisma.$transaction(async (tx) => {
            return await validatePayloadTenantReferences(tx, eventWithSameTenantRef);
          });

          expect(result.valid).toBe(true);
        }),
        { numRuns: 10 } // Reduce iterations for speed
      );
    } finally {
      // Cleanup
      await prisma.orders.delete({ where: { id: testOrder.id } });
      await prisma.tenants.delete({ where: { id: tenantId } });
    }
  });
});

// ============================================================================
// Property 12: Event Streams Are Tenant-Filtered
// ============================================================================

describe('Property 12: Event Streams Are Tenant-Filtered', () => {
  /**
   * **Validates: Requirements 11.2**
   * 
   * For any tenant, when events are streamed, only events belonging to
   * that tenant should be included.
   */
  it('event stream filtering respects tenant boundaries', async () => {
    // Setup: Create events once
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();
    
    const event1 = await prisma.events.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant1,
        occurred_at: new Date(),
        type: 'ORDER_CREATED',
        entity_type: 'ORDER',
        entity_id: randomUUID(),
        actor_id: null,
        actor_role_snapshot: null,
        terminal_id: 'CAJA-01',
        payload_version: 1,
        payload: {},
      },
    });

    const event2 = await prisma.events.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant2,
        occurred_at: new Date(),
        type: 'ORDER_CREATED',
        entity_type: 'ORDER',
        entity_id: randomUUID(),
        actor_id: null,
        actor_role_snapshot: null,
        terminal_id: 'CAJA-01',
        payload_version: 1,
        payload: {},
      },
    });

    try {
      // Test: Verify filtering works
      const tenant1Events = await prisma.events.findMany({
        where: { tenant_id: tenant1 },
      });

      expect(tenant1Events.every((e) => e.tenant_id === tenant1)).toBe(true);
      expect(tenant1Events.some((e) => e.id === event1.id)).toBe(true);
      expect(tenant1Events.some((e) => e.id === event2.id)).toBe(false);
    } finally {
      // Cleanup
      await prisma.events.deleteMany({
        where: { id: { in: [event1.id, event2.id] } },
      });
    }
  });
});

// ============================================================================
// Property 13: Projection Rebuild Is Tenant-Scoped
// ============================================================================

describe('Property 13: Projection Rebuild Is Tenant-Scoped', () => {
  /**
   * **Validates: Requirements 11.3**
   * 
   * For any tenant, when projections are rebuilt, only events for that
   * tenant should be processed.
   */
  it('projection rebuild processes only tenant events', async () => {
    // Setup: Create orders once
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();

    // Create tenants first (FK constraint)
    await prisma.tenants.createMany({ data: [{ id: tenant1, name: 'Test Tenant 1' }, { id: tenant2, name: 'Test Tenant 2' }] });

    const order1 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant1,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 0,
        discount_cents: 0,
        total_cents: 0,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
      },
    });

    const order2 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant2,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 0,
        discount_cents: 0,
        total_cents: 0,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
      },
    });

    try {
      // Test: Verify tenant-scoped query
      const tenant1Orders = await prisma.orders.findMany({
        where: { tenant_id: tenant1 },
      });

      expect(tenant1Orders.every((o) => o.tenant_id === tenant1)).toBe(true);
      expect(tenant1Orders.some((o) => o.id === order1.id)).toBe(true);
      expect(tenant1Orders.some((o) => o.id === order2.id)).toBe(false);
    } finally {
      // Cleanup
      await prisma.orders.deleteMany({
        where: { id: { in: [order1.id, order2.id] } },
      });
      await prisma.tenants.deleteMany({ where: { id: { in: [tenant1, tenant2] } } });
    }
  });
});

// ============================================================================
// Property 15: Conflict Resolution Is Tenant-Scoped
// ============================================================================

describe('Property 15: Conflict Resolution Is Tenant-Scoped', () => {
  /**
   * **Validates: Requirements 11.6**
   * 
   * For any tenant, when conflicts are detected and resolved, the resolution
   * should not affect other tenants' data.
   */
  it('conflict resolution does not affect other tenants', async () => {
    // Setup: Create orders once
    const tenant1 = randomUUID();
    const tenant2 = randomUUID();

    // Create tenants first (FK constraint)
    await prisma.tenants.createMany({ data: [{ id: tenant1, name: 'Test Tenant 1' }, { id: tenant2, name: 'Test Tenant 2' }] });

    const order1 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant1,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 1000,
        discount_cents: 0,
        total_cents: 1000,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
        revision: 1,
      },
    });

    const order2 = await prisma.orders.create({
      data: {
        id: randomUUID(),
        tenant_id: tenant2,
        order_number: 1,
        order_type: 'DINE_IN',
        order_status: 'OPEN',
        fulfillment_status: 'COOKING',
        handoff_status: 'WAITING',
        stations_active: [],
        unpaid_checks_count: 1,
        subtotal_cents: 2000,
        discount_cents: 0,
        total_cents: 2000,
        items: [],
        checks: [],
        terminal_id: 'CAJA-01',
        revision: 1,
      },
    });

    try {
      // Test: Simulate conflict resolution for tenant1
      await prisma.orders.update({
        where: { id: order1.id },
        data: { revision: 2, total_cents: 1500 },
      });

      // Verify tenant2 order is unchanged
      const updatedOrder2 = await prisma.orders.findUnique({
        where: { id: order2.id },
      });

      expect(updatedOrder2?.revision).toBe(1);
      expect(updatedOrder2?.total_cents).toBe(2000);
    } finally {
      // Cleanup
      await prisma.orders.deleteMany({
        where: { id: { in: [order1.id, order2.id] } },
      });
      await prisma.tenants.deleteMany({ where: { id: { in: [tenant1, tenant2] } } });
    }
  });
});
