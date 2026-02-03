/**
 * Property-Based Tests for Offline Saga Support
 * 
 * Tests offline execution, event queuing, and synchronization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { OfflineSagaEventQueue, OfflineSagaSynchronizer } from '../offline';
import type { ParkEvent } from '@/src/core/domain/events';

// Mock Dexie
vi.mock('@/src/core/db/schema', () => {
  const offlineEvents = new Map<string, any>();

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
              for (const [_, entity] of offlineEvents) {
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

describe('Offline Saga Support - Property Tests', () => {
  let queue: OfflineSagaEventQueue;

  beforeEach(async () => {
    const { db } = await import('@/src/core/db/schema');
    await db.offline_saga_events.clear();
    queue = new OfflineSagaEventQueue();
  });

  /**
   * Property 12: Offline Saga Execution
   * 
   * For any saga executed when offline, the saga should execute entirely
   * on the local terminal and queue all saga events for later synchronization.
   */
  it('Property 12: Saga events are queued when offline', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // number of events
        async (numEvents) => {
          const sagaId = `offline-saga-${Date.now()}`;
          const tenantId = 'test-tenant';
          const queuedEventIds: string[] = [];

          // Queue multiple events
          for (let i = 0; i < numEvents; i++) {
            const event: ParkEvent = {
              event_id: `event-${i}`,
              tenant_id: tenantId,
              terminal_id: 'saga-orchestrator',
              terminal_sequence: 0,
              occurred_at: new Date().toISOString(),
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
              event_type: `SAGA_EVENT_${i}` as any,
              payload: {
                saga_id: sagaId,
                step_index: i,
              } as any,
            };

            await queue.queueEvent(sagaId, tenantId, event);
            queuedEventIds.push(event.event_id);
          }

          // Verify all events were queued
          const queued = await queue.getQueuedEvents(tenantId);
          expect(queued).toHaveLength(numEvents);

          // Verify all queued events have correct properties
          queued.forEach((queuedEvent, i) => {
            expect(queuedEvent.saga_id).toBe(sagaId);
            expect(queuedEvent.tenant_id).toBe(tenantId);
            expect(queuedEvent.synced).toBe(false);
            expect(queuedEvent.sync_attempts).toBe(0);
            expect(queuedEvent.event_id).toBe(`event-${i}`);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Saga Event Synchronization
   * 
   * For any saga events queued while offline, when network connectivity
   * returns, all events should be synchronized to the server in the order
   * they were created.
   */
  it('Property 13: Queued events maintain order during sync', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }), // number of events
        async (numEvents) => {
          const sagaId = `sync-saga-${Date.now()}`;
          const tenantId = 'test-tenant';
          const eventIds: string[] = [];

          // Queue events in order
          for (let i = 0; i < numEvents; i++) {
            const event: ParkEvent = {
              event_id: `event-${i}`,
              tenant_id: tenantId,
              terminal_id: 'saga-orchestrator',
              terminal_sequence: 0,
              occurred_at: new Date(Date.now() + i * 1000).toISOString(),
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
              event_type: `SAGA_EVENT_${i}` as any,
              payload: {
                saga_id: sagaId,
                step_index: i,
              } as any,
            };

            await queue.queueEvent(sagaId, tenantId, event);
            eventIds.push(event.event_id);
          }

          // Verify events are in order
          const queued = await queue.getQueuedEvents(tenantId);
          const queuedIds = queued.map(e => e.event_id);

          // Events should be retrievable in insertion order
          expect(queuedIds).toEqual(eventIds);

          // Mark first event as synced
          await queue.markSynced(eventIds[0]);

          // Verify sync status
          const stillQueued = await queue.getQueuedEvents(tenantId);
          expect(stillQueued).toHaveLength(numEvents - 1);
          expect(stillQueued.map(e => e.event_id)).not.toContain(eventIds[0]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Outbox Pattern Integration (Offline variant)
   * 
   * For any saga event queued offline, the event structure must be
   * compatible with the Outbox Pattern for reliable delivery.
   */
  it('Property 14: Offline queued events are Outbox-compatible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (numEvents) => {
          const sagaId = `outbox-saga-${Date.now()}`;
          const tenantId = 'test-tenant';

          for (let i = 0; i < numEvents; i++) {
            const event: ParkEvent = {
              event_id: `event-${i}`,
              tenant_id: tenantId,
              terminal_id: 'saga-orchestrator',
              terminal_sequence: 0,
              occurred_at: new Date().toISOString(),
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
              event_type: `SAGA_EVENT_${i}` as any,
              payload: {
                saga_id: sagaId,
                step_index: i,
              } as any,
            };

            await queue.queueEvent(sagaId, tenantId, event);
          }

          // Verify all queued events have Outbox-compatible structure
          const queued = await queue.getQueuedEvents(tenantId);

          queued.forEach((queuedEvent) => {
            // Required Outbox fields
            expect(queuedEvent).toHaveProperty('event_id');
            expect(queuedEvent).toHaveProperty('event');
            expect(queuedEvent).toHaveProperty('queued_at');
            expect(queuedEvent).toHaveProperty('synced');
            expect(queuedEvent).toHaveProperty('sync_attempts');

            // Event must be serializable (for Outbox storage)
            expect(() => JSON.stringify(queuedEvent.event)).not.toThrow();

            // Event must have required fields
            const evt = queuedEvent.event;
            expect(evt).toHaveProperty('event_id');
            expect(evt).toHaveProperty('tenant_id');
            expect(evt).toHaveProperty('event_type');
            expect(evt).toHaveProperty('payload');
            expect(evt).toHaveProperty('occurred_at');
          });
        }
      ),
      { numRuns: 100 }
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
          const eventId = `event-${Date.now()}`;
          const event: ParkEvent = {
            event_id: eventId,
            tenant_id: 'test-tenant',
            terminal_id: 'saga-orchestrator',
            terminal_sequence: 0,
            occurred_at: new Date().toISOString(),
            aggregate_type: 'SAGA',
            aggregate_id: 'saga-1',
            correlation_id: 'saga-1',
            causation_id: null,
            actor_id: null,
            actor_role_snapshot: null,
            schema_version: 1,
            payload_version: 1,
            shift_id: null,
            business_date: null,
            event_type: 'SAGA_EVENT' as any,
            payload: { saga_id: 'saga-1' } as any,
          };

          await queue.queueEvent('saga-1', 'test-tenant', event);

          // Record failure
          const error = new Error(errorMessage);
          await queue.recordSyncFailure(eventId, error);

          // Verify failure was recorded
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
   * Sync status tracking
   */
  it('should track sync status correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }), // queued events
        fc.integer({ min: 0, max: 3 }), // synced events
        async (queuedCount, syncedCount) => {
          const tenantId = 'test-tenant';
          const sagaId = `saga-${Date.now()}`;

          // Queue events
          for (let i = 0; i < queuedCount; i++) {
            const event: ParkEvent = {
              event_id: `queued-${i}`,
              tenant_id: tenantId,
              terminal_id: 'saga-orchestrator',
              terminal_sequence: 0,
              occurred_at: new Date().toISOString(),
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
              event_type: 'SAGA_EVENT' as any,
              payload: { saga_id: sagaId } as any,
            };

            await queue.queueEvent(sagaId, tenantId, event);
          }

          // Mark some as synced
          const queued = await queue.getQueuedEvents(tenantId);
          for (let i = 0; i < Math.min(syncedCount, queued.length); i++) {
            await queue.markSynced(queued[i].event_id);
          }

          // Get sync status
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
