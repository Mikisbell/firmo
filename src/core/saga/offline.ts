/**
 * Offline Saga Support
 * 
 * Handles saga execution in offline mode with event queuing and
 * synchronization when connectivity returns.
 */

import { logger } from '@/src/core/observability/logger';
import { metricsHelpers } from '@/src/core/observability/metrics';
import { db } from '@/src/core/db/schema';
import type { ParkEvent } from '@/src/core/domain/events';

export interface OfflineSagaEvent {
  event_id: string;
  saga_id: string;
  tenant_id: string;
  event: ParkEvent;
  queued_at: string;
  synced: boolean;
  sync_attempts: number;
  last_sync_error?: string;
}

/**
 * Offline saga event queue manager
 */
export class OfflineSagaEventQueue {
  /**
   * Queue a saga event for later synchronization
   */
  async queueEvent(
    sagaId: string,
    tenantId: string,
    event: ParkEvent
  ): Promise<void> {
    const offlineEvent: OfflineSagaEvent = {
      event_id: event.event_id,
      saga_id: sagaId,
      tenant_id: tenantId,
      event,
      queued_at: new Date().toISOString(),
      synced: false,
      sync_attempts: 0,
    };

    try {
      // Store in IndexedDB for offline persistence
      await db.offline_saga_events.add(offlineEvent);

      logger.debug('OFFLINE_SAGA_EVENT_QUEUED', 'Saga event queued for sync', {
        sagaId,
        eventId: event.event_id,
        eventType: event.event_type,
      });

      metricsHelpers.recordOfflineSagaEventQueued(tenantId);
    } catch (error) {
      logger.error(
        'OFFLINE_SAGA_EVENT_QUEUE_ERROR',
        'Failed to queue offline saga event',
        error instanceof Error ? error : new Error(String(error)),
        { sagaId, eventId: event.event_id }
      );
      throw error;
    }
  }

  /**
   * Get all queued events for a tenant
   */
  async getQueuedEvents(tenantId: string): Promise<OfflineSagaEvent[]> {
    try {
      const events = await db.offline_saga_events
        .where('[tenant_id+synced]')
        .equals([tenantId, false])
        .toArray();

      return events;
    } catch (error) {
      logger.error(
        'OFFLINE_SAGA_EVENT_QUERY_ERROR',
        'Failed to query offline saga events',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId }
      );
      return [];
    }
  }

  /**
   * Mark event as synced
   */
  async markSynced(eventId: string): Promise<void> {
    try {
      await db.offline_saga_events.update(eventId, {
        synced: true,
        sync_attempts: (await db.offline_saga_events.get(eventId))?.sync_attempts || 0,
      });

      logger.debug('OFFLINE_SAGA_EVENT_SYNCED', 'Saga event marked as synced', {
        eventId,
      });

      metricsHelpers.recordOfflineSagaEventSynced();
    } catch (error) {
      logger.error(
        'OFFLINE_SAGA_EVENT_SYNC_ERROR',
        'Failed to mark saga event as synced',
        error instanceof Error ? error : new Error(String(error)),
        { eventId }
      );
    }
  }

  /**
   * Record sync attempt failure
   */
  async recordSyncFailure(
    eventId: string,
    error: Error
  ): Promise<void> {
    try {
      const event = await db.offline_saga_events.get(eventId);
      if (event) {
        await db.offline_saga_events.update(eventId, {
          sync_attempts: (event.sync_attempts || 0) + 1,
          last_sync_error: error.message,
        });

        logger.warn('OFFLINE_SAGA_EVENT_SYNC_FAILED', 'Saga event sync failed', {
          eventId,
          attempt: event.sync_attempts + 1,
          error: error.message,
        });

        metricsHelpers.recordOfflineSagaEventSyncFailed(error.constructor.name);
      }
    } catch (error) {
      logger.error(
        'OFFLINE_SAGA_EVENT_FAILURE_RECORD_ERROR',
        'Failed to record sync failure',
        error instanceof Error ? error : new Error(String(error)),
        { eventId }
      );
    }
  }

  /**
   * Clear synced events (cleanup)
   */
  async clearSyncedEvents(tenantId: string): Promise<number> {
    try {
      const syncedEvents = await db.offline_saga_events
        .where('[tenant_id+synced]')
        .equals([tenantId, true])
        .toArray();

      const count = syncedEvents.length;

      for (const event of syncedEvents) {
        await db.offline_saga_events.delete(event.event_id);
      }

      logger.info('OFFLINE_SAGA_EVENTS_CLEARED', 'Synced saga events cleared', {
        tenantId,
        count,
      });

      return count;
    } catch (error) {
      logger.error(
        'OFFLINE_SAGA_EVENTS_CLEAR_ERROR',
        'Failed to clear synced saga events',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId }
      );
      return 0;
    }
  }
}

