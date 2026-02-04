/**
 * Tenant-Specific IndexedDB Database Management
 * 
 * Task 18.1 - IndexedDB Tenant Isolation
 * 
 * Manages tenant-specific database naming and initialization in IndexedDB.
 * Each tenant gets a separate database instance with a unique name derived from tenant_id.
 * 
 * This ensures:
 * - Complete data isolation between tenants on shared devices
 * - Prevents accidental cross-tenant data access
 * - Enables secure multi-tenant support on offline-first terminals
 */

import Dexie, { type EntityTable } from 'dexie';
import { logger } from '@/src/core/observability/logger';

// ============================================================================
// Types (same as in schema.ts, but tenant-scoped)
// ============================================================================

export interface EventEntity {
    id?: number;
    tenant_id: string;
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
    synced: number;
}

export interface SyncStateEntity {
    id: string;
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

export interface ProjectionEntity {
    key: string;
    data: any;
    last_seq: number;
}

export interface SnapshotEntity {
    id?: number;
    tenant_id: string;
    aggregate_type: string;
    aggregate_id: string;
    sequence: number;
    state: any;
    created_at: string;
}

// ============================================================================
// Tenant-Specific Database Class
// ============================================================================

export class TenantParkDB extends Dexie {
    events!: EntityTable<EventEntity, 'id'>;
    sync_state!: EntityTable<SyncStateEntity, 'id'>;
    catalog_versions!: EntityTable<CatalogVersionEntity, any>;
    catalog_items!: EntityTable<CatalogItemEntity, 'id'>;
    projections!: EntityTable<ProjectionEntity, 'key'>;
    snapshots!: EntityTable<SnapshotEntity, 'id'>;
    saga_logs!: EntityTable<SagaLogEntity, 'saga_id'>;
    offline_saga_events!: EntityTable<OfflineSagaEventEntity, 'event_id'>;

    constructor(dbName: string) {
        super(dbName);

        // Version 1: Initial schema for tenant-specific database
        this.version(1).stores({
            events: '++id, synced, terminal_sequence, [tenant_id+terminal_sequence], &[tenant_id+event_id], aggregate_type, aggregate_id, event_type, occurred_at',
            projections: 'key',
            sync_state: 'id',
            catalog_versions: '[tenant_id+version], active',
            catalog_items: 'id, product_id, name',
            snapshots: '++id, [aggregate_type+aggregate_id], sequence, created_at',
            saga_logs: 'saga_id, [tenant_id+status], [tenant_id+saga_name+created_at]',
            offline_saga_events: 'event_id, [tenant_id+synced], saga_id, queued_at'
        });
    }
}

// ============================================================================
// Database Name Generation
// ============================================================================

/**
 * Generates a tenant-specific database name from tenant_id
 * 
 * Format: park_pos_db_{first_12_chars_of_tenant_id}
 * 
 * Example:
 * - tenant_id: "550e8400-e29b-41d4-a716-446655440000"
 * - database name: "park_pos_db_550e8400e29b"
 * 
 * This ensures:
 * - Database names are unique per tenant (using 12 hex chars = 48 bits)
 * - Database names are deterministic (same tenant_id always produces same name)
 * - Database names are short enough for browser limits
 * - Database names include tenant identifier for debugging
 * - Collision probability is extremely low (2^-48 for random UUIDs)
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Tenant-specific database name
 * @throws Error if tenant_id is invalid
 */
export function getTenantDatabaseName(tenant_id: string): string {
    if (!tenant_id || typeof tenant_id !== 'string') {
        throw new Error('Invalid tenant_id: must be a non-empty string');
    }

    // Validate UUID format (basic check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenant_id)) {
        throw new Error(`Invalid tenant_id format: ${tenant_id}. Expected UUID format.`);
    }

    // Use first 12 characters of tenant_id (removing hyphens) for database name
    // This gives us 48 bits of uniqueness, making collisions extremely unlikely
    const hexOnly = tenant_id.replace(/-/g, '');
    const shortId = hexOnly.substring(0, 12);
    const dbName = `park_pos_db_${shortId}`;

    return dbName;
}

// ============================================================================
// Database Instance Management
// ============================================================================

// Map to store database instances per tenant
const tenantDatabases = new Map<string, TenantParkDB>();

/**
 * Gets or creates a tenant-specific database instance
 * 
 * This function:
 * 1. Validates tenant_id format
 * 2. Generates tenant-specific database name
 * 3. Creates database instance if not exists
 * 4. Caches instance for reuse
 * 5. Returns cached instance on subsequent calls
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Tenant-specific database instance
 * @throws Error if tenant_id is invalid or database initialization fails
 */
