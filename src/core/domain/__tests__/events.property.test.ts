/**
 * Event Validation Property Tests
 * 
 * Tests event structure and validation:
 * - All events have required envelope fields
 * - Payload schemas match Zod definitions
 * - Event IDs are unique UUIDs
 * - Timestamps are valid ISO strings
 * 
 * **Validates: Requirements 1.1, 2.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  orderCreatedEventArb,
  shiftOpenedEventArb,
  checkMarkedPaidEventArb,
  eventEnvelopeArb,
} from '@/src/test-utils';
import {
  testInvariant,
  testNoThrow,
} from '@/src/test-utils';
import {
  expectValidEvent,
  expectUUID,
  expectISODate,
  expectBusinessDate,
} from '@/src/test-utils';

describe('Event Validation - Property Tests', () => {
  describe('Event Envelope Structure', () => {
    it('all events have required envelope fields', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          expectValidEvent(envelope);
        }),
        { numRuns: 100 }
      );
    });

    it('event_id is valid UUID', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(envelope.event_id),
        'event_id must be valid UUID'
      );
    });

    it('tenant_id is valid UUID', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(envelope.tenant_id),
        'tenant_id must be valid UUID'
      );
    });

    it('occurred_at is valid ISO date', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => {
          try {
            expectISODate(envelope.occurred_at);
            return true;
          } catch {
            return false;
          }
        },
        'occurred_at must be valid ISO date'
      );
    });

    it('aggregate_type is valid enum value', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => ['ORDER', 'SHIFT', 'INVOICE', 'CATALOG'].includes(envelope.aggregate_type),
        'aggregate_type must be valid enum'
      );
    });

    it('schema_version is positive integer', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => Number.isInteger(envelope.schema_version) && envelope.schema_version > 0,
        'schema_version must be positive integer'
      );
    });

    it('terminal_sequence is non-negative integer', () => {
      testInvariant(
        eventEnvelopeArb,
        (envelope) => Number.isInteger(envelope.terminal_sequence) && envelope.terminal_sequence >= 0,
        'terminal_sequence must be non-negative integer'
      );
    });
  });

  describe('ORDER_CREATED Event', () => {
    it('has valid order payload', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          expectValidEvent(event);
          expect(event.payload).toHaveProperty('order_id');
          expect(event.payload).toHaveProperty('order_number');
          expect(event.payload).toHaveProperty('order_type');
          expect(event.payload).toHaveProperty('items');
          expect(event.payload).toHaveProperty('checks');
        }),
        { numRuns: 100 }
      );
    });

    it('order_number is positive integer', () => {
      testInvariant(
        orderCreatedEventArb,
        (event) => Number.isInteger(event.payload.order_number) && event.payload.order_number > 0,
        'order_number must be positive integer'
      );
    });

    it('order_type is valid enum', () => {
      testInvariant(
        orderCreatedEventArb,
        (event) => ['DINE_IN', 'TAKEOUT', 'DELIVERY'].includes(event.payload.order_type),
        'order_type must be valid enum'
      );
    });

    it('items array is valid', () => {
      testInvariant(
        orderCreatedEventArb,
        (event) => Array.isArray(event.payload.items),
        'items must be array'
      );
    });

    it('checks array is valid', () => {
      testInvariant(
        orderCreatedEventArb,
        (event) => Array.isArray(event.payload.checks),
        'checks must be array'
      );
    });
  });

  describe('SHIFT_OPENED Event', () => {
    it('has valid shift payload', () => {
      fc.assert(
        fc.property(shiftOpenedEventArb, (event) => {
          expectValidEvent(event);
          expect(event.payload).toHaveProperty('shift_id');
          expect(event.payload).toHaveProperty('cash_opening_cents');
        }),
        { numRuns: 100 }
      );
    });

    it('cash_opening_cents is non-negative integer', () => {
      testInvariant(
        shiftOpenedEventArb,
        (event) => Number.isInteger(event.payload.cash_opening_cents) && event.payload.cash_opening_cents >= 0,
        'cash_opening_cents must be non-negative integer'
      );
    });
  });

  describe('CHECK_MARKED_PAID Event', () => {
    it('has valid check payment payload', () => {
      fc.assert(
        fc.property(checkMarkedPaidEventArb, (event) => {
          expectValidEvent(event);
          expect(event.payload).toHaveProperty('order_id');
          expect(event.payload).toHaveProperty('check_id');
          expect(event.payload).toHaveProperty('paid_at');
          expect(event.payload).toHaveProperty('change_cents');
        }),
        { numRuns: 100 }
      );
    });

    it('paid_at is valid ISO date', () => {
      testInvariant(
        checkMarkedPaidEventArb,
        (event) => {
          try {
            expectISODate(event.payload.paid_at);
            return true;
          } catch {
            return false;
          }
        },
        'paid_at must be valid ISO date'
      );
    });

    it('change_cents is non-negative integer', () => {
      testInvariant(
        checkMarkedPaidEventArb,
        (event) => Number.isInteger(event.payload.change_cents) && event.payload.change_cents >= 0,
        'change_cents must be non-negative integer'
      );
    });
  });

  describe('Event Uniqueness', () => {
    it('event_id values are unique across samples', () => {
      const events = fc.sample(eventEnvelopeArb, 100);
      const eventIds = events.map(e => e.event_id);
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(eventIds.length);
    });
  });

  describe('Optional Fields', () => {
    it('causation_id can be null', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          // causation_id is optional, so it can be null or undefined
          expect(envelope.causation_id === null || envelope.causation_id === undefined || typeof envelope.causation_id === 'string').toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('actor_id can be null', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          expect(envelope.actor_id === null || envelope.actor_id === undefined || typeof envelope.actor_id === 'string').toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('actor_role_snapshot can be null', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          expect(envelope.actor_role_snapshot === null || envelope.actor_role_snapshot === undefined || typeof envelope.actor_role_snapshot === 'string').toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('business_date can be null', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          expect(envelope.business_date === null || envelope.business_date === undefined || typeof envelope.business_date === 'string').toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles events with minimal payload', () => {
      const minimalEvent = {
        event_id: '00000000-0000-0000-0000-000000000001',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        terminal_id: 'CAJA-01',
        terminal_sequence: 0,
        occurred_at: new Date().toISOString(),
        aggregate_type: 'ORDER' as const,
        aggregate_id: '00000000-0000-0000-0000-000000000001',
        correlation_id: 'corr-1',
        causation_id: null,
        actor_id: null,
        actor_role_snapshot: null,
        schema_version: 1,
        payload_version: 1,
        shift_id: null,
        business_date: null,
        payload: {},
      };

      expectValidEvent(minimalEvent);
    });

    it('handles events with all optional fields populated', () => {
      fc.assert(
        fc.property(eventEnvelopeArb, (envelope) => {
          const fullEvent = {
            ...envelope,
            causation_id: '00000000-0000-0000-0000-000000000002',
            actor_id: '00000000-0000-0000-0000-000000000003',
            actor_role_snapshot: 'MANAGER',
            business_date: '2026-01-15',
            payload: {},
          };

          expectValidEvent(fullEvent);
        }),
        { numRuns: 100 }
      );
    });
  });
});