/**
 * Offline saga synchronizer
 */
export class OfflineSagaSynchronizer {
  private queue: OfflineSagaEventQueue;
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;

  constructor(queue: OfflineSagaEventQueue) {
    this.queue = queue;
    this.setupNetworkListeners();
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        logger.info('NETWORK_ONLINE', 'Network connectivity restored');
        metricsHelpers.recordNetworkStatusChange('online');
        // Trigger sync when coming online
        this.syncQueuedEvents().catch(error => {
          logger.error('SYNC_ON_ONLINE_ERROR', 'Error syncing on online', error);
        });
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        logger.info('NETWORK_OFFLINE', 'Network connectivity lost');
        metricsHelpers.recordNetworkStatusChange('offline');
      });
    }
  }

  /**
   * Check if system is online
   */
  isSystemOnline(): boolean {
    if (typeof window !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Assume online on server
  }

  /**
   * Synchronize queued saga events to server
   */
  async syncQueuedEvents(tenantId?: string): Promise<void> {
    if (this.syncInProgress) {
      logger.debug('SYNC_ALREADY_IN_PROGRESS', 'Saga event sync already in progress');
      return;
    }

    if (!this.isSystemOnline()) {
      logger.debug('SYNC_OFFLINE', 'Cannot sync - system is offline');
      return;
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      // Get all queued events (or for specific tenant)
      const allQueued = await db.offline_saga_events
        .where('synced')
        .equals(false)
        .toArray();

      const queuedEvents = tenantId
        ? allQueued.filter(e => e.tenant_id === tenantId)
        : allQueued;

      if (queuedEvents.length === 0) {
        logger.debug('SYNC_NO_EVENTS', 'No queued saga events to sync');
        return;
      }

      logger.info('SYNC_START', 'Starting saga event synchronization', {
        eventCount: queuedEvents.length,
        tenantId,
      });

      // Sync events in order (preserve causality)
      for (const offlineEvent of queuedEvents) {
        try {
          // Send event to server
          const response = await fetch('/api/events/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              events: [offlineEvent.event],
              source: 'offline-saga-sync',
            }),
          });

          if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
          }

          // Mark as synced
          await this.queue.markSynced(offlineEvent.event_id);

          logger.debug('SAGA_EVENT_SYNCED', 'Saga event synced to server', {
            eventId: offlineEvent.event_id,
            sagaId: offlineEvent.saga_id,
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          await this.queue.recordSyncFailure(offlineEvent.event_id, err);

          // Stop syncing on first failure to preserve order
          logger.warn('SAGA_EVENT_SYNC_FAILED', 'Failed to sync saga event', {
            eventId: offlineEvent.event_id,
            error: err.message,
          });
          break;
        }
      }

      const duration = Date.now() - startTime;
      logger.info('SYNC_COMPLETE', 'Saga event synchronization completed', {
        duration,
        tenantId,
      });

      metricsHelpers.recordOfflineSagaSyncCompleted(duration);
    } catch (error) {
      logger.error(
        'SYNC_ERROR',
        'Error during saga event synchronization',
        error instanceof Error ? error : new Error(String(error))
      );
      metricsHelpers.recordOfflineSagaSyncFailed();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get sync status for a tenant
   */
  async getSyncStatus(tenantId: string): Promise<{
    queuedCount: number;
    syncedCount: number;
    failedCount: number;
    lastSyncTime?: string;
  }> {
    try {
      const allEvents = await db.offline_saga_events
        .where('tenant_id')
        .equals(tenantId)
        .toArray();

      const queued = allEvents.filter(e => !e.synced && (e.sync_attempts || 0) === 0);
      const synced = allEvents.filter(e => e.synced);
      const failed = allEvents.filter(e => !e.synced && (e.sync_attempts || 0) > 0);

      return {
        queuedCount: queued.length,
        syncedCount: synced.length,
        failedCount: failed.length,
        lastSyncTime: synced.length > 0
          ? synced[synced.length - 1].queued_at
          : undefined,
      };
    } catch (error) {
      logger.error(
        'SYNC_STATUS_ERROR',
        'Failed to get sync status',
        error instanceof Error ? error : new Error(String(error)),
        { tenantId }
      );
      return {
        queuedCount: 0,
        syncedCount: 0,
        failedCount: 0,
      };
    }
  }
}

// Singleton instances
export const offlineSagaEventQueue = new OfflineSagaEventQueue();
export const offlineSagaSynchronizer = new OfflineSagaSynchronizer(offlineSagaEventQueue);
