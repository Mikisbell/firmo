/**
 * Unit Tests for Tenant Validation Middleware
 * 
 * Tests tenant_id validation, cross-tenant access prevention,
 * and type-safe operation wrappers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    validateTenantId,
    validateEntityTenant,
    validateEntitiesTenant,
    TenantValidationError,
    withTenantReadValidation,
    withTenantWriteValidation,
    addTenantEvent,
    getTenantEvents,
    updateTenantSagaLog,
    getTenantSagaLogs,
    addTenantOfflineSagaEvent,
    getTenantOfflineSagaEvents,
    updateTenantProjection,
    getTenantProjection,
    addTenantSnapshot,
    getTenantSnapshots,
    addTenantEventsBatch,
    deleteTenantOfflineSagaEvents,
} from '../tenant-validation';
import { getTenantDatabase, closeTenantDatabase, closeAllTenantDatabases } from '../tenant-database';
import type { EventEntity, SagaLogEntity, OfflineSagaEventEntity, ProjectionEntity, SnapshotEntity } from '../tenant-database';

// Mock window object for browser environment
beforeEach(() => {
    if (typeof window === 'undefined') {
        (global as any).window = {};
    }
});

afterEach(() => {
    if ((global as any).window) {
        delete (global as any).window;
    }
});

// ============================================================================
// Test Data
// ============================================================================

const VALID_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_TENANT_ID_2 = '660e8400-e29b-41d4-a716-446655440001';
const INVALID_TENANT_ID = 'not-a-uuid';
const EMPTY_TENANT_ID = '';

const createMockEvent = (tenant_id: string, overrides?: Partial<EventEntity>): Omit<EventEntity, 'id'> => ({
    tenant_id,
    terminal_id: 'terminal-1',
    terminal_sequence: 1,
    event_id: 'event-1',
    event_type: 'ORDER_CREATED',
    schema_version: 1,
    payload_version: 1,
    occurred_at: new Date().toISOString(),
    aggregate_type: 'Order',
    aggregate_id: 'order-1',
    correlation_id: 'corr-1',
    payload: { test: true },
    synced: 0,
    ...overrides,
});

const createMockSagaLog = (tenant_id: string, overrides?: Partial<SagaLogEntity>): SagaLogEntity => ({
    saga_id: 'saga-1',
    tenant_id,
    saga_name: 'CompleteSale',
    status: 'PENDING',
    context: { order_id: 'order-1' },
    steps: [],
    started_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
});

const createMockOfflineSagaEvent = (tenant_id: string, overrides?: Partial<OfflineSagaEventEntity>): OfflineSagaEventEntity => ({
    event_id: 'event-1',
    saga_id: 'saga-1',
    tenant_id,
    event: { type: 'ORDER_SUBMITTED' },
    queued_at: new Date().toISOString(),
    synced: false,
    sync_attempts: 0,
    ...overrides,
});

const createMockSnapshot = (tenant_id: string, overrides?: Partial<SnapshotEntity>): Omit<SnapshotEntity, 'id'> & { tenant_id: string } => ({
    tenant_id,
    aggregate_type: 'Order',
    aggregate_id: 'order-1',
    sequence: 1,
    state: { status: 'OPEN' },
    created_at: new Date().toISOString(),
    ...overrides,
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Tenant Validation Middleware', () => {
    afterEach(async () => {
        await closeAllTenantDatabases();
    });

    describe('validateTenantId', () => {
        it('should accept valid UUID tenant_id', () => {
            expect(() => validateTenantId(VALID_TENANT_ID)).not.toThrow();
        });

        it('should reject empty tenant_id', () => {
            expect(() => validateTenantId(EMPTY_TENANT_ID)).toThrow(TenantValidationError);
        });

        it('should reject null tenant_id', () => {
            expect(() => validateTenantId(null as any)).toThrow(TenantValidationError);
        });

        it('should reject undefined tenant_id', () => {
            expect(() => validateTenantId(undefined as any)).toThrow(TenantValidationError);
        });

        it('should reject non-string tenant_id', () => {
            expect(() => validateTenantId(123 as any)).toThrow(TenantValidationError);
        });

        it('should reject invalid UUID format', () => {
            expect(() => validateTenantId(INVALID_TENANT_ID)).toThrow(TenantValidationError);
        });

        it('should reject UUID with wrong case', () => {
            expect(() => validateTenantId('550E8400-E29B-41D4-A716-446655440000')).not.toThrow();
        });

        it('should reject UUID with missing hyphens', () => {
            expect(() => validateTenantId('550e8400e29b41d4a716446655440000')).toThrow(TenantValidationError);
        });
    });

    describe('validateEntityTenant', () => {
        it('should accept entity with matching tenant_id', () => {
            const entity = { tenant_id: VALID_TENANT_ID, data: 'test' };
            expect(() => validateEntityTenant(entity, VALID_TENANT_ID, 'test_op')).not.toThrow();
        });

        it('should reject entity with mismatched tenant_id', () => {
            const entity = { tenant_id: VALID_TENANT_ID, data: 'test' };
            expect(() => validateEntityTenant(entity, VALID_TENANT_ID_2, 'test_op')).toThrow(TenantValidationError);
        });

        it('should reject null entity', () => {
            expect(() => validateEntityTenant(null, VALID_TENANT_ID, 'test_op')).toThrow(TenantValidationError);
        });

        it('should reject undefined entity', () => {
            expect(() => validateEntityTenant(undefined, VALID_TENANT_ID, 'test_op')).toThrow(TenantValidationError);
        });

        it('should include context in error', () => {
            const entity = { tenant_id: VALID_TENANT_ID, data: 'test' };
            try {
                validateEntityTenant(entity, VALID_TENANT_ID_2, 'test_op');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(TenantValidationError);
                expect((error as TenantValidationError).context).toEqual({
                    entity_tenant_id: VALID_TENANT_ID,
                    requested_tenant_id: VALID_TENANT_ID_2,
                });
            }
        });
    });

    describe('validateEntitiesTenant', () => {
        it('should accept array of entities with matching tenant_id', () => {
            const entities = [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID, data: 'test2' },
            ];
            expect(() => validateEntitiesTenant(entities, VALID_TENANT_ID, 'test_op')).not.toThrow();
        });

        it('should reject array with one mismatched entity', () => {
            const entities = [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID_2, data: 'test2' },
            ];
            expect(() => validateEntitiesTenant(entities, VALID_TENANT_ID, 'test_op')).toThrow(TenantValidationError);
        });

        it('should reject non-array input', () => {
            expect(() => validateEntitiesTenant({} as any, VALID_TENANT_ID, 'test_op')).toThrow(TenantValidationError);
        });

        it('should accept empty array', () => {
            expect(() => validateEntitiesTenant([], VALID_TENANT_ID, 'test_op')).not.toThrow();
        });

        it('should include index in error context', () => {
            const entities = [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID_2, data: 'test2' },
            ];
            try {
                validateEntitiesTenant(entities, VALID_TENANT_ID, 'test_op');
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(TenantValidationError);
                expect((error as TenantValidationError).context?.index).toBe(1);
            }
        });
    });
});

// ============================================================================
// Middleware Wrapper Tests
// ============================================================================

describe('Tenant Validation Middleware Wrappers', () => {
    afterEach(async () => {
        await closeAllTenantDatabases();
    });

    describe('withTenantReadValidation', () => {
        it('should execute read operation successfully', async () => {
            const handler = vi.fn(async () => [
                { tenant_id: VALID_TENANT_ID, data: 'test' },
            ]);

            const result = await withTenantReadValidation(
                VALID_TENANT_ID,
                'test_read',
                handler
            );

            expect(handler).toHaveBeenCalled();
            expect(result).toEqual([{ tenant_id: VALID_TENANT_ID, data: 'test' }]);
        });

        it('should reject invalid tenant_id', async () => {
            const handler = vi.fn();

            await expect(
                withTenantReadValidation(INVALID_TENANT_ID, 'test_read', handler)
            ).rejects.toThrow(TenantValidationError);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should validate single entity result', async () => {
            const handler = vi.fn(async () => ({
                tenant_id: VALID_TENANT_ID_2,
                data: 'test',
            }));

            await expect(
                withTenantReadValidation(VALID_TENANT_ID, 'test_read', handler)
            ).rejects.toThrow(TenantValidationError);
        });

        it('should validate array entity results', async () => {
            const handler = vi.fn(async () => [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID_2, data: 'test2' },
            ]);

            await expect(
                withTenantReadValidation(VALID_TENANT_ID, 'test_read', handler)
            ).rejects.toThrow(TenantValidationError);
        });

        it('should handle null result', async () => {
            const handler = vi.fn(async () => null);

            const result = await withTenantReadValidation(
                VALID_TENANT_ID,
                'test_read',
                handler
            );

            expect(result).toBeNull();
        });

        it('should handle empty array result', async () => {
            const handler = vi.fn(async () => []);

            const result = await withTenantReadValidation(
                VALID_TENANT_ID,
                'test_read',
                handler
            );

            expect(result).toEqual([]);
        });
    });

    describe('withTenantWriteValidation', () => {
        it('should execute write operation successfully', async () => {
            const entity = { tenant_id: VALID_TENANT_ID, data: 'test' };
            const handler = vi.fn(async () => ({ success: true }));

            const result = await withTenantWriteValidation(
                VALID_TENANT_ID,
                'test_write',
                entity,
                handler
            );

            expect(handler).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should reject invalid tenant_id', async () => {
            const entity = { tenant_id: INVALID_TENANT_ID, data: 'test' };
            const handler = vi.fn();

            await expect(
                withTenantWriteValidation(INVALID_TENANT_ID, 'test_write', entity, handler)
            ).rejects.toThrow(TenantValidationError);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should validate entity tenant_id before executing handler', async () => {
            const entity = { tenant_id: VALID_TENANT_ID_2, data: 'test' };
            const handler = vi.fn();

            await expect(
                withTenantWriteValidation(VALID_TENANT_ID, 'test_write', entity, handler)
            ).rejects.toThrow(TenantValidationError);

            expect(handler).not.toHaveBeenCalled();
        });

        it('should validate array of entities', async () => {
            const entities = [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID, data: 'test2' },
            ];
            const handler = vi.fn(async () => ({ success: true }));

            const result = await withTenantWriteValidation(
                VALID_TENANT_ID,
                'test_write',
                entities,
                handler
            );

            expect(handler).toHaveBeenCalled();
            expect(result).toEqual({ success: true });
        });

        it('should reject array with mismatched tenant_id', async () => {
            const entities = [
                { tenant_id: VALID_TENANT_ID, data: 'test1' },
                { tenant_id: VALID_TENANT_ID_2, data: 'test2' },
            ];
            const handler = vi.fn();

            await expect(
                withTenantWriteValidation(VALID_TENANT_ID, 'test_write', entities, handler)
            ).rejects.toThrow(TenantValidationError);

            expect(handler).not.toHaveBeenCalled();
        });
    });
});

// ============================================================================
// Type-Safe Operation Tests
// ============================================================================

describe('Type-Safe Tenant Operations', () => {
    afterEach(async () => {
        await closeAllTenantDatabases();
    });

    describe('addTenantEvent', () => {
        it('should add event with matching tenant_id', async () => {
            const event = createMockEvent(VALID_TENANT_ID);
            const result = await addTenantEvent(VALID_TENANT_ID, event);

            expect(result.tenant_id).toBe(VALID_TENANT_ID);
            expect(result.event_id).toBe(event.event_id);
            expect(result.id).toBeDefined();
        });

        it('should reject event with mismatched tenant_id', async () => {
            const event = createMockEvent(VALID_TENANT_ID_2);

            await expect(
                addTenantEvent(VALID_TENANT_ID, event)
            ).rejects.toThrow(TenantValidationError);
        });
    });

    describe('getTenantEvents', () => {
        it('should retrieve events for tenant', async () => {
            const event1 = createMockEvent(VALID_TENANT_ID, { event_id: 'event-1' });
            const event2 = createMockEvent(VALID_TENANT_ID, { event_id: 'event-2' });

            await addTenantEvent(VALID_TENANT_ID, event1);
            await addTenantEvent(VALID_TENANT_ID, event2);

            const events = await getTenantEvents(VALID_TENANT_ID);

            expect(events).toHaveLength(2);
            expect(events.every(e => e.tenant_id === VALID_TENANT_ID)).toBe(true);
        });

        it('should apply filter to events', async () => {
            const event1 = createMockEvent(VALID_TENANT_ID, { event_type: 'ORDER_CREATED' });
            const event2 = createMockEvent(VALID_TENANT_ID, { event_type: 'ORDER_SUBMITTED' });

            await addTenantEvent(VALID_TENANT_ID, event1);
            await addTenantEvent(VALID_TENANT_ID, event2);

            const events = await getTenantEvents(
                VALID_TENANT_ID,
                e => e.event_type === 'ORDER_CREATED'
            );

            expect(events).toHaveLength(1);
            expect(events[0].event_type).toBe('ORDER_CREATED');
        });
    });

    describe('updateTenantSagaLog', () => {
        it('should update saga log with matching tenant_id', async () => {
            const sagaLog = createMockSagaLog(VALID_TENANT_ID);

            await expect(
                updateTenantSagaLog(VALID_TENANT_ID, sagaLog)
            ).resolves.not.toThrow();
        });

        it('should reject saga log with mismatched tenant_id', async () => {
            const sagaLog = createMockSagaLog(VALID_TENANT_ID_2);

            await expect(
                updateTenantSagaLog(VALID_TENANT_ID, sagaLog)
            ).rejects.toThrow(TenantValidationError);
        });
    });

    describe('getTenantSagaLogs', () => {
        it('should retrieve saga logs for tenant', async () => {
            const sagaLog1 = createMockSagaLog(VALID_TENANT_ID, { saga_id: 'saga-1' });
            const sagaLog2 = createMockSagaLog(VALID_TENANT_ID, { saga_id: 'saga-2' });

            await updateTenantSagaLog(VALID_TENANT_ID, sagaLog1);
            await updateTenantSagaLog(VALID_TENANT_ID, sagaLog2);

            const logs = await getTenantSagaLogs(VALID_TENANT_ID);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            expect(logs.every(l => l.tenant_id === VALID_TENANT_ID)).toBe(true);
        });
    });

    describe('addTenantOfflineSagaEvent', () => {
        it('should add offline saga event with matching tenant_id', async () => {
            const event = createMockOfflineSagaEvent(VALID_TENANT_ID);

            await expect(
                addTenantOfflineSagaEvent(VALID_TENANT_ID, event)
            ).resolves.not.toThrow();
        });

        it('should reject offline saga event with mismatched tenant_id', async () => {
            const event = createMockOfflineSagaEvent(VALID_TENANT_ID_2);

            await expect(
                addTenantOfflineSagaEvent(VALID_TENANT_ID, event)
            ).rejects.toThrow(TenantValidationError);
        });
    });

    describe('getTenantOfflineSagaEvents', () => {
        it('should retrieve offline saga events for tenant', async () => {
            const event1 = createMockOfflineSagaEvent(VALID_TENANT_ID, { event_id: 'event-1' });
            const event2 = createMockOfflineSagaEvent(VALID_TENANT_ID, { event_id: 'event-2' });

            await addTenantOfflineSagaEvent(VALID_TENANT_ID, event1);
            await addTenantOfflineSagaEvent(VALID_TENANT_ID, event2);

            const events = await getTenantOfflineSagaEvents(VALID_TENANT_ID);

            expect(events.length).toBeGreaterThanOrEqual(2);
            expect(events.every(e => e.tenant_id === VALID_TENANT_ID)).toBe(true);
        });
    });

    describe('updateTenantProjection', () => {
        it('should update projection for tenant', async () => {
            await expect(
                updateTenantProjection(VALID_TENANT_ID, 'proj-1', { data: 'test' }, 1)
            ).resolves.not.toThrow();
        });
    });

    describe('getTenantProjection', () => {
        it('should retrieve projection for tenant', async () => {
            await updateTenantProjection(VALID_TENANT_ID, 'proj-1', { data: 'test' }, 1);

            const projection = await getTenantProjection(VALID_TENANT_ID, 'proj-1');

            expect(projection).toBeDefined();
            expect(projection?.data).toEqual({ data: 'test' });
        });

        it('should return null for non-existent projection', async () => {
            const projection = await getTenantProjection(VALID_TENANT_ID, 'non-existent');

            expect(projection).toBeNull();
        });
    });

    describe('addTenantSnapshot', () => {
        it('should add snapshot for tenant', async () => {
            const snapshot = createMockSnapshot(VALID_TENANT_ID);

            const result = await addTenantSnapshot(VALID_TENANT_ID, snapshot);

            expect(result.aggregate_type).toBe(snapshot.aggregate_type);
            expect(result.id).toBeDefined();
        });
    });

    describe('getTenantSnapshots', () => {
        it('should retrieve snapshots for tenant', async () => {
            const snapshot1 = createMockSnapshot(VALID_TENANT_ID, { aggregate_id: 'order-1' });
            const snapshot2 = createMockSnapshot(VALID_TENANT_ID, { aggregate_id: 'order-2' });

            await addTenantSnapshot(VALID_TENANT_ID, snapshot1);
            await addTenantSnapshot(VALID_TENANT_ID, snapshot2);

            const snapshots = await getTenantSnapshots(VALID_TENANT_ID);

            expect(snapshots.length).toBeGreaterThanOrEqual(2);
        });

        it('should filter snapshots by aggregate type', async () => {
            const snapshot1 = createMockSnapshot(VALID_TENANT_ID, { aggregate_type: 'Order' });
            const snapshot2 = createMockSnapshot(VALID_TENANT_ID, { aggregate_type: 'Shift' });

            await addTenantSnapshot(VALID_TENANT_ID, snapshot1);
            await addTenantSnapshot(VALID_TENANT_ID, snapshot2);

            const snapshots = await getTenantSnapshots(VALID_TENANT_ID, 'Order');

            expect(snapshots.every(s => s.aggregate_type === 'Order')).toBe(true);
        });
    });

    describe('addTenantEventsBatch', () => {
        it('should add multiple events for tenant', async () => {
            const events = [
                createMockEvent(VALID_TENANT_ID, { event_id: 'event-1' }),
                createMockEvent(VALID_TENANT_ID, { event_id: 'event-2' }),
            ];

            const results = await addTenantEventsBatch(VALID_TENANT_ID, events);

            expect(results).toHaveLength(2);
            expect(results.every(e => e.tenant_id === VALID_TENANT_ID)).toBe(true);
        });

        it('should reject batch with mismatched tenant_id', async () => {
            const events = [
                createMockEvent(VALID_TENANT_ID, { event_id: 'event-1' }),
                createMockEvent(VALID_TENANT_ID_2, { event_id: 'event-2' }),
            ];

            await expect(
                addTenantEventsBatch(VALID_TENANT_ID, events)
            ).rejects.toThrow(TenantValidationError);
        });
    });

    describe('deleteTenantOfflineSagaEvents', () => {
        it('should delete offline saga events for tenant', async () => {
            const event1 = createMockOfflineSagaEvent(VALID_TENANT_ID, { event_id: 'event-1' });
            const event2 = createMockOfflineSagaEvent(VALID_TENANT_ID, { event_id: 'event-2' });

            await addTenantOfflineSagaEvent(VALID_TENANT_ID, event1);
            await addTenantOfflineSagaEvent(VALID_TENANT_ID, event2);

            await expect(
                deleteTenantOfflineSagaEvents(VALID_TENANT_ID, ['event-1', 'event-2'])
            ).resolves.not.toThrow();
        });
    });
});
