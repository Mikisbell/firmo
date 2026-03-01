/**
 * Tenant Validation Middleware for IndexedDB
 * 
 * Task 18.3 - IndexedDB Tenant Isolation
 * 
 * Provides middleware functions to validate tenant_id on all IndexedDB operations,
 * preventing cross-tenant data access and ensuring data isolation on shared devices.
 * 
 * This middleware:
 * - Validates tenant_id on all read/write operations
 * - Prevents cross-tenant data access
 * - Enforces tenant context throughout the operation lifecycle
 * - Logs validation failures for security auditing
 * - Provides type-safe wrappers for common operations
 */

import { logger } from '@/src/core/observability/logger';
import { getTenantDatabase, TenantParkDB } from './tenant-database';
import type { EventEntity, SagaLogEntity, OfflineSagaEventEntity, ProjectionEntity, SnapshotEntity } from './tenant-database';

// ============================================================================
// Types
// ============================================================================

export interface TenantValidationContext {
    tenant_id: string;
    operation: string;
    timestamp: number;
}

export class TenantValidationError extends Error {
    constructor(
        message: string,
        public readonly tenant_id: string,
        public readonly operation: string,
        public readonly context?: Record<string, any>
    ) {
        super(message);
        this.name = 'TenantValidationError';
    }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that a tenant_id is valid and matches expected format
 * 
 * @param tenant_id - Tenant ID to validate
 * @throws TenantValidationError if tenant_id is invalid
 */
export function validateTenantId(tenant_id: string): void {
    if (!tenant_id || typeof tenant_id !== 'string') {
        throw new TenantValidationError(
            'Invalid tenant_id: must be a non-empty string',
            tenant_id || 'unknown',
            'validate_tenant_id'
        );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenant_id)) {
        throw new TenantValidationError(
            `Invalid tenant_id format: ${tenant_id}. Expected UUID format.`,
            tenant_id,
            'validate_tenant_id'
        );
    }
}

/**
 * Validates that an entity belongs to the specified tenant
 * 
 * @param entity - Entity to validate
 * @param tenant_id - Expected tenant_id
 * @param operation - Operation being performed
 * @throws TenantValidationError if entity's tenant_id doesn't match
 */
export function validateEntityTenant(
    entity: any,
    tenant_id: string,
    operation: string
): void {
    if (!entity) {
        throw new TenantValidationError(
            'Entity is null or undefined',
            tenant_id,
            operation
        );
    }

    if (entity.tenant_id !== tenant_id) {
        throw new TenantValidationError(
            `Cross-tenant access attempt: entity belongs to tenant ${entity.tenant_id}, but operation is for tenant ${tenant_id}`,
            tenant_id,
            operation,
            {
                entity_tenant_id: entity.tenant_id,
                requested_tenant_id: tenant_id,
            }
        );
    }
}

/**
 * Validates that all entities in an array belong to the specified tenant
 * 
 * @param entities - Array of entities to validate
 * @param tenant_id - Expected tenant_id
 * @param operation - Operation being performed
 * @throws TenantValidationError if any entity's tenant_id doesn't match
 */
export function validateEntitiesTenant(
    entities: any[],
    tenant_id: string,
    operation: string
): void {
    if (!Array.isArray(entities)) {
        throw new TenantValidationError(
            'Entities must be an array',
            tenant_id,
            operation
        );
    }

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        if (entity.tenant_id !== tenant_id) {
            throw new TenantValidationError(
                `Cross-tenant access attempt at index ${i}: entity belongs to tenant ${entity.tenant_id}, but operation is for tenant ${tenant_id}`,
                tenant_id,
                operation,
                {
                    index: i,
                    entity_tenant_id: entity.tenant_id,
                    requested_tenant_id: tenant_id,
                }
            );
        }
    }
}

// ============================================================================
// Middleware Wrappers for Common Operations
// ============================================================================

/**
 * Wraps a read operation with tenant validation
 * 
 * Ensures that:
 * 1. tenant_id is valid
 * 2. Database instance exists for tenant
 * 3. Operation completes successfully
 * 4. Results are validated before returning
 * 
 * @param tenant_id - Tenant ID for the operation
 * @param operation - Operation name for logging
 * @param handler - Function that performs the read operation
 * @returns Promise with operation result
 * @throws TenantValidationError if validation fails
 */
