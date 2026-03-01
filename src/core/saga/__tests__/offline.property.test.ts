/**
 * Property-Based Tests for Offline Saga Support
 *
 * Tests offline execution, event queuing, and synchronization:
 * - Property 12: Saga events are queued when offline
 * - Property 13: Queued events maintain order during sync
 * - Property 14: Offline queued events are Outbox-compatible
 * - Sync failure recording
 * - Sync status tracking
 *
 * @module saga/__tests__/offline-property
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { ParkEvent } from '@/src/core/domain/events';

// Mock Dexie — in-memory Map simulates IndexedDB
const offlineEvents = new Map<string, any>();

vi.mock('@/src/core/db/schema', () => {
  return {
    db: {
      offline_saga_events: {
        add: vi.fn(async (entity: any) => {
          offlineEvents.set(entity.event_id, entity);
          return entity.event_id;
        }),
        get: vi.fn(async (eventId: string) => {
          return offlineEvents.get(eventId) || null;
        }),
        update: vi.fn(async (eventId: string, changes: any) => {
          const existing = offlineEvents.get(eventId);
          if (existing) {
            offlineEvents.set(eventId, { ...existing, ...changes });
          }
          return 1;
        }),
        delete: vi.fn(async (eventId: string) => {
          offlineEvents.delete(eventId);
        }),
        where: vi.fn((field: string) => ({
          equals: vi.fn((value: any) => ({
            toArray: vi.fn(async () => {
              const results: any[] = [];
              for (const [, entity] of offlineEvents) {
                if (field === '[tenant_id+synced]') {
                  const [tenantId, synced] = value;
                  if (entity.tenant_id === tenantId && entity.synced === synced) {
                    results.push(entity);
                  }
                } else if (field === 'synced' && entity.synced === value) {
                  results.push(entity);
                } else if (field === 'tenant_id' && entity.tenant_id === value) {
                  results.push(entity);
                }
              }
              return results;
            }),
          })),
        })),
        toArray: vi.fn(async () => Array.from(offlineEvents.values())),
        clear: vi.fn(async () => {
          offlineEvents.clear();
        }),
      },
    },
  };
});

// Import AFTER mock is set up
import { OfflineSagaEventQueue, OfflineSagaSynchronizer } from '../offline';

/** Helper to build a minimal ParkEvent */
function makeSagaEvent(id: string, tenantId: string, sagaId: string, index: number, timeOffset = 0): ParkEvent {
  return {
    event_id: id,
    tenant_id: tenantId,
    terminal_id: 'saga-orchestrator',
    terminal_sequence: 0,
    occurred_at: new Date(Date.now() + timeOffset).toISOString(),
    aggregate_type: 'SAGA',
    aggregate_id: sagaId,
    correlation_id: sagaId,
    causation_id: null,
    actor_id: null,
    actor_role_snapshot: null,
    schema_version: 1,
    payload_version: 1,
    shift_id: null,
    business_date: null,
    event_type: `SAGA_EVENT_${index}` as any,
    payload: { saga_id: sagaId, step_index: index } as any,
  };
}

