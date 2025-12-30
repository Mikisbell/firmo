import Dexie, { type EntityTable } from 'dexie';

// ---------------------------
// Types match EventEnvelope mostly, but flat for indexeddb if needed
// ---------------------------
export interface EventEntity {
    id?: number; // auto-increment for local ordering if needed, but we rely on terminal_sequence
    store_id: string;
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
    store_id: string;
    version: number;
    checksum: string;
    active: boolean; // boolean, indexed as 0/1 usually
    created_at: string;
}

export interface CatalogItemEntity {
    id: string; // uuid
    product_id: string; // from cloud
    name: string;
    price_cents: number;
    tax_rate: number; // e.g. 0.19
    // ... minimal fields for POS
}

// ---------------------------
// DB Class
// ---------------------------
const DB_NAME = 'ParkDB';

export class ParkDB extends Dexie {
    events!: EntityTable<EventEntity, 'id'>;
    sync_state!: EntityTable<SyncStateEntity, 'id'>;
    catalog_versions!: EntityTable<CatalogVersionEntity, '[store_id+version]'>;
    catalog_items!: EntityTable<CatalogItemEntity, 'id'>;

    constructor() {
        super(DB_NAME);
        this.version(1).stores({
            // Primary key: id (auto-increment)
            // Indexes: 
            //  synced: needed for "where('synced').equals(0)"
            //  terminal_sequence: needed for ordering
            //  [store_id+terminal_sequence]: needed for range queries in sync client ACK
            //  [store_id+event_id]: unique constraint check (manual or via hook)
            events: '++id, synced, terminal_sequence, [store_id+terminal_sequence], &[store_id+event_id]',
            projections: 'key', // 'singleton_sale', 'singleton_shift'

            sync_state: 'id', // 'singleton'

            catalog_versions: '[store_id+version], active',

            catalog_items: 'id, product_id, name'
        });
    }
}

export const db = new ParkDB();
