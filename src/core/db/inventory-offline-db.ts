/**
 * Inventory Offline Database (Dexie/IndexedDB)
 * Task 7.2 - Inventory UI Spec
 * 
 * Schema para eventos de inventario pendientes de sincronización.
 * Soporta:
 * - Guardar eventos cuando no hay conexión
 * - Sync automático cuando vuelve conexión
 * - Retry con backoff exponencial
 * - Deduplicación por event_id
 */

import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/src/core/observability/logger';

// ============ TYPES ============

export type InventoryEventType = 'GOODS_RECEIVED' | 'WASTE_RECORDED' | 'INVENTORY_ADJUSTED';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface PendingInventoryEvent {
  id?: number; // auto-increment
  eventId: string; // UUID - unique identifier
  type: InventoryEventType;
  tenantId: string;
  locationId: string;
  actorId: string;
  terminalId: string;
  createdAt: string; // ISO 8601
  syncStatus: SyncStatus;
  retryCount: number;
  lastError?: string;
  payload: unknown; // Event-specific data
}

// ============ DATABASE CLASS ============

const DB_NAME = 'InventoryOfflineDB';
const MAX_RETRIES = 5;

class InventoryOfflineDB extends Dexie {
  pendingEvents!: EntityTable<PendingInventoryEvent, 'id'>;

  constructor() {
    super(DB_NAME);

    this.version(1).stores({
      pendingEvents: '++id, &eventId, type, syncStatus, createdAt, retryCount',
    });
  }

  // ============ OPERATIONS ============

  /**
   * Add a new pending event
   */
  async addPendingEvent(event: Omit<PendingInventoryEvent, 'id'>): Promise<number> {
    // Check for duplicate
    const existing = await this.pendingEvents
      .where('eventId')
      .equals(event.eventId)
      .first();
    
    if (existing) {
      logger.debug('INVENTORY_OFFLINE_EVENT_EXISTS', 'Event already exists, skipping', { eventId: event.eventId });
      return existing.id!;
    }

    const id = await this.pendingEvents.add(event as PendingInventoryEvent);
    logger.debug('INVENTORY_OFFLINE_EVENT_ADDED', 'Added pending event', { eventId: event.eventId, id });
    return id ?? 0;
  }

  /**
   * Get all pending events (not synced, not failed beyond max retries)
   */
  async getPendingEvents(): Promise<PendingInventoryEvent[]> {
    return this.pendingEvents
      .where('syncStatus')
      .anyOf(['pending', 'failed'])
      .and(event => event.retryCount < MAX_RETRIES)
      .sortBy('createdAt');
  }

  /**
   * Get count of pending events
   */
  async getPendingCount(): Promise<number> {
    return this.pendingEvents
      .where('syncStatus')
      .anyOf(['pending', 'syncing', 'failed'])
      .and(event => event.retryCount < MAX_RETRIES)
      .count();
  }

  /**
   * Update event sync status
   */
  async updateEventStatus(eventId: string, status: SyncStatus): Promise<void> {
    await this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .modify({ syncStatus: status });
  }

  /**
   * Increment retry count and set error
   */
  async incrementRetry(eventId: string, error: string): Promise<void> {
    const event = await this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .first();
    
    if (event) {
      const newRetryCount = event.retryCount + 1;
      await this.pendingEvents
        .where('eventId')
        .equals(eventId)
        .modify({
          retryCount: newRetryCount,
          lastError: error,
          syncStatus: newRetryCount >= MAX_RETRIES ? 'failed' : 'pending',
        });
    }
  }

  /**
   * Mark event as synced
   */
  async markAsSynced(eventId: string): Promise<void> {
    await this.updateEventStatus(eventId, 'synced');
  }

  /**
   * Delete synced events (cleanup)
   */
  async cleanupSyncedEvents(): Promise<number> {
    const count = await this.pendingEvents
      .where('syncStatus')
      .equals('synced')
      .delete();
    
    if (count > 0) {
      logger.info('INVENTORY_OFFLINE_CLEANUP_SYNCED', 'Cleaned up synced events', { count });
    }
    return count;
  }

  /**
   * Delete failed events beyond max retries
   */
  async cleanupFailedEvents(): Promise<number> {
    const count = await this.pendingEvents
      .where('syncStatus')
      .equals('failed')
      .and(event => event.retryCount >= MAX_RETRIES)
      .delete();
    
    if (count > 0) {
      logger.info('INVENTORY_OFFLINE_CLEANUP_FAILED', 'Cleaned up permanently failed events', { count });
    }
    return count;
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<PendingInventoryEvent | undefined> {
    return this.pendingEvents
      .where('eventId')
      .equals(eventId)
      .first();
  }

  /**
   * Get all events (for debugging)
   */
  async getAllEvents(): Promise<PendingInventoryEvent[]> {
    return this.pendingEvents.toArray();
  }

  /**
   * Clear all events (for testing)
   */
  async clearAll(): Promise<void> {
    await this.pendingEvents.clear();
    logger.info('INVENTORY_OFFLINE_CLEARED', 'All events cleared');
  }
}

// ============ SINGLETON ============

let _instance: InventoryOfflineDB | null = null;

function getInstance(): InventoryOfflineDB {
  if (typeof window === 'undefined') {
    throw new Error('InventoryOfflineDB can only be used on the client side');
  }
  if (!_instance) {
    _instance = new InventoryOfflineDB();
  }
  return _instance;
}

// Export proxy for lazy initialization
export const inventoryOfflineDb = new Proxy({} as InventoryOfflineDB, {
  get(_, prop) {
    const instance = getInstance();
    const value = (instance as any)[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
});

// SSR-safe getter
export function getInventoryOfflineDb(): InventoryOfflineDB | null {
  if (typeof window === 'undefined') return null;
  return getInstance();
}

// Export class for testing
export { InventoryOfflineDB };
