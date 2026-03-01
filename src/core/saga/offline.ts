/**
 * Offline Saga Event Queue & Synchronizer
 *
 * Manages offline saga event queuing via Dexie/IndexedDB.
 * Events are queued locally when offline and synchronized
 * when connectivity returns.
 *
 * @module core/saga/offline
 */

import { db, type OfflineSagaEventEntity } from '@/src/core/db/schema';
import type { ParkEvent } from '@/src/core/domain/events';

/**
 * Queues and manages saga events for offline execution.
 * Uses Dexie (IndexedDB) for persistent local storage.
 */
export class OfflineSagaEventQueue {
  /**
   * Queue an event for later synchronization
   */
  async queueEvent(sagaId: string, tenantId: string, event: ParkEvent): Promise<void> {
    const entity: OfflineSagaEventEntity = {
      event_id: event.event_id,
      saga_id: sagaId,
      tenant_id: tenantId,
      event,
      queued_at: new Date().toISOString(),
      synced: false,
      sync_attempts: 0,
    };
    await db.offline_saga_events.add(entity);
  }

  /**
   * Get all queued (unsynced) events for a tenant, ordered by insertion
   */
  async getQueuedEvents(tenantId: string): Promise<OfflineSagaEventEntity[]> {
    return (db.offline_saga_events
      .where('[tenant_id+synced]') as any)
      .equals([tenantId, false])
      .toArray();
  }

  /**
   * Mark an event as successfully synced (removes from queue)
   */
  async markSynced(eventId: string): Promise<void> {
    await db.offline_saga_events.update(eventId, { synced: true });
  }

  /**
   * Record a sync failure for an event
   */
  async recordSyncFailure(eventId: string, error: Error): Promise<void> {
    const existing = await db.offline_saga_events.get(eventId);
    if (existing) {
      await db.offline_saga_events.update(eventId, {
        sync_attempts: existing.sync_attempts + 1,
        last_sync_error: error.message,
      });
    }
  }
}

/**
 * Tracks synchronization status across all offline saga events
 */
export class OfflineSagaSynchronizer {
  constructor(private queue: OfflineSagaEventQueue) {}

  /**
   * Get sync status summary for a tenant
   */
  async getSyncStatus(tenantId: string): Promise<{
    queuedCount: number;
    syncedCount: number;
    failedCount: number;
  }> {
    const allForTenant = await db.offline_saga_events
      .where('tenant_id')
      .equals(tenantId)
      .toArray();

    const queuedCount = allForTenant.filter(e => !e.synced).length;
    const syncedCount = allForTenant.filter(e => e.synced).length;
    const failedCount = allForTenant.filter(e => !e.synced && e.sync_attempts > 0).length;

    return { queuedCount, syncedCount, failedCount };
  }
}
