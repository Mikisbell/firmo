/**
 * Unit Tests for Tenant Switching
 * 
 * Task 18.5 - IndexedDB Tenant Isolation
 * 
 * Tests the tenant switching functionality including:
 * - Switching between tenants
 * - Clearing previous tenant data
 * - Initializing new tenant database
 * - localStorage/sessionStorage cleanup
 * - Logout cleanup
 * - Active tenant tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
    switchTenant,
    clearTenantLocalStorage,
    clearTenantSessionStorage,
    logoutTenant,
    getActiveTenant,
    isTenantActive,
} from '../tenant-switching';
import {
    getTenantDatabase,
    closeTenantDatabase,
    clearTenantDatabase,
    getActiveTenantDatabases,
} from '../tenant-database';

// Mock window object for tests
const mockLocalStorage = new Map<string, string>();
const mockSessionStorage = new Map<string, string>();

// Create mock storage objects
const createStorageMock = (map: Map<string, string>) => ({
    getItem: (key: string) => map.get(key) || null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
    clear: () => map.clear(),
    get length() {
        return map.size;
    },
    key: (index: number) => {
        const keys = Array.from(map.keys());
        return keys[index] || null;
    },
});

// Override localStorage and sessionStorage for tests
Object.defineProperty(global, 'localStorage', {
    value: createStorageMock(mockLocalStorage),
    writable: true,
    configurable: true,
});

Object.defineProperty(global, 'sessionStorage', {
    value: createStorageMock(mockSessionStorage),
    writable: true,
    configurable: true,
});

// Mock window object
Object.defineProperty(global, 'window', {
    value: {
        localStorage: createStorageMock(mockLocalStorage),
        sessionStorage: createStorageMock(mockSessionStorage),
    },
    writable: true,
    configurable: true,
});

describe('Tenant Switching', () => {
    let tenant1: string;
    let tenant2: string;
    let tenant3: string;

    beforeEach(() => {
        tenant1 = randomUUID();
        tenant2 = randomUUID();
        tenant3 = randomUUID();

        // Clear storage before each test
        mockLocalStorage.clear();
        mockSessionStorage.clear();
    });

    afterEach(async () => {
        // Clean up all tenant databases
        const activeTenants = getActiveTenantDatabases();
        for (const tenantId of activeTenants) {
            try {
                await closeTenantDatabase(tenantId);
            } catch {
                // Ignore errors during cleanup
            }
        }

        mockLocalStorage.clear();
        mockSessionStorage.clear();
    });

    describe('switchTenant', () => {
        it('should switch from one tenant to another', async () => {
            // Initialize first tenant
            getTenantDatabase(tenant1);
            expect(isTenantActive(tenant1)).toBe(true);

            // Switch to second tenant
            const result = await switchTenant(tenant2, tenant1, 'test_switch');

            expect(result.success).toBe(true);
            expect(result.previous_tenant_id).toBe(tenant1);
            expect(result.new_tenant_id).toBe(tenant2);
            expect(result.message).toContain('Successfully switched');
            expect(isTenantActive(tenant2)).toBe(true);
        });

        it('should close previous tenant database when switching', async () => {
            // Initialize first tenant
            getTenantDatabase(tenant1);
            expect(isTenantActive(tenant1)).toBe(true);

            // Switch to second tenant
            await switchTenant(tenant2, tenant1);

            // Previous tenant should be closed
            expect(isTenantActive(tenant1)).toBe(false);
            expect(isTenantActive(tenant2)).toBe(true);
        });

        it('should initialize new tenant database when switching', async () => {
            // Switch to first tenant (no previous tenant)
            const result = await switchTenant(tenant1);

            expect(result.success).toBe(true);
            expect(isTenantActive(tenant1)).toBe(true);
        });

        it('should prevent switching to the same tenant', async () => {
            // Initialize first tenant
            getTenantDatabase(tenant1);

            // Try to switch to the same tenant
            const result = await switchTenant(tenant1, tenant1);

            expect(result.success).toBe(false);
            expect(result.message).toContain('Cannot switch to the same tenant');
        });

        it('should reject invalid tenant IDs', async () => {
            // Try to switch to invalid tenant ID
            await expect(switchTenant('invalid-id')).rejects.toThrow();
        });

        it('should reject invalid previous tenant ID', async () => {
            // Try to switch with invalid previous tenant ID
            await expect(switchTenant(tenant1, 'invalid-id')).rejects.toThrow();
        });

        it('should handle multiple sequential switches', async () => {
            // Switch to tenant1
            await switchTenant(tenant1);
            expect(isTenantActive(tenant1)).toBe(true);

            // Switch to tenant2
            await switchTenant(tenant2, tenant1);
            expect(isTenantActive(tenant1)).toBe(false);
            expect(isTenantActive(tenant2)).toBe(true);

            // Switch to tenant3
            await switchTenant(tenant3, tenant2);
            expect(isTenantActive(tenant2)).toBe(false);
            expect(isTenantActive(tenant3)).toBe(true);
        });

        it('should include switch context in result', async () => {
            const reason = 'user_logout';
            const result = await switchTenant(tenant1, undefined, reason);

            expect(result.context).toBeDefined();
            expect(result.context.new_tenant_id).toBe(tenant1);
            expect(result.context.reason).toBe(reason);
            expect(result.context.switched_at).toBeGreaterThan(0);
        });
    });

    describe('clearTenantLocalStorage', () => {
        it('should clear localStorage entries for a tenant', () => {
            // Add some entries for tenant1
            localStorage.setItem(`${tenant1}_key1`, 'value1');
            localStorage.setItem(`${tenant1}_key2`, 'value2');
            localStorage.setItem(`${tenant2}_key1`, 'value3');

            // Clear tenant1 localStorage
            clearTenantLocalStorage(tenant1);

            // Tenant1 entries should be removed
            expect(localStorage.getItem(`${tenant1}_key1`)).toBeNull();
            expect(localStorage.getItem(`${tenant1}_key2`)).toBeNull();

            // Tenant2 entries should remain
            expect(localStorage.getItem(`${tenant2}_key1`)).toBe('value3');
        });

        it('should handle empty localStorage', () => {
            // Should not throw when localStorage is empty
            expect(() => clearTenantLocalStorage(tenant1)).not.toThrow();
        });

        it('should reject invalid tenant ID', () => {
            expect(() => clearTenantLocalStorage('invalid-id')).toThrow();
        });

        it('should handle localStorage with no tenant entries', () => {
            // Add entries without tenant ID
            localStorage.setItem('global_key', 'value');

            // Should not throw
            expect(() => clearTenantLocalStorage(tenant1)).not.toThrow();

            // Global entry should remain
            expect(localStorage.getItem('global_key')).toBe('value');
        });
    });

    describe('clearTenantSessionStorage', () => {
        it('should clear sessionStorage entries for a tenant', () => {
            // Add some entries for tenant1
            sessionStorage.setItem(`${tenant1}_key1`, 'value1');
            sessionStorage.setItem(`${tenant1}_key2`, 'value2');
            sessionStorage.setItem(`${tenant2}_key1`, 'value3');

            // Clear tenant1 sessionStorage
            clearTenantSessionStorage(tenant1);

            // Tenant1 entries should be removed
            expect(sessionStorage.getItem(`${tenant1}_key1`)).toBeNull();
            expect(sessionStorage.getItem(`${tenant1}_key2`)).toBeNull();

            // Tenant2 entries should remain
            expect(sessionStorage.getItem(`${tenant2}_key1`)).toBe('value3');
        });

        it('should handle empty sessionStorage', () => {
            // Should not throw when sessionStorage is empty
            expect(() => clearTenantSessionStorage(tenant1)).not.toThrow();
        });

        it('should reject invalid tenant ID', () => {
            expect(() => clearTenantSessionStorage('invalid-id')).toThrow();
        });
    });

    describe('logoutTenant', () => {
        it('should perform complete cleanup on logout', async () => {
            // Initialize tenant
            getTenantDatabase(tenant1);
            localStorage.setItem(`${tenant1}_key`, 'value');
            sessionStorage.setItem(`${tenant1}_key`, 'value');

            // Logout
            await logoutTenant(tenant1);

            // All should be cleaned up
            expect(isTenantActive(tenant1)).toBe(false);
            expect(localStorage.getItem(`${tenant1}_key`)).toBeNull();
            expect(sessionStorage.getItem(`${tenant1}_key`)).toBeNull();
        });

        it('should reject invalid tenant ID', async () => {
            await expect(logoutTenant('invalid-id')).rejects.toThrow();
        });

        it('should handle logout of non-existent tenant', async () => {
            // Should not throw even if tenant was never initialized
            await expect(logoutTenant(tenant1)).resolves.toBeUndefined();
        });
    });

    describe('getActiveTenant', () => {
        it('should return active tenant', () => {
            getTenantDatabase(tenant1);
            expect(getActiveTenant()).toBe(tenant1);
        });

        it('should return undefined when no tenant is active', () => {
            expect(getActiveTenant()).toBeUndefined();
        });

        it('should return first active tenant when multiple are active', async () => {
            // Initialize multiple tenants
            getTenantDatabase(tenant1);
            getTenantDatabase(tenant2);

            const activeTenant = getActiveTenant();
            expect([tenant1, tenant2]).toContain(activeTenant);
        });
    });

    describe('isTenantActive', () => {
        it('should return true for active tenant', () => {
            getTenantDatabase(tenant1);
            expect(isTenantActive(tenant1)).toBe(true);
        });

        it('should return false for inactive tenant', () => {
            expect(isTenantActive(tenant1)).toBe(false);
        });

        it('should return false for invalid tenant ID', () => {
            expect(isTenantActive('invalid-id')).toBe(false);
        });

        it('should handle multiple tenants correctly', async () => {
            getTenantDatabase(tenant1);
            getTenantDatabase(tenant2);

            expect(isTenantActive(tenant1)).toBe(true);
            expect(isTenantActive(tenant2)).toBe(true);
            expect(isTenantActive(tenant3)).toBe(false);
        });
    });

    describe('Integration: Complete Tenant Lifecycle', () => {
        it('should handle complete tenant lifecycle', async () => {
            // 1. Initialize tenant1
            await switchTenant(tenant1);
            expect(isTenantActive(tenant1)).toBe(true);

            // 2. Add some data
            localStorage.setItem(`${tenant1}_data`, 'important');
            sessionStorage.setItem(`${tenant1}_session`, 'session_data');

            // 3. Switch to tenant2
            await switchTenant(tenant2, tenant1);
            expect(isTenantActive(tenant1)).toBe(false);
            expect(isTenantActive(tenant2)).toBe(true);

            // 4. Verify tenant1 data is cleared
            expect(localStorage.getItem(`${tenant1}_data`)).toBeNull();
            expect(sessionStorage.getItem(`${tenant1}_session`)).toBeNull();

            // 5. Add tenant2 data
            localStorage.setItem(`${tenant2}_data`, 'tenant2_important');

            // 6. Logout tenant2
            await logoutTenant(tenant2);
            expect(isTenantActive(tenant2)).toBe(false);
            expect(localStorage.getItem(`${tenant2}_data`)).toBeNull();
        });

        it('should maintain data isolation between tenants', async () => {
            // Initialize both tenants
            getTenantDatabase(tenant1);
            getTenantDatabase(tenant2);

            // Add data for each tenant
            localStorage.setItem(`${tenant1}_key`, 'tenant1_value');
            localStorage.setItem(`${tenant2}_key`, 'tenant2_value');

            // Clear tenant1 data
            clearTenantLocalStorage(tenant1);

            // Tenant1 data should be gone, tenant2 should remain
            expect(localStorage.getItem(`${tenant1}_key`)).toBeNull();
            expect(localStorage.getItem(`${tenant2}_key`)).toBe('tenant2_value');
        });
    });
});