export async function withTenantReadValidation<T extends { tenant_id?: string }>(
    tenant_id: string,
    operation: string,
    handler: (db: TenantParkDB) => Promise<T | T[] | null>
): Promise<T | T[] | null> {
    const startTime = Date.now();

    try {
        // Validate tenant_id
        validateTenantId(tenant_id);

        // Get tenant database
        const db = getTenantDatabase(tenant_id);

        // Execute operation
        const result = await handler(db);

        // Validate result if it's a single entity
        if (result && !Array.isArray(result) && result.tenant_id) {
            validateEntityTenant(result, tenant_id, operation);
        }

        // Validate results if it's an array
        if (Array.isArray(result) && result.length > 0 && result[0].tenant_id) {
            validateEntitiesTenant(result, tenant_id, operation);
        }

        const duration = Date.now() - startTime;
        logger.debug('TENANT_READ_VALIDATED', `Read operation completed for tenant: ${tenant_id}`, {
            tenant_id,
            operation,
            duration_ms: duration,
            result_count: Array.isArray(result) ? result.length : result ? 1 : 0,
        });

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TenantValidationError) {
            logger.warn('TENANT_VALIDATION_FAILED', `Tenant validation failed for operation: ${operation}`, {
                tenant_id,
                operation,
                error_message: error.message,
                duration_ms: duration,
                context: error.context,
            });
            throw error;
        }

        logger.error('TENANT_READ_FAILED', `Read operation failed for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
            operation,
            duration_ms: duration,
        });
        throw error;
    }
}

/**
 * Wraps a write operation with tenant validation
 * 
 * Ensures that:
 * 1. tenant_id is valid
 * 2. Database instance exists for tenant
 * 3. Entity/entities belong to the tenant
 * 4. Operation completes successfully
 * 
 * @param tenant_id - Tenant ID for the operation
 * @param operation - Operation name for logging
 * @param entity - Entity or entities being written
 * @param handler - Function that performs the write operation
 * @returns Promise with operation result
 * @throws TenantValidationError if validation fails
 */
export async function withTenantWriteValidation<T>(
    tenant_id: string,
    operation: string,
    entity: any | any[],
    handler: (db: TenantParkDB) => Promise<T>
): Promise<T> {
    const startTime = Date.now();

    try {
        // Validate tenant_id
        validateTenantId(tenant_id);

        // Validate entity/entities belong to tenant
        if (Array.isArray(entity)) {
            validateEntitiesTenant(entity, tenant_id, operation);
        } else {
            validateEntityTenant(entity, tenant_id, operation);
        }

        // Get tenant database
        const db = getTenantDatabase(tenant_id);

        // Execute operation
        const result = await handler(db);

        const duration = Date.now() - startTime;
        logger.debug('TENANT_WRITE_VALIDATED', `Write operation completed for tenant: ${tenant_id}`, {
            tenant_id,
            operation,
            duration_ms: duration,
            entity_count: Array.isArray(entity) ? entity.length : 1,
        });

        return result;
    } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof TenantValidationError) {
            logger.warn('TENANT_VALIDATION_FAILED', `Tenant validation failed for operation: ${operation}`, {
                tenant_id,
                operation,
                error_message: error.message,
                duration_ms: duration,
                context: error.context,
            });
            throw error;
        }

        logger.error('TENANT_WRITE_FAILED', `Write operation failed for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
            operation,
            duration_ms: duration,
        });
        throw error;
    }
}

// ============================================================================
// Type-Safe Operation Wrappers
// ============================================================================

/**
 * Adds an event to the tenant's database with validation
 * 
 * @param tenant_id - Tenant ID
 * @param event - Event to add
 * @returns Promise with the added event
 * @throws TenantValidationError if tenant_id doesn't match
 */
