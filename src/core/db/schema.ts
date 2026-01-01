import Dexie, { type EntityTable } from 'dexie';

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

export interface ProjectionEntity {
    key: string;
    data: any;
    last_seq: number;
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
    }
}

export const db = new ParkDB();

// Helper to clear all local data (for development/testing)
export async function clearLocalDatabase(): Promise<void> {
    await db.events.clear();
    await db.projections.clear();
    await db.sync_state.clear();
    await db.catalog_versions.clear();
    await db.catalog_items.clear();
    console.log('[DB] Local database cleared');
}
