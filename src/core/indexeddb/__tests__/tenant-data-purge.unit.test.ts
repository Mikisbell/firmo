/**
 * Unit Tests for Tenant Data Purge
 * 
 * Task 18.10 - IndexedDB Tenant Isolation
 * 
 * Tests data purge functionality:
 * - Complete data removal
 * - Logout cleanup
 * - Tenant switch cleanup
 * - Error handling
 * 
 * Validates: Requirements 15.6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    purgeTenantData,
    purgeOnLogout,
    purgeOnTenantSwitch,
    purgeOnTenantDeactivation,
    purgeOnTenantDeletion,
    type PurgeResult,
} from '../tenant-data-purge';

// Mock window and storage for tests
const mockLocalStorage = new Map<string, string>();
const mockSessionStorage = new Map<string, string>();

Object.defineProperty(global, 'window', {
    value: {
        localStorage: {
            getItem: (key: string) => mockLocalStorage.get(key) || null,
            setItem: (key: string, value: string) => mockLocalStorage.set(key, value),
            removeItem: (key: string) => mockLocalStorage.delete(key),
            clear: () => mockLocalStorage.clear(),
            length: mockLocalStorage.size,
            key: (index: number) => Array.from(mockLocalStorage.keys())[index] || null,
        },
        sessionStorage: {
            getItem: (key: string) => mockSessionStorage.get(key) || null,
            setItem: (key: string, value: string) => mockSessionStorage.set(key, value),
            removeItem: (key: string) => mockSessionStorage.delete(key),
            clear: () => mockSessionStorage.clear(),
            length: mockSessionStorage.size,
            key: (index: number) => Array.from(mockSessionStorage.keys())[index] || null,
        },
        indexedDB: {
            deleteDatabase: vi.fn((dbName: string) => ({
                onerror: null,
                onsuccess: null,
                onblocked: null,
            })),
        },
    },
    writable: true,
    configurable: true,
});

// ============================================================================
// Test Data
// ============================================================================

const TENANT_ID_1 = '550e8400-e29b-41d4-a716-446655440000';
const TENANT_ID_2 = '550e8400-e29b-41d4-a716-446655440001';

// ============================================================================
// Unit Tests
// ============================================================================

describe('Tenant Data Purge', () => {
    beforeEach(() => {
        mockLocalStorage.clear();
        mockSessionStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        mockLocalStorage.clear();
        mockSessionStorage.clear();
    });

    describe('purgeTenantData', () => {
        it('should purge all tenant data', async () => {
            // Setup: Add some tenant data
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key2`, 'value2');
            mockSessionStorage.set(`parkpos-session-${TENANT_ID_1}-key1`, 'value1');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge
            const result = await purgeTenantData(TENANT_ID_1);

            // Verify result
            expect(result).toBeDefined();
            expect(result.tenant_id).toBe(TENANT_ID_1);
            expect(result.localstorage_cleared).toBe(2);
            expect(result.sessionstorage_cleared).toBe(1);
            expect(result.encryption_keys_cleared).toBe(true);

            // Verify data is cleared
            expect(mockLocalStorage.size).toBe(0);
            expect(mockSessionStorage.size).toBe(0);
        });

        it('should not affect other tenants data', async () => {
            // Setup: Add data for two tenants
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_2}-key1`, 'value2');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge for tenant 1
            await purgeTenantData(TENANT_ID_1);

            // Verify only tenant 1 data is cleared
            expect(mockLocalStorage.size).toBe(1);
            expect(mockLocalStorage.get(`parkpos-${TENANT_ID_2}-key1`)).toBe('value2');
        });

        it('should handle empty storage', async () => {
            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge with empty storage
            const result = await purgeTenantData(TENANT_ID_1);

            expect(result.localstorage_cleared).toBe(0);
            expect(result.sessionstorage_cleared).toBe(0);
        });

        it('should throw error for invalid tenant_id', async () => {
            await expect(purgeTenantData('invalid-id')).rejects.toThrow();
        });

        it('should return PurgeResult with correct structure', async () => {
            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            const result = await purgeTenantData(TENANT_ID_1);

            expect(result).toHaveProperty('tenant_id');
            expect(result).toHaveProperty('indexeddb_deleted');
            expect(result).toHaveProperty('localstorage_cleared');
            expect(result).toHaveProperty('sessionstorage_cleared');
            expect(result).toHaveProperty('encryption_keys_cleared');
            expect(result).toHaveProperty('timestamp');

            expect(typeof result.tenant_id).toBe('string');
            expect(typeof result.indexeddb_deleted).toBe('boolean');
            expect(typeof result.localstorage_cleared).toBe('number');
            expect(typeof result.sessionstorage_cleared).toBe('number');
            expect(typeof result.encryption_keys_cleared).toBe('boolean');
            expect(result.timestamp instanceof Date).toBe(true);
        });
    });

    describe('purgeOnLogout', () => {
        it('should purge data on logout', async () => {
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            const result = await purgeOnLogout(TENANT_ID_1);

            expect(result.tenant_id).toBe(TENANT_ID_1);
            expect(mockLocalStorage.size).toBe(0);
        });
    });

    describe('purgeOnTenantSwitch', () => {
        it('should purge old tenant data on switch', async () => {
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_2}-key1`, 'value2');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            const result = await purgeOnTenantSwitch(TENANT_ID_1, TENANT_ID_2);

            expect(result.tenant_id).toBe(TENANT_ID_1);
            expect(mockLocalStorage.size).toBe(1);
            expect(mockLocalStorage.get(`parkpos-${TENANT_ID_2}-key1`)).toBe('value2');
        });
    });

    describe('purgeOnTenantDeactivation', () => {
        it('should purge data on tenant deactivation', async () => {
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            const result = await purgeOnTenantDeactivation(TENANT_ID_1);

            expect(result.tenant_id).toBe(TENANT_ID_1);
            expect(mockLocalStorage.size).toBe(0);
        });
    });

    describe('purgeOnTenantDeletion', () => {
        it('should purge data on tenant deletion', async () => {
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            const result = await purgeOnTenantDeletion(TENANT_ID_1);

            expect(result.tenant_id).toBe(TENANT_ID_1);
            expect(mockLocalStorage.size).toBe(0);
        });
    });

    describe('Complete Data Removal', () => {
        it('should remove all types of storage', async () => {
            // Setup: Add data to all storage types
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-local1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-local2`, 'value2');
            mockSessionStorage.set(`parkpos-session-${TENANT_ID_1}-session1`, 'value1');
            mockSessionStorage.set(`parkpos-session-${TENANT_ID_1}-session2`, 'value2');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge
            const result = await purgeTenantData(TENANT_ID_1);

            // Verify all storage is cleared
            expect(result.localstorage_cleared).toBe(2);
            expect(result.sessionstorage_cleared).toBe(2);
            expect(mockLocalStorage.size).toBe(0);
            expect(mockSessionStorage.size).toBe(0);
        });

        it('should handle large number of entries', async () => {
            // Setup: Add many entries
            for (let i = 0; i < 100; i++) {
                mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key${i}`, `value${i}`);
            }

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge
            const result = await purgeTenantData(TENANT_ID_1);

            expect(result.localstorage_cleared).toBe(100);
            expect(mockLocalStorage.size).toBe(0);
        });
    });

    describe('Isolation Between Tenants', () => {
        it('should only purge specified tenant data', async () => {
            // Setup: Add data for multiple tenants
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_1}-key2`, 'value2');
            mockLocalStorage.set(`parkpos-${TENANT_ID_2}-key1`, 'value1');
            mockLocalStorage.set(`parkpos-${TENANT_ID_2}-key2`, 'value2');
            mockLocalStorage.set('other-key', 'value');

            // Mock IndexedDB delete
            const deleteDbMock = vi.fn((dbName: string) => {
                return {
                    onerror: null,
                    onsuccess: function() {
                        if (this.onsuccess) this.onsuccess();
                    },
                    onblocked: null,
                };
            });
            (window.indexedDB as any).deleteDatabase = deleteDbMock;

            // Execute purge for tenant 1
            const result = await purgeTenantData(TENANT_ID_1);

            // Verify only tenant 1 data is cleared
            expect(result.localstorage_cleared).toBe(2);
            expect(mockLocalStorage.size).toBe(3);
            expect(mockLocalStorage.get(`parkpos-${TENANT_ID_2}-key1`)).toBe('value1');
            expect(mockLocalStorage.get('other-key')).toBe('value');
        });
    });
});