export async function addTenantEvent(
    tenant_id: string,
    event: Omit<EventEntity, 'id'>
): Promise<EventEntity> {
    return withTenantWriteValidation(
        tenant_id,
        'add_event',
        event,
        async (db) => {
            const id = await db.events.add(event as EventEntity);
            return { ...event, id } as EventEntity;
        }
    );
}

/**
 * Retrieves events for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param filter - Optional filter function
 * @returns Promise with array of events
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function getTenantEvents(
    tenant_id: string,
    filter?: (event: EventEntity) => boolean
): Promise<EventEntity[]> {
    return withTenantReadValidation(
        tenant_id,
        'get_events',
        async (db) => {
            const events = await db.events.toArray();
            return filter ? events.filter(filter) : events;
        }
    ) as Promise<EventEntity[]>;
}

/**
 * Updates a saga log for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param sagaLog - Saga log to update
 * @returns Promise that resolves when update completes
 * @throws TenantValidationError if tenant_id doesn't match
 */
export async function updateTenantSagaLog(
    tenant_id: string,
    sagaLog: SagaLogEntity
): Promise<void> {
    return withTenantWriteValidation(
        tenant_id,
        'update_saga_log',
        sagaLog,
        async (db) => {
            await db.saga_logs.put(sagaLog);
        }
    );
}

/**
 * Retrieves saga logs for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param filter - Optional filter function
 * @returns Promise with array of saga logs
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function getTenantSagaLogs(
    tenant_id: string,
    filter?: (log: SagaLogEntity) => boolean
): Promise<SagaLogEntity[]> {
    return withTenantReadValidation(
        tenant_id,
        'get_saga_logs',
        async (db) => {
            const logs = await db.saga_logs.toArray();
            return filter ? logs.filter(filter) : logs;
        }
    ) as Promise<SagaLogEntity[]>;
}

/**
 * Adds an offline saga event for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param event - Offline saga event to add
 * @returns Promise with the added event
 * @throws TenantValidationError if tenant_id doesn't match
 */
export async function addTenantOfflineSagaEvent(
    tenant_id: string,
    event: OfflineSagaEventEntity
): Promise<void> {
    return withTenantWriteValidation(
        tenant_id,
        'add_offline_saga_event',
        event,
        async (db) => {
            await db.offline_saga_events.add(event);
        }
    );
}

/**
 * Retrieves offline saga events for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param filter - Optional filter function
 * @returns Promise with array of offline saga events
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function getTenantOfflineSagaEvents(
    tenant_id: string,
    filter?: (event: OfflineSagaEventEntity) => boolean
): Promise<OfflineSagaEventEntity[]> {
    return withTenantReadValidation(
        tenant_id,
        'get_offline_saga_events',
        async (db) => {
            const events = await db.offline_saga_events.toArray();
            return filter ? events.filter(filter) : events;
        }
    ) as Promise<OfflineSagaEventEntity[]>;
}

/**
 * Updates a projection for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param key - Projection key
 * @param data - Projection data
 * @param lastSeq - Last sequence number
 * @returns Promise that resolves when update completes
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function updateTenantProjection(
    tenant_id: string,
    key: string,
    data: any,
    lastSeq: number
): Promise<void> {
    // Validate tenant_id first
    validateTenantId(tenant_id);

    try {
        const db = getTenantDatabase(tenant_id);
        await db.projections.put({ key, data, last_seq: lastSeq });

        logger.debug('TENANT_WRITE_VALIDATED', `Write operation completed for tenant: ${tenant_id}`, {
            tenant_id,
            operation: 'update_projection',
            duration_ms: 0,
            entity_count: 1,
        });
    } catch (error) {
        logger.error('TENANT_WRITE_FAILED', `Write operation failed for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
            operation: 'update_projection',
        });
        throw error;
    }
}

/**
 * Retrieves a projection for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param key - Projection key
 * @returns Promise with projection data or null
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function getTenantProjection(
    tenant_id: string,
    key: string
): Promise<ProjectionEntity | null> {
    // Validate tenant_id first
    validateTenantId(tenant_id);

    try {
        const db = getTenantDatabase(tenant_id);
        const projection = await db.projections.get(key);

        logger.debug('TENANT_READ_VALIDATED', `Read operation completed for tenant: ${tenant_id}`, {
            tenant_id,
            operation: 'get_projection',
            result_count: projection ? 1 : 0,
        });

        return projection || null;
    } catch (error) {
        logger.error('TENANT_READ_FAILED', `Read operation failed for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
            operation: 'get_projection',
        });
        throw error;
    }
}

/**
 * Adds a snapshot for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param snapshot - Snapshot to add
 * @returns Promise with the added snapshot
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function addTenantSnapshot(
    tenant_id: string,
    snapshot: Omit<SnapshotEntity, 'id'>
): Promise<SnapshotEntity> {
    return withTenantWriteValidation(
        tenant_id,
        'add_snapshot',
        snapshot,
        async (db) => {
            const id = await db.snapshots.add(snapshot as SnapshotEntity);
            return { ...snapshot, id } as SnapshotEntity;
        }
    );
}

/**
 * Retrieves snapshots for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param aggregateType - Optional aggregate type filter
 * @returns Promise with array of snapshots
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function getTenantSnapshots(
    tenant_id: string,
    aggregateType?: string
): Promise<SnapshotEntity[]> {
    return withTenantReadValidation(
        tenant_id,
        'get_snapshots',
        async (db) => {
            const snapshots = await db.snapshots.toArray();
            return aggregateType
                ? snapshots.filter(s => s.aggregate_type === aggregateType)
                : snapshots;
        }
    ) as Promise<SnapshotEntity[]>;
}

// ============================================================================
// Batch Operations with Validation
// ============================================================================

/**
 * Adds multiple events for a tenant with validation
 * 
 * All events must belong to the same tenant. If any event fails validation,
 * the entire operation is rejected.
 * 
 * @param tenant_id - Tenant ID
 * @param events - Array of events to add
 * @returns Promise with array of added events
 * @throws TenantValidationError if any event's tenant_id doesn't match
 */
