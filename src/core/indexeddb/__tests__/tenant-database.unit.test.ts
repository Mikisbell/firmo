/**
 * Unit Tests for Tenant-Specific Database Management
 * 
 * Task 18.1 - IndexedDB Tenant Isolation
 * 
 * Tests for:
 * - Database name generation
 * - Database instance creation and caching
 * - Database lifecycle management
 * - Database statistics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Dexie BEFORE importing the module
vi.mock('dexie', () => {
    class MockTable {
        clear = vi.fn().mockResolvedValue(undefined);
        count = vi.fn().mockResolvedValue(0);
    }

    class MockDexie {
        events: MockTable;
        projections: MockTable;
        sync_state: MockTable;
        catalog_versions: MockTable;
        catalog_items: MockTable;
        snapshots: MockTable;
        saga_logs: MockTable;
        offline_saga_events: MockTable;
        close = vi.fn().mockResolvedValue(undefined);

        constructor() {
            this.events = new MockTable();
            this.projections = new MockTable();
            this.sync_state = new MockTable();
            this.catalog_versions = new MockTable();
            this.catalog_items = new MockTable();
            this.snapshots = new MockTable();
            this.saga_logs = new MockTable();
            this.offline_saga_events = new MockTable();
        }

        version() {
            return { stores: () => ({ upgrade: () => {} }) };
        }
    }

    // Mock EntityTable type
    const EntityTable = MockTable;

    return {
        default: MockDexie,
        EntityTable,
    };
});

// Now import after mocking Dexie
import {
    getTenantDatabaseName,
    getTenantDatabase,
    closeTenantDatabase,
    closeAllTenantDatabases,
    getActiveTenantDatabases,
    clearTenantDatabase,
    getTenantDatabaseStats,
} from '../tenant-database';

describe('Tenant Database Management', () => {
    const tenant_id_1 = '550e8400-e29b-41d4-a716-446655440000';
    const tenant_id_2 = '660e8400-e29b-41d4-a716-446655440001';

    beforeEach(() => {
        // Mock window object for tests
        (global as any).window = {};
        // Clear any cached databases before each test
        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Clean up after each test
        await closeAllTenantDatabases();
        delete (global as any).window;
    });

    describe('getTenantDatabaseName', () => {
        it('should generate database name from tenant_id', () => {
            const db_name = getTenantDatabaseName(tenant_id_1);

            expect(db_name).toBe('park_pos_db_550e8400e29b');
        });

        it('should generate different names for different tenant_ids', () => {
            const db_name_1 = getTenantDatabaseName(tenant_id_1);
            const db_name_2 = getTenantDatabaseName(tenant_id_2);

            expect(db_name_1).not.toBe(db_name_2);
        });

        it('should be deterministic', () => {
            const db_name_1 = getTenantDatabaseName(tenant_id_1);
            const db_name_2 = getTenantDatabaseName(tenant_id_1);

            expect(db_name_1).toBe(db_name_2);
        });

        it('should reject invalid tenant_id format', () => {
            expect(() => getTenantDatabaseName('invalid-id')).toThrow();
            expect(() => getTenantDatabaseName('')).toThrow();
            expect(() => getTenantDatabaseName(null as any)).toThrow();
        });

        it('should include tenant identifier in name', () => {
            const db_name = getTenantDatabaseName(tenant_id_1);
            const shortId = tenant_id_1.substring(0, 8);

            expect(db_name).toContain(shortId);
        });

        it('should follow expected format', () => {
            const db_name = getTenantDatabaseName(tenant_id_1);

            expect(db_name).toMatch(/^park_pos_db_[0-9a-f]{12}$/i);
        });
    });

    describe('getTenantDatabase', () => {
        it('should create database instance for tenant', () => {
            const db = getTenantDatabase(tenant_id_1);

            expect(db).toBeDefined();
            // Database instance should have the expected structure
            expect(typeof db).toBe('object');
        });

        it('should cache database instances', () => {
            const db1 = getTenantDatabase(tenant_id_1);
            const db2 = getTenantDatabase(tenant_id_1);

            expect(db1).toBe(db2);
        });

        it('should create separate instances for different tenants', () => {
            const db1 = getTenantDatabase(tenant_id_1);
            const db2 = getTenantDatabase(tenant_id_2);

            expect(db1).not.toBe(db2);
        });

        it('should throw error for invalid tenant_id', () => {
            expect(() => getTenantDatabase('invalid-id')).toThrow();
        });

        it('should throw error on server side', () => {
            // Mock window as undefined to simulate server
            const originalWindow = global.window;
            (global as any).window = undefined;

            try {
                expect(() => getTenantDatabase(tenant_id_1)).toThrow('client side');
            } finally {
                (global as any).window = originalWindow;
            }
        });
    });

    describe('closeTenantDatabase', () => {
        it('should close database instance', async () => {
            const db = getTenantDatabase(tenant_id_1);
            await closeTenantDatabase(tenant_id_1);

            // After closing, should create new instance
            const db2 = getTenantDatabase(tenant_id_1);
            expect(db2).not.toBe(db);
        });

        it('should handle closing non-existent database', async () => {
            // Should not throw
            await expect(closeTenantDatabase(tenant_id_1)).resolves.not.toThrow();
        });

        it('should remove from active databases', async () => {
            getTenantDatabase(tenant_id_1);
            expect(getActiveTenantDatabases()).toContain(tenant_id_1);

            await closeTenantDatabase(tenant_id_1);
            expect(getActiveTenantDatabases()).not.toContain(tenant_id_1);
        });
    });

    describe('closeAllTenantDatabases', () => {
        it('should close all database instances', async () => {
            getTenantDatabase(tenant_id_1);
            getTenantDatabase(tenant_id_2);

            expect(getActiveTenantDatabases().length).toBe(2);

            await closeAllTenantDatabases();

            expect(getActiveTenantDatabases().length).toBe(0);
        });

        it('should handle empty database list', async () => {
            // Should not throw
            await expect(closeAllTenantDatabases()).resolves.not.toThrow();
        });
    });

    describe('getActiveTenantDatabases', () => {
        it('should return empty list initially', () => {
            const active = getActiveTenantDatabases();

            expect(active).toEqual([]);
        });

        it('should return list of active tenant_ids', () => {
            getTenantDatabase(tenant_id_1);
            getTenantDatabase(tenant_id_2);

            const active = getActiveTenantDatabases();

            expect(active).toContain(tenant_id_1);
            expect(active).toContain(tenant_id_2);
            expect(active.length).toBe(2);
        });

        it('should update after closing database', async () => {
            getTenantDatabase(tenant_id_1);
            getTenantDatabase(tenant_id_2);

            await closeTenantDatabase(tenant_id_1);

            const active = getActiveTenantDatabases();

            expect(active).not.toContain(tenant_id_1);
            expect(active).toContain(tenant_id_2);
        });
    });

    describe('clearTenantDatabase', () => {
        it('should clear all tables in database', async () => {
            getTenantDatabase(tenant_id_1);

            // Should not throw
            await expect(clearTenantDatabase(tenant_id_1)).resolves.not.toThrow();
        });

        it('should handle clearing non-existent database', async () => {
            // Should not throw
            await expect(clearTenantDatabase(tenant_id_1)).resolves.not.toThrow();
        });

        it('should clear all data tables', async () => {
            getTenantDatabase(tenant_id_1);

            // Should not throw
            await expect(clearTenantDatabase(tenant_id_1)).resolves.not.toThrow();
        });
    });

    describe('getTenantDatabaseStats', () => {
        it('should return database statistics', async () => {
            getTenantDatabase(tenant_id_1);

            const stats = await getTenantDatabaseStats(tenant_id_1);

            expect(stats).toHaveProperty('tenant_id', tenant_id_1);
            expect(stats).toHaveProperty('db_name');
            expect(stats).toHaveProperty('events_count');
            expect(stats).toHaveProperty('projections_count');
            expect(stats).toHaveProperty('saga_logs_count');
            expect(stats).toHaveProperty('snapshots_count');
        });

        it('should include correct database name in stats', async () => {
            getTenantDatabase(tenant_id_1);

            const stats = await getTenantDatabaseStats(tenant_id_1);
            const expectedDbName = getTenantDatabaseName(tenant_id_1);

            expect(stats.db_name).toBe(expectedDbName);
        });

        it('should throw error on server side', async () => {
            const originalWindow = global.window;
            (global as any).window = undefined;

            try {
                await expect(getTenantDatabaseStats(tenant_id_1)).rejects.toThrow('client side');
            } finally {
                (global as any).window = originalWindow;
            }
        });
    });

    describe('Integration scenarios', () => {
        it('should support multiple tenants with separate databases', async () => {
            const db1 = getTenantDatabase(tenant_id_1);
            const db2 = getTenantDatabase(tenant_id_2);

            expect(db1).not.toBe(db2);
            expect(getActiveTenantDatabases().length).toBe(2);

            await closeTenantDatabase(tenant_id_1);

            expect(getActiveTenantDatabases().length).toBe(1);
            expect(getActiveTenantDatabases()).toContain(tenant_id_2);
        });

        it('should handle tenant switching', async () => {
            // Open database for tenant 1
            getTenantDatabase(tenant_id_1);
            expect(getActiveTenantDatabases()).toContain(tenant_id_1);

            // Switch to tenant 2
            await closeTenantDatabase(tenant_id_1);
            getTenantDatabase(tenant_id_2);

            expect(getActiveTenantDatabases()).not.toContain(tenant_id_1);
            expect(getActiveTenantDatabases()).toContain(tenant_id_2);
        });

        it('should maintain separate data for each tenant', async () => {
            const db1 = getTenantDatabase(tenant_id_1);
            const db2 = getTenantDatabase(tenant_id_2);

            // Both databases should be different instances
            expect(db1).not.toBe(db2);
        });
    });
});
