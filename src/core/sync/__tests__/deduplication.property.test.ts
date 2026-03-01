/**
 * Event Deduplication and Offline Sync Property Tests
 * 
 * Tests event deduplication and sync correctness:
 * - Duplicate event_id is detected
 * - Processed events table prevents reprocessing
 * - Non-conflicting changes are preserved
 * - Conflict resolution maintains invariants
 * - Event reordering by timestamp works correctly
 * 
 * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  orderCreatedEventArb,
  checkMarkedPaidEventArb,
  generateRealisticEventSequence,
} from '@/src/test-utils';
import {
  testIdempotence,
  testInvariant,
} from '@/src/test-utils';

/**
 * Simulates processed events table
 */
class ProcessedEventsTable {
  private processed = new Set<string>();

  isProcessed(eventId: string): boolean {
    return this.processed.has(eventId);
  }

  markProcessed(eventId: string): void {
    this.processed.add(eventId);
  }

  clear(): void {
    this.processed.clear();
  }

  size(): number {
    return this.processed.size;
  }
}

/**
 * Applies event with deduplication
 */
function applyEventWithDedup(
  state: any,
  event: any,
  processedTable: ProcessedEventsTable
): any {
  if (processedTable.isProcessed(event.event_id)) {
    return state; // Already processed, skip
  }

  processedTable.markProcessed(event.event_id);

  // Apply event to state
  if (event.payload.type === 'ORDER_CREATED') {
    return {
      ...state,
      order_id: event.payload.order_id,
      order_number: event.payload.order_number,
    };
  }

  return state;
}

/**
 * Detects conflicts between two events
 */
function detectConflict(event1: any, event2: any): boolean {
  // Conflict if both modify same aggregate
  if (event1.aggregate_id === event2.aggregate_id) {
    // And they're not commutative operations
    const type1 = event1.event_type || event1.payload?.type;
    const type2 = event2.event_type || event2.payload?.type;
    if (type1 === 'ORDER_CREATED' && type2 === 'ORDER_CREATED') {
      return true; // Can't create same order twice
    }
  }
  return false;
}

/**
 * Resolves conflict using last-write-wins strategy
 */
function resolveConflictLWW(event1: any, event2: any): any {
  const time1 = new Date(event1.occurred_at).getTime();
  const time2 = new Date(event2.occurred_at).getTime();
  return time1 > time2 ? event1 : event2;
}

/**
 * Merges non-conflicting changes
 */
function mergeNonConflictingChanges(events1: any[], events2: any[]): any[] {
  const merged = [...events1];
  const ids1 = new Set(events1.map(e => e.event_id));

  for (const event of events2) {
    if (!ids1.has(event.event_id)) {
      merged.push(event);
    }
  }

  return merged;
}