export async function addTenantEventsBatch(
    tenant_id: string,
    events: Omit<EventEntity, 'id'>[]
): Promise<EventEntity[]> {
    return withTenantWriteValidation(
        tenant_id,
        'add_events_batch',
        events,
        async (db) => {
            await db.events.bulkAdd(events as EventEntity[]);
            return events.map(event => ({ ...event } as EventEntity));
        }
    );
}

/**
 * Deletes offline saga events for a tenant with validation
 * 
 * @param tenant_id - Tenant ID
 * @param eventIds - Array of event IDs to delete
 * @returns Promise that resolves when deletion completes
 * @throws TenantValidationError if tenant_id is invalid
 */
export async function deleteTenantOfflineSagaEvents(
    tenant_id: string,
    eventIds: string[]
): Promise<void> {
    // Validate tenant_id first
    validateTenantId(tenant_id);

    try {
        const db = getTenantDatabase(tenant_id);

        // First verify all events belong to tenant
        const events = await db.offline_saga_events
            .where('event_id')
            .anyOf(eventIds)
            .toArray();

        for (const event of events) {
            if (event.tenant_id !== tenant_id) {
                throw new TenantValidationError(
                    `Cross-tenant access attempt: event belongs to tenant ${event.tenant_id}`,
                    tenant_id,
                    'delete_offline_saga_events',
                    { event_id: event.event_id }
                );
            }
        }

        // Delete events
        await db.offline_saga_events.bulkDelete(eventIds);

        logger.debug('TENANT_DELETE_VALIDATED', `Delete operation completed for tenant: ${tenant_id}`, {
            tenant_id,
            operation: 'delete_offline_saga_events',
            count: eventIds.length,
        });
    } catch (error) {
        if (error instanceof TenantValidationError) {
            logger.warn('TENANT_VALIDATION_FAILED', `Tenant validation failed for operation: delete_offline_saga_events`, {
                tenant_id,
                operation: 'delete_offline_saga_events',
                error_message: error.message,
                context: error.context,
            });
            throw error;
        }

        logger.error('TENANT_DELETE_FAILED', `Delete operation failed for tenant: ${tenant_id}`, error instanceof Error ? error : undefined, {
            tenant_id,
            operation: 'delete_offline_saga_events',
        });
        throw error;
    }
}