export function getTenantDatabase(tenant_id: string): TenantParkDB {
    if (typeof window === 'undefined') {
        throw new Error('Tenant database can only be accessed on the client side');
    }

    // Check if database already exists in cache
    if (tenantDatabases.has(tenant_id)) {
        return tenantDatabases.get(tenant_id)!;
    }

    try {
        // Generate tenant-specific database name
        const dbName = getTenantDatabaseName(tenant_id);

        // Create new database instance
        const db = new TenantParkDB(dbName);

        // Cache the instance
        tenantDatabases.set(tenant_id, db);

        logger.info('TENANT_DB_INITIALIZED', `Initialized database for tenant: ${tenant_id}`, {
            tenant_id,
            db_name: dbName,
        });

        return db;
    } catch (error) {
        logger.error('TENANT_DB_INIT_FAILED', `Failed to initialize database for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
        });
        throw error;
    }
}

/**
 * Closes a tenant-specific database instance
 * 
 * This function:
 * 1. Finds the database instance for the tenant
 * 2. Closes all connections
 * 3. Removes from cache
 * 4. Logs the operation
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise that resolves when database is closed
 */
export async function closeTenantDatabase(tenant_id: string): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    const db = tenantDatabases.get(tenant_id);
    if (!db) {
        return;
    }

    try {
        await db.close();
        tenantDatabases.delete(tenant_id);

        logger.info('TENANT_DB_CLOSED', `Closed database for tenant: ${tenant_id}`, {
            tenant_id,
        });
    } catch (error) {
        logger.error('TENANT_DB_CLOSE_FAILED', `Failed to close database for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
        });
        throw error;
    }
}

/**
 * Closes all tenant database instances
 * 
 * This function:
 * 1. Iterates through all cached databases
 * 2. Closes each one
 * 3. Clears the cache
 * 4. Logs the operation
 * 
 * @returns Promise that resolves when all databases are closed
 */
export async function closeAllTenantDatabases(): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    const tenantIds = Array.from(tenantDatabases.keys());

    for (const tenant_id of tenantIds) {
        await closeTenantDatabase(tenant_id);
    }

    logger.info('ALL_TENANT_DBS_CLOSED', 'Closed all tenant databases', {
        count: tenantIds.length,
    });
}

/**
 * Gets the current list of active tenant databases
 * 
 * Useful for debugging and monitoring which tenants have active database connections.
 * 
 * @returns Array of tenant_ids with active database instances
 */
export function getActiveTenantDatabases(): string[] {
    return Array.from(tenantDatabases.keys());
}

/**
 * Clears all data from a tenant's database
 * 
 * This function:
 * 1. Gets the tenant database instance
 * 2. Clears all tables
 * 3. Logs the operation
 * 
 * WARNING: This is destructive and cannot be undone. Use with caution.
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise that resolves when all data is cleared
 */
export async function clearTenantDatabase(tenant_id: string): Promise<void> {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        const db = tenantDatabases.get(tenant_id);
        if (!db) {
            return;
        }

        // Clear all tables if they exist
        if (db.events && typeof db.events.clear === 'function') {
            await db.events.clear();
        }
        if (db.projections && typeof db.projections.clear === 'function') {
            await db.projections.clear();
        }
        if (db.sync_state && typeof db.sync_state.clear === 'function') {
            await db.sync_state.clear();
        }
        if (db.catalog_versions && typeof db.catalog_versions.clear === 'function') {
            await db.catalog_versions.clear();
        }
        if (db.catalog_items && typeof db.catalog_items.clear === 'function') {
            await db.catalog_items.clear();
        }
        if (db.snapshots && typeof db.snapshots.clear === 'function') {
            await db.snapshots.clear();
        }
        if (db.saga_logs && typeof db.saga_logs.clear === 'function') {
            await db.saga_logs.clear();
        }
        if (db.offline_saga_events && typeof db.offline_saga_events.clear === 'function') {
            await db.offline_saga_events.clear();
        }

        logger.info('TENANT_DB_CLEARED', `Cleared all data for tenant: ${tenant_id}`, {
            tenant_id,
        });
    } catch (error) {
        logger.error('TENANT_DB_CLEAR_FAILED', `Failed to clear database for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
        });
        throw error;
    }
}

/**
 * Gets statistics about a tenant's database usage
 * 
 * @param tenant_id - UUID of the tenant
 * @returns Promise with database statistics
 */
export async function getTenantDatabaseStats(tenant_id: string): Promise<{
    tenant_id: string;
    db_name: string;
    events_count: number;
    projections_count: number;
    saga_logs_count: number;
    snapshots_count: number;
}> {
    if (typeof window === 'undefined') {
        throw new Error('Database stats can only be accessed on the client side');
    }

    try {
        const db = getTenantDatabase(tenant_id);
        const dbName = getTenantDatabaseName(tenant_id);

        // Get counts if tables exist
        let events_count = 0;
        let projections_count = 0;
        let saga_logs_count = 0;
        let snapshots_count = 0;

        if (db.events && typeof db.events.count === 'function') {
            events_count = await db.events.count();
        }
        if (db.projections && typeof db.projections.count === 'function') {
            projections_count = await db.projections.count();
        }
        if (db.saga_logs && typeof db.saga_logs.count === 'function') {
            saga_logs_count = await db.saga_logs.count();
        }
        if (db.snapshots && typeof db.snapshots.count === 'function') {
            snapshots_count = await db.snapshots.count();
        }

        return {
            tenant_id,
            db_name: dbName,
            events_count,
            projections_count,
            saga_logs_count,
            snapshots_count,
        };
    } catch (error) {
        logger.error('TENANT_DB_STATS_FAILED', `Failed to get stats for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
        });
        throw error;
    }
}