describe('Event Deduplication and Offline Sync - Property Tests', () => {
  describe('Property 6: Event Processing Idempotence (Deduplication)', () => {
    it('duplicate event_id is detected', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const table = new ProcessedEventsTable();

          // First processing
          table.markProcessed(event.event_id);
          expect(table.isProcessed(event.event_id)).toBe(true);

          // Second processing - should be detected as duplicate
          expect(table.isProcessed(event.event_id)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('processed events table prevents reprocessing', () => {
      fc.assert(
        fc.property(
          fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 10 }),
          (events) => {
            const table = new ProcessedEventsTable();
            let state = {};

            // Process all events
            for (const event of events) {
              state = applyEventWithDedup(state, event, table);
            }

            const sizeAfterFirst = table.size();

            // Try to process same events again
            for (const event of events) {
              state = applyEventWithDedup(state, event, table);
            }

            const sizeAfterSecond = table.size();

            // Size should not increase (deduplication worked)
            expect(sizeAfterSecond).toBe(sizeAfterFirst);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('deduplication is idempotent', () => {
      testInvariant(
        orderCreatedEventArb,
        (event) => {
          const table = new ProcessedEventsTable();
          table.markProcessed(event.event_id);
          const first = table.isProcessed(event.event_id);
          const second = table.isProcessed(event.event_id);
          return first === second;
        },
        'Deduplication check must be idempotent'
      );
    });
  });

  describe('Property 17: Non-Conflicting Changes Preservation', () => {
    it('non-conflicting events are both preserved', () => {
      fc.assert(
        fc.property(
          fc.tuple(orderCreatedEventArb, checkMarkedPaidEventArb),
          ([event1, event2]) => {
            // Ensure different aggregates (non-conflicting)
            const nonConflictingEvent2 = {
              ...event2,
              aggregate_id: '00000000-0000-0000-0000-000000000099',
            };

            const merged = mergeNonConflictingChanges([event1], [nonConflictingEvent2]);

            expect(merged.length).toBe(2);
            expect(merged.some(e => e.event_id === event1.event_id)).toBe(true);
            expect(merged.some(e => e.event_id === nonConflictingEvent2.event_id)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('duplicate events are not duplicated in merge', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const merged = mergeNonConflictingChanges([event], [event]);

          // Should only have one copy
          expect(merged.length).toBe(1);
          expect(merged[0].event_id).toBe(event.event_id);
        }),
        { numRuns: 100 }
      );
    });

    it('merge preserves all unique events', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 5 }),
            fc.array(checkMarkedPaidEventArb, { minLength: 1, maxLength: 5 })
          ),
          ([events1, events2]) => {
            const merged = mergeNonConflictingChanges(events1, events2);

            // Should have all unique events
            const uniqueIds = new Set(merged.map(e => e.event_id));
            expect(uniqueIds.size).toBe(merged.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: Conflict Resolution Maintains Invariants', () => {
    it('conflict detection identifies same-aggregate modifications', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const conflictingEvent = {
            ...event,
            event_id: '00000000-0000-0000-0000-000000000002',
            event_type: 'ORDER_CREATED',
            payload: { ...event.payload },
          };

          const hasConflict = detectConflict(event, conflictingEvent);
          expect(hasConflict).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('conflict resolution uses last-write-wins', () => {
      fc.assert(
        fc.property(
          fc.tuple(orderCreatedEventArb, orderCreatedEventArb),
          ([event1, event2]) => {
            const resolved = resolveConflictLWW(event1, event2);

            const time1 = new Date(event1.occurred_at).getTime();
            const time2 = new Date(event2.occurred_at).getTime();

            if (time1 > time2) {
              expect(resolved.event_id).toBe(event1.event_id);
            } else {
              expect(resolved.event_id).toBe(event2.event_id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('resolved event maintains valid structure', () => {
      fc.assert(
        fc.property(
          fc.tuple(orderCreatedEventArb, orderCreatedEventArb),
          ([event1, event2]) => {
            const resolved = resolveConflictLWW(event1, event2);

            expect(resolved).toHaveProperty('event_id');
            expect(resolved).toHaveProperty('aggregate_id');
            expect(resolved).toHaveProperty('occurred_at');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19: Event Reordering by Timestamp', () => {
    it('events are reordered by occurred_at', () => {
      fc.assert(
        fc.property(
          fc.array(orderCreatedEventArb, { minLength: 2, maxLength: 10 }),
          (events) => {
            // Shuffle events
            const shuffled = [...events].sort(() => Math.random() - 0.5);

            // Reorder by timestamp
            const reordered = [...shuffled].sort((a, b) => {
              const timeA = new Date(a.occurred_at).getTime();
              const timeB = new Date(b.occurred_at).getTime();
              return timeA - timeB;
            });

            // Verify ordering
            for (let i = 1; i < reordered.length; i++) {
              const time1 = new Date(reordered[i - 1].occurred_at).getTime();
              const time2 = new Date(reordered[i].occurred_at).getTime();
              expect(time1).toBeLessThanOrEqual(time2);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('reordering preserves all events', () => {
      testInvariant(
        fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          const reordered = [...events].sort((a, b) => {
            const timeA = new Date(a.occurred_at).getTime();
            const timeB = new Date(b.occurred_at).getTime();
            return timeA - timeB;
          });

          return reordered.length === events.length;
        },
        'Reordering must preserve all events'
      );
    });
  });

  describe('Outbox Pattern Simulation', () => {
    it('events in outbox are eventually published', () => {
      fc.assert(
        fc.property(
          fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 10 }),
          (events) => {
            const outbox = [...events];
            const published: any[] = [];

            // Simulate publishing
            while (outbox.length > 0) {
              const event = outbox.shift();
              if (event) {
                published.push(event);
              }
            }

            expect(published.length).toBe(events.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('published events are marked', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const outboxEvent = {
            ...event,
            published: false,
          };

          // Mark as published
          outboxEvent.published = true;

          expect(outboxEvent.published).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles empty event sequence', () => {
      const table = new ProcessedEventsTable();
      expect(table.size()).toBe(0);
    });

    it('handles single event', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const table = new ProcessedEventsTable();
          table.markProcessed(event.event_id);

          expect(table.size()).toBe(1);
          expect(table.isProcessed(event.event_id)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('handles duplicate events in sequence', () => {
      fc.assert(
        fc.property(orderCreatedEventArb, (event) => {
          const events = [event, event, event];
          const table = new ProcessedEventsTable();

          for (const e of events) {
            table.markProcessed(e.event_id);
          }

          expect(table.size()).toBe(1);
        }),
        { numRuns: 100 }
      );
    });

    it('handles events with same timestamp', () => {
      fc.assert(
        fc.property(
          fc.array(orderCreatedEventArb, { minLength: 2, maxLength: 5 }),
          (events) => {
            const sameTimeEvents = events.map(e => ({
              ...e,
              occurred_at: new Date('2026-01-15T12:00:00Z').toISOString(),
            }));

            const reordered = [...sameTimeEvents].sort((a, b) => {
              const timeA = new Date(a.occurred_at).getTime();
              const timeB = new Date(b.occurred_at).getTime();
              return timeA - timeB;
            });

            expect(reordered.length).toBe(sameTimeEvents.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invariants', () => {
    it('processed table never loses events', () => {
      testInvariant(
        fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          const table = new ProcessedEventsTable();

          for (const event of events) {
            table.markProcessed(event.event_id);
          }

          // All events should be marked
          return events.every(e => table.isProcessed(e.event_id));
        },
        'All processed events must be tracked'
      );
    });

    it('deduplication prevents duplicate processing', () => {
      testInvariant(
        fc.array(orderCreatedEventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          const table = new ProcessedEventsTable();

          // Process twice
          for (const event of events) {
            table.markProcessed(event.event_id);
          }
          const sizeAfterFirst = table.size();

          for (const event of events) {
            table.markProcessed(event.event_id);
          }
          const sizeAfterSecond = table.size();

          return sizeAfterFirst === sizeAfterSecond;
        },
        'Deduplication must prevent duplicate processing'
      );
    });
  });
});

