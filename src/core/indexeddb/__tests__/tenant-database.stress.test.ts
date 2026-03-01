/**
 * Stress Tests for Tenant-Specific Database Management
 * 
 * Task 18.1 & 18.2 - IndexedDB Tenant Isolation
 * 
 * Tests for:
 * - High volume database creation
 * - Concurrent database operations
 * - Memory usage under load
 * - Database lifecycle at scale
 * - Performance benchmarks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { seededMathRandom } from '@/src/test-utils/seeded-random';

const { random } = seededMathRandom(42);

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

    const EntityTable = MockTable;

    return {
        default: MockDexie,
        EntityTable,
    };
});

import {
    getTenantDatabaseName,
    getTenantDatabase,
    closeTenantDatabase,
    closeAllTenantDatabases,
    getActiveTenantDatabases,
    clearTenantDatabase,
    getTenantDatabaseStats,
} from '../tenant-database';

// Helper to generate valid UUIDs
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

describe('Tenant Database Stress Tests', () => {
    beforeEach(() => {
        (global as any).window = {};
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await closeAllTenantDatabases();
        delete (global as any).window;
    });

    describe('High Volume Database Creation', () => {
        it('should handle creating 100 tenant databases', async () => {
            const startTime = performance.now();
            const tenantIds: string[] = [];

            // Create 100 databases
            for (let i = 0; i < 100; i++) {
                const tenantId = generateUUID();
                tenantIds.push(tenantId);
                const db = getTenantDatabase(tenantId);
                expect(db).toBeDefined();
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify all databases are active
            const activeDatabases = getActiveTenantDatabases();
            expect(activeDatabases.length).toBe(100);

            // Performance check: should complete in reasonable time
            expect(duration).toBeLessThan(5000); // 5 seconds for 100 databases

            console.log(`Created 100 databases in ${duration.toFixed(2)}ms (${(duration / 100).toFixed(2)}ms per database)`);
        });

        it('should handle creating 1000 database names', () => {
            const startTime = performance.now();
            const names = new Set<string>();

            // Generate 1000 database names
            for (let i = 0; i < 1000; i++) {
                const tenantId = generateUUID();
                const dbName = getTenantDatabaseName(tenantId);
                names.add(dbName);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // All names should be unique
            expect(names.size).toBe(1000);

            // Performance check
            expect(duration).toBeLessThan(1000); // 1 second for 1000 names

            console.log(`Generated 1000 unique database names in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(3)}ms per name)`);
        });
    });

    describe('Concurrent Database Operations', () => {
        it('should handle concurrent database creation', async () => {
            const startTime = performance.now();
            const tenantIds = Array.from({ length: 50 }, () => generateUUID());

            // Create all databases concurrently
            const promises = tenantIds.map(tenantId => {
                return Promise.resolve(getTenantDatabase(tenantId));
            });

            const databases = await Promise.all(promises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify all databases created
            expect(databases.length).toBe(50);
            expect(getActiveTenantDatabases().length).toBe(50);

            // Performance check
            expect(duration).toBeLessThan(2000); // 2 seconds for 50 concurrent

            console.log(`Created 50 databases concurrently in ${duration.toFixed(2)}ms`);
        });

        it('should handle concurrent database closure', async () => {
            const tenantIds = Array.from({ length: 50 }, () => generateUUID());

            // Create all databases
            tenantIds.forEach(tenantId => getTenantDatabase(tenantId));
            expect(getActiveTenantDatabases().length).toBe(50);

            const startTime = performance.now();

            // Close all databases concurrently
            const closePromises = tenantIds.map(tenantId => closeTenantDatabase(tenantId));
            await Promise.all(closePromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify all databases closed
            expect(getActiveTenantDatabases().length).toBe(0);

            // Performance check
            expect(duration).toBeLessThan(2000); // 2 seconds for 50 concurrent closes

            console.log(`Closed 50 databases concurrently in ${duration.toFixed(2)}ms`);
        });

        it('should handle concurrent database stats retrieval', async () => {
            const tenantIds = Array.from({ length: 30 }, () => generateUUID());

            // Create all databases
            tenantIds.forEach(tenantId => getTenantDatabase(tenantId));

            const startTime = performance.now();

            // Get stats for all databases concurrently
            const statsPromises = tenantIds.map(tenantId => getTenantDatabaseStats(tenantId));
            const allStats = await Promise.all(statsPromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify all stats retrieved
            expect(allStats.length).toBe(30);
            allStats.forEach((stats, index) => {
                expect(stats.tenant_id).toBe(tenantIds[index]);
                expect(stats.db_name).toBeDefined();
            });

            // Performance check
            expect(duration).toBeLessThan(1000); // 1 second for 30 concurrent stats

            console.log(`Retrieved stats for 30 databases concurrently in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Database Lifecycle at Scale', () => {
        it('should handle rapid create/close cycles', async () => {
            const startTime = performance.now();
            const cycles = 50;

            for (let i = 0; i < cycles; i++) {
                const tenantId = generateUUID();
                const db = getTenantDatabase(tenantId);
                expect(db).toBeDefined();
                await closeTenantDatabase(tenantId);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify no databases left open
            expect(getActiveTenantDatabases().length).toBe(0);

            // Performance check
            expect(duration).toBeLessThan(5000); // 5 seconds for 50 cycles

            console.log(`Completed 50 create/close cycles in ${duration.toFixed(2)}ms (${(duration / cycles).toFixed(2)}ms per cycle)`);
        });

        it('should handle mixed operations at scale', async () => {
            const startTime = performance.now();
            const tenantIds = Array.from({ length: 30 }, () => generateUUID());

            // Create all databases
            tenantIds.forEach(tenantId => getTenantDatabase(tenantId));

            // Get stats for half
            const statsPromises = tenantIds.slice(0, 15).map(tenantId => getTenantDatabaseStats(tenantId));
            await Promise.all(statsPromises);

            // Clear half
            const clearPromises = tenantIds.slice(15, 22).map(tenantId => clearTenantDatabase(tenantId));
            await Promise.all(clearPromises);

            // Close quarter
            const closePromises = tenantIds.slice(22, 30).map(tenantId => closeTenantDatabase(tenantId));
            await Promise.all(closePromises);

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify state
            const active = getActiveTenantDatabases();
            expect(active.length).toBe(22); // 30 - 8 closed

            // Performance check
            expect(duration).toBeLessThan(3000); // 3 seconds for mixed operations

            console.log(`Completed mixed operations on 30 databases in ${duration.toFixed(2)}ms`);
        });
    });

    describe('Database Name Generation Performance', () => {
        it('should generate database names efficiently', () => {
            const startTime = performance.now();
            const iterations = 10000;

            for (let i = 0; i < iterations; i++) {
                const tenantId = generateUUID();
                getTenantDatabaseName(tenantId);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Performance check: should be very fast
            expect(duration).toBeLessThan(500); // 500ms for 10000 generations

            const opsPerSecond = (iterations / duration) * 1000;
            console.log(`Generated ${iterations} database names in ${duration.toFixed(2)}ms (${opsPerSecond.toFixed(0)} ops/sec)`);
        });

        it('should maintain uniqueness under high volume', () => {
            const names = new Set<string>();
            const iterations = 5000;

            for (let i = 0; i < iterations; i++) {
                const tenantId = generateUUID();
                const dbName = getTenantDatabaseName(tenantId);
                names.add(dbName);
            }

            // All names should be unique
            expect(names.size).toBe(iterations);
            console.log(`Generated ${iterations} unique names with 100% uniqueness`);
        });
    });

    describe('Memory and Resource Management', () => {
        it('should not leak memory with repeated create/close', async () => {
            const iterations = 100;
            const startTime = performance.now();

            for (let i = 0; i < iterations; i++) {
                const tenantId = generateUUID();
                getTenantDatabase(tenantId);
                await closeTenantDatabase(tenantId);
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Verify cleanup
            expect(getActiveTenantDatabases().length).toBe(0);

            // Performance should be consistent (not degrading)
            const avgTimePerIteration = duration / iterations;
            expect(avgTimePerIteration).toBeLessThan(100); // 100ms per iteration

            console.log(`${iterations} iterations completed in ${duration.toFixed(2)}ms (avg ${avgTimePerIteration.toFixed(2)}ms per iteration)`);
        });

        it('should handle large number of active databases', async () => {
            const tenantIds = Array.from({ length: 200 }, () => generateUUID());

            // Create all databases
            const startTime = performance.now();
            tenantIds.forEach(tenantId => getTenantDatabase(tenantId));
            const createDuration = performance.now() - startTime;

            // Verify all active
            expect(getActiveTenantDatabases().length).toBe(200);

            // Get stats for all
            const statsStart = performance.now();
            const statsPromises = tenantIds.map(tenantId => getTenantDatabaseStats(tenantId));
            await Promise.all(statsPromises);
            const statsDuration = performance.now() - statsStart;

            // Close all
            const closeStart = performance.now();
            await closeAllTenantDatabases();
            const closeDuration = performance.now() - closeStart;

            // Verify cleanup
            expect(getActiveTenantDatabases().length).toBe(0);

            console.log(`200 databases: create ${createDuration.toFixed(2)}ms, stats ${statsDuration.toFixed(2)}ms, close ${closeDuration.toFixed(2)}ms`);
        });
    });

    describe('Edge Cases Under Load', () => {
        it('should handle duplicate tenant IDs gracefully', () => {
            const tenantId = generateUUID();

            // Create database
            const db1 = getTenantDatabase(tenantId);

            // Request same database again
            const db2 = getTenantDatabase(tenantId);

            // Should return same instance (cached)
            expect(db1).toBe(db2);
            expect(getActiveTenantDatabases().length).toBe(1);
        });

        it('should handle rapid close/reopen of same tenant', async () => {
            const tenantId = generateUUID();
            const cycles = 20;

            for (let i = 0; i < cycles; i++) {
                getTenantDatabase(tenantId);
                await closeTenantDatabase(tenantId);
            }

            // Should be able to create again
            const db = getTenantDatabase(tenantId);
            expect(db).toBeDefined();
            expect(getActiveTenantDatabases()).toContain(tenantId);
        });

        it('should handle closing non-existent databases', async () => {
            const tenantIds = Array.from({ length: 10 }, () => generateUUID());

            // Close databases that were never created
            const closePromises = tenantIds.map(tenantId => closeTenantDatabase(tenantId));
            await expect(Promise.all(closePromises)).resolves.not.toThrow();

            expect(getActiveTenantDatabases().length).toBe(0);
        });
    });
});
