/**
 * Local Event Store (Dexie/IndexedDB)
 * Unified Outbox Pattern for Offline-First POS.
 *
 * Esquema universal para almacenar eventos pendientes de sincronización.
 * Reemplaza los silos anteriores (HR/Inventory).
 */

import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/src/core/observability/logger';

// ============ TYPES ============

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'poison_pill';

export interface LocalEvent {
  id?: number;              // Auto-increment local
  event_id: string;         // UUID global
  aggregate_id: string;     // ID de entidad (ej. table_123, employee_456)
  event_type: string;       // El tipo de evento (ej. ORDER_CREATED)
  tenant_id: string;
  location_id: string;
  actor_id: string;
  terminal_id: string;
  created_at: string;       // ISO 8601
  sync_status: SyncStatus;
  retry_count: number;
  last_error?: string;
  payload: unknown;         // JSON libre
}

// ============ DATABASE CLASS ============

const DB_NAME = 'ParkPosOfflineDB';
const MAX_RETRIES = 5;

export class LocalEventStore extends Dexie {
  events!: EntityTable<LocalEvent, 'id'>;

  constructor() {
    super(DB_NAME);

    // Índices críticos:
    // aggregate_id: para agrupar en el Worker (FIFO Particionado)
    // sync_status: para encontrar rápidamente los pendientes
    this.version(1).stores({
      events: '++id, &event_id, aggregate_id, sync_status, created_at, retry_count',
    });
  }

  // ============ OPERATIONS ============

  /**
   * Añadir un evento de forma idempotente (Outbox)
   */
  async addEvent(event: Omit<LocalEvent, 'id' | 'sync_status' | 'retry_count'>): Promise<number> {
    const existing = await this.events.where('event_id').equals(event.event_id).first();
    
    if (existing) {
      logger.debug('LOCAL_STORE_DUPLICATE', 'Evento ya encolado', { eventId: event.event_id });
      return existing.id!;
    }

    const id = await this.events.add({
      ...event,
      sync_status: 'pending',
      retry_count: 0
    } as LocalEvent);
    
    logger.debug('LOCAL_STORE_ADDED', 'Evento añadido al Outbox', { eventId: event.event_id, id });
    return id ?? 0;
  }

  /**
   * Obtener todos los eventos pendientes o fallidos (no Poison Pills)
   * Útil para el Web Worker
   */
  async getSyncableEvents(): Promise<LocalEvent[]> {
    return this.events
      .where('sync_status')
      .anyOf(['pending', 'failed'])
      .and(event => event.retry_count < MAX_RETRIES && event.sync_status !== 'poison_pill')
      .sortBy('created_at');
  }

  /**
   * Purga eventos exitosos
   */
  async cleanupSyncedEvents(syncedEventIds: string[]): Promise<number> {
    if (syncedEventIds.length === 0) return 0;
    
    const count = await this.events
      .where('event_id')
      .anyOf(syncedEventIds)
      .delete();
      
    if (count > 0) {
      logger.info('LOCAL_STORE_CLEANUP', 'Eventos sincronizados eliminados', { count });
    }
    return count;
  }

  /**
   * Actualiza el estado de Poison Pills y Errores
   */
  async applyPoisonPills(poisonPills: Array<{ event_id: string; error: string }>): Promise<void> {
    if (poisonPills.length === 0) return;

    await this.transaction('rw', this.events, async () => {
      for (const pill of poisonPills) {
        await this.events.where('event_id').equals(pill.event_id).modify({
          sync_status: 'poison_pill',
          last_error: pill.error
        });
      }
    });
  }
  
  /**
   * Descartar un Poison Pill (Acción Manual del Mesero)
   */
  async discardEvent(eventId: string): Promise<void> {
    await this.events.where('event_id').equals(eventId).delete();
  }

  /**
   * Reintentar un Poison Pill (Acción Manual del Mesero)
   */
  async retryPoisonPill(eventId: string): Promise<void> {
    await this.events.where('event_id').equals(eventId).modify({
      sync_status: 'pending',
      retry_count: 0,
      last_error: undefined
    });
  }
}

// ============ SINGLETON ============

let _instance: LocalEventStore | null = null;

export function getLocalEventStore(): LocalEventStore {
  if (typeof window === 'undefined') {
    throw new Error('LocalEventStore solo puede usarse en el cliente');
  }
  if (!_instance) {
    _instance = new LocalEventStore();
  }
  return _instance;
}
