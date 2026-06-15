import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/src/core/observability/logger';

// ---------------------------
// Types match EventEnvelope (aligned with Zod schema)
// ---------------------------
export interface EventEntity {
    id?: number; // auto-increment for local ordering
    tenant_id: string; // UUID
    terminal_id: string;
    terminal_sequence: number;
    event_id: string;
    event_type: string;
    schema_version: number;
    payload_version: number;
    occurred_at: string;
    aggregate_type: string;
    aggregate_id: string;
    correlation_id: string;
    causation_id?: string | null;
    actor_id?: string | null;
    actor_role_snapshot?: string | null;
    payload: any;
    synced: number; // 0 = pending, 1 = synced
}

export interface SyncStateEntity {
    id: string; // 'singleton'
    last_terminal_sequence_acked: number;
    backlog_count: number;
    last_sync_attempt_at?: string;
    last_sync_ok_at?: string;
}

export interface CatalogVersionEntity {
    tenant_id: string;
    version: number;
    checksum: string;
    active: boolean;
    created_at: string;
}

export interface CatalogItemEntity {
    id: string;
    product_id: string;
    name: string;
    price_cents: number;
    tax_rate: number;
}

export interface SagaLogEntity {
    saga_id: string;
    tenant_id: string;
    saga_name: string;
    status: string;
    context: any;
    steps: any[];
    started_at: string;
    completed_at?: string;
    error?: string;
    created_at: string;
    updated_at: string;
}

export interface OfflineSagaEventEntity {
    event_id: string;
    saga_id: string;
    tenant_id: string;
    event: any;
    queued_at: string;
    synced: boolean;
    sync_attempts: number;
    last_sync_error?: string;
}

export interface MasterTableEntity {
    id: string;
    tenant_id: string;
    number: string;
    display_name: string | null;
    zone: any; // Zone type
    is_active: boolean;
    capacity: number;
}

export interface ProjectionEntity {
    key: string;
    data: any;
    last_seq: number;
}

// Snapshot entity for fast projection rebuilds
export interface SnapshotEntity {
    id?: number;              // auto-increment
    aggregate_type: string;   // 'ORDER', 'SHIFT', 'GLOBAL'
    aggregate_id: string;     // order_id, shift_id, or 'global'
    sequence: number;         // Last event sequence included
    state: any;               // Serialized projection state
    created_at: string;       // ISO timestamp
}

// ---------------------------
// DB Class
// ---------------------------
const DB_NAME = 'ParkDB';

export class ParkDB extends Dexie {
    events!: EntityTable<EventEntity, 'id'>;
    sync_state!: EntityTable<SyncStateEntity, 'id'>;
    catalog_versions!: EntityTable<CatalogVersionEntity, any>;
    catalog_items!: EntityTable<CatalogItemEntity, 'id'>;
    projections!: EntityTable<ProjectionEntity, 'key'>;
    snapshots!: EntityTable<SnapshotEntity, 'id'>;
    saga_logs!: EntityTable<SagaLogEntity, 'saga_id'>;
    offline_saga_events!: EntityTable<OfflineSagaEventEntity, 'event_id'>;
    master_tables!: EntityTable<MasterTableEntity, 'id'>;

    constructor() {
        super(DB_NAME);

        // Version 1: Original schema (deprecated)
        this.version(1).stores({
            events: '++id, synced, terminal_sequence, [store_id+terminal_sequence], &[store_id+event_id]',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[store_id+version], active',
            catalog_items: 'id, product_id, name'
        });

        // Version 2: Updated to use tenant_id
        this.version(2).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id]',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name'
        }).upgrade(tx => {
            // Migrate store_id to tenant_id for existing events
            return tx.table('events').toCollection().modify(event => {
                if ((event as any).store_id && !event.tenant_id) {
                    event.tenant_id = (event as any).store_id;
                    delete (event as any).store_id;
                }
            });
        });

        // Version 3: Performance Hardening (Indexes for KDS/Queries)
        this.version(3).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name'
        });

        // Version 4: Added aggregate_id index for order lookups
        this.version(4).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name'
        });

        // Version 5: Added snapshots table for fast projection rebuilds
        this.version(5).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name',
            snapshots: '++id, [aggregate_type+aggregate_id], sequence, created_at'
        });

        // Version 6: Added saga_logs table for saga pattern persistence
        this.version(6).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name',
            snapshots: '++id, [aggregate_type+aggregate_id], sequence, created_at',
            saga_logs: 'saga_id, [tenant_id+status], [tenant_id+saga_name+created_at]'
        });

        // Version 7: Added offline_saga_events table for offline saga support
        this.version(7).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name',
            snapshots: '++id, [aggregate_type+aggregate_id], sequence, created_at',
            saga_logs: 'saga_id, [tenant_id+status], [tenant_id+saga_name+created_at]',
            offline_saga_events: 'event_id, [tenant_id+synced], saga_id, queued_at'
        });

        // Version 8: Added master_tables for offline table fallback
        this.version(8).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name',
            snapshots: '++id, [aggregate_type+aggregate_id], sequence, created_at',
            saga_logs: 'saga_id, [tenant_id+status], [tenant_id+saga_name+created_at]',
            offline_saga_events: 'event_id, [tenant_id+synced], saga_id, queued_at',
            master_tables: 'id, tenant_id, number'
        });
    }
}

// Lazy singleton to avoid SSR issues
let _db: ParkDB | null = null;

function getDbInstance(): ParkDB {
    if (typeof window === 'undefined') {
        throw new Error('Dexie can only be used on the client side');
    }
    if (!_db) {
        _db = new ParkDB();
    }
    return _db;
}

// Export a proxy that lazily initializes on first access
export const db = new Proxy({} as ParkDB, {
    get(_, prop) {
        const instance = getDbInstance();
        const value = (instance as any)[prop];
        if (typeof value === 'function') {
            return value.bind(instance);
        }
        return value;
    }
});

// SSR-safe getter - returns null on server
export function getDb(): ParkDB | null {
    if (typeof window === 'undefined') return null;
    return getDbInstance();
}

// Helper to clear all local data (for development/testing)
export async function clearLocalDatabase(): Promise<void> {
    if (typeof window === 'undefined') return;
    const instance = getDbInstance();
    await instance.events.clear();
    await instance.projections.clear();
    await instance.sync_state.clear();
    await instance.catalog_versions.clear();
    await instance.catalog_items.clear();
    logger.info('DB_CLEARED', 'Local database cleared');
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Helper to clean events with invalid actor_id (not a valid UUID)
export async function cleanInvalidActorIdEvents(): Promise<number> {
    if (typeof window === 'undefined') return 0;
    const instance = getDbInstance();
    
    // Get all unsynced events
    const unsyncedEvents = await instance.events.where('synced').equals(0).toArray();
    
    // Find events with invalid actor_id
    const invalidEvents = unsyncedEvents.filter(ev => {
        if (!ev.actor_id) return false; // null/undefined is OK
        return !UUID_REGEX.test(ev.actor_id);
    });
    
    if (invalidEvents.length === 0) return 0;
    
    // Delete invalid events
    const idsToDelete = invalidEvents.map(ev => ev.id!).filter(Boolean);
    await instance.events.bulkDelete(idsToDelete);
    
    logger.info('DB_CLEANED_INVALID_EVENTS', 'Cleaned events with invalid actor_id', { count: invalidEvents.length });
    return invalidEvents.length;
}