describe('Offline Saga Support - Property Tests', () => {
  let queue: OfflineSagaEventQueue;

  beforeEach(() => {
    offlineEvents.clear();
    queue = new OfflineSagaEventQueue();
  });

  /**
   * Property 12: Offline Saga Execution
   */
  it('Property 12: Saga events are queued when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numEvents) => {
          offlineEvents.clear();
          const sagaId = `offline-saga-${numEvents}`;
          const tenantId = 'test-tenant';

          for (let i = 0; i < numEvents; i++) {
            const event = makeSagaEvent(`event-${i}`, tenantId, sagaId, i);
            await queue.queueEvent(sagaId, tenantId, event);
          }

          const queued = await queue.getQueuedEvents(tenantId);
          expect(queued).toHaveLength(numEvents);

          queued.forEach((queuedEvent, i) => {
            expect(queuedEvent.saga_id).toBe(sagaId);
            expect(queuedEvent.tenant_id).toBe(tenantId);
            expect(queuedEvent.synced).toBe(false);
            expect(queuedEvent.sync_attempts).toBe(0);
            expect(queuedEvent.event_id).toBe(`event-${i}`);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 13: Saga Event Synchronization
   */
  it('Property 13: Queued events maintain order during sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }),
        async (numEvents) => {
          offlineEvents.clear();
          const sagaId = `sync-saga-${numEvents}`;
          const tenantId = 'test-tenant';
          const eventIds: string[] = [];

          for (let i = 0; i < numEvents; i++) {
            const event = makeSagaEvent(`event-${i}`, tenantId, sagaId, i, i * 1000);
            await queue.queueEvent(sagaId, tenantId, event);
            eventIds.push(event.event_id);
          }

          const queued = await queue.getQueuedEvents(tenantId);
          const queuedIds = queued.map(e => e.event_id);
          expect(queuedIds).toEqual(eventIds);

          // Mark first event as synced
          await queue.markSynced(eventIds[0]);

          const stillQueued = await queue.getQueuedEvents(tenantId);
          expect(stillQueued).toHaveLength(numEvents - 1);
          expect(stillQueued.map(e => e.event_id)).not.toContain(eventIds[0]);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 14: Outbox Pattern Integration (Offline variant)
   */
  it('Property 14: Offline queued events are Outbox-compatible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numEvents) => {
          offlineEvents.clear();
          const sagaId = `outbox-saga-${numEvents}`;
          const tenantId = 'test-tenant';

          for (let i = 0; i < numEvents; i++) {
            const event = makeSagaEvent(`event-${i}`, tenantId, sagaId, i);
            await queue.queueEvent(sagaId, tenantId, event);
          }

          const queued = await queue.getQueuedEvents(tenantId);

          queued.forEach((queuedEvent) => {
            expect(queuedEvent).toHaveProperty('event_id');
            expect(queuedEvent).toHaveProperty('event');
            expect(queuedEvent).toHaveProperty('queued_at');
            expect(queuedEvent).toHaveProperty('synced');
            expect(queuedEvent).toHaveProperty('sync_attempts');

            expect(() => JSON.stringify(queuedEvent.event)).not.toThrow();

            const evt = queuedEvent.event;
            expect(evt).toHaveProperty('event_id');
            expect(evt).toHaveProperty('tenant_id');
            expect(evt).toHaveProperty('event_type');
            expect(evt).toHaveProperty('payload');
            expect(evt).toHaveProperty('occurred_at');
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Sync failure recording
   */
  it('should record sync failures with error details', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (errorMessage) => {
          offlineEvents.clear();
          const eventId = `fail-event-${errorMessage.length}`;
          const event = makeSagaEvent(eventId, 'test-tenant', 'saga-1', 0);

          await queue.queueEvent('saga-1', 'test-tenant', event);

          const error = new Error(errorMessage);
          await queue.recordSyncFailure(eventId, error);

          const queued = await queue.getQueuedEvents('test-tenant');
          const failedEvent = queued.find(e => e.event_id === eventId);

          expect(failedEvent).toBeDefined();
          expect(failedEvent?.sync_attempts).toBe(1);
          expect(failedEvent?.last_sync_error).toBe(errorMessage);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Sync status tracking via OfflineSagaSynchronizer
   */
  it('should track sync status correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 3 }),
        async (queuedCount, syncedCount) => {
          offlineEvents.clear();
          const tenantId = 'test-tenant';
          const sagaId = `saga-status`;

          for (let i = 0; i < queuedCount; i++) {
            const event = makeSagaEvent(`queued-${i}`, tenantId, sagaId, i);
            await queue.queueEvent(sagaId, tenantId, event);
          }

          // Mark some as synced
          const queued = await queue.getQueuedEvents(tenantId);
          for (let i = 0; i < Math.min(syncedCount, queued.length); i++) {
            await queue.markSynced(queued[i].event_id);
          }

          const synchronizer = new OfflineSagaSynchronizer(queue);
          const status = await synchronizer.getSyncStatus(tenantId);

          expect(status.queuedCount).toBe(queuedCount - Math.min(syncedCount, queuedCount));
          expect(status.syncedCount).toBe(Math.min(syncedCount, queuedCount));
          expect(status.failedCount).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});
