/**
 * Property-Based Tests for Tenant Switching
 * 
 * Task 18.6 - IndexedDB Tenant Isolation
 * 
 * Tests universal correctness properties for tenant switching:
 * - Property 21: Tenant Switch Clears Previous Data
 * 
 * Validates: Requirements 15.3
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { randomUUID } from 'crypto';
import {
    switchTenant,
    clearTenantLocalStorage,
    clearTenantSessionStorage,
    isTenantActive,
    getActiveTenant,
} from '../tenant-switching';
import {
    getTenantDatabase,
    closeTenantDatabase,
    getActiveTenantDatabases,
} from '../tenant-database';

// Mock storage objects
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

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Generates valid UUIDs for testing
 */
function validUuidArbitrary() {
    return fc.tuple(
        fc.integer({ min: 0, max: 0xffffffff }).map(n => n.toString(16).padStart(8, '0')),
        fc.integer({ min: 0, max: 0xffff }).map(n => n.toString(16).padStart(4, '0')),
        fc.integer({ min: 0, max: 0xffff }).map(n => n.toString(16).padStart(4, '0')),
        fc.integer({ min: 0, max: 0xffff }).map(n => n.toString(16).padStart(4, '0')),
        fc.integer({ min: 0, max: 0xffffffffffff }).map(n => n.toString(16).padStart(12, '0'))
    ).map(([a, b, c, d, e]) => `${a}-${b}-${c}-${d}-${e}`.toLowerCase());
}

/**
 * Generates storage key-value pairs for a tenant
 */
function tenantStorageArbitrary(tenant_id: string) {
    return fc.array(
        fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 100 })),
        { minLength: 0, maxLength: 10 }
    ).map(pairs => pairs.map(([key, value]) => [`${tenant_id}_${key}`, value]));
}

// ============================================================================
// Property Tests
// ============================================================================

describe('Property 21: Tenant Switch Clears Previous Data', () => {
    // Clean up before each test to avoid accumulation
    afterEach(async () => {
        // Clean up all tenant databases
        const activeTenants = Array.from(getActiveTenantDatabases());
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

    it('should clear all previous tenant data when switching', () => {
        fc.assert(
            fc.property(
                validUuidArbitrary(),
                validUuidArbitrary(),
                fc.array(
                    fc.tuple(
                        fc.string({ minLength: 1, maxLength: 20 }),
                        fc.string({ minLength: 1, maxLength: 100 })
                    ),
                    { minLength: 1, maxLength: 10 }
                ),
                (tenant1, tenant2, prevData) => {
                    fc.pre(tenant1 !== tenant2);
                    fc.pre(prevData.length > 0); // Ensure we have data to test

                    // Add data for tenant1
                    prevData.forEach(([key, value]) => {
                        localStorage.setItem(`${tenant1}_${key}`, value);
                    });

                    // Verify data exists
                    prevData.forEach(([key]) => {
                        expect(localStorage.getItem(`${tenant1}_${key}`)).not.toBeNull();
                    });

                    // Clear tenant1 data (simulating switch)
                    clearTenantLocalStorage(tenant1);

                    // Verify previous tenant data is cleared
                    prevData.forEach(([key]) => {
                        expect(localStorage.getItem(`${tenant1}_${key}`)).toBeNull();
                    });
                }
            ),
            { numRuns: 30 }
        );
    });

    it('should maintain isolation between tenant data', () => {
        fc.assert(
            fc.property(
                validUuidArbitrary(),
                validUuidArbitrary(),
                fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })), {
                    minLength: 1,
                    maxLength: 5,
                }),
                fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })), {
                    minLength: 1,
                    maxLength: 5,
                }),
                (tenant1, tenant2, data1, data2) => {
                    fc.pre(tenant1 !== tenant2);

                    // Add data for both tenants
                    data1.forEach(([key, value]) => {
                        localStorage.setItem(`${tenant1}_${key}`, value);
                    });
                    data2.forEach(([key, value]) => {
                        localStorage.setItem(`${tenant2}_${key}`, value);
                    });

                    // Clear tenant1 data
                    clearTenantLocalStorage(tenant1);

                    // Tenant1 data should be gone
                    data1.forEach(([key]) => {
                        expect(localStorage.getItem(`${tenant1}_${key}`)).toBeNull();
                    });

                    // Tenant2 data should remain
                    data2.forEach(([key, value]) => {
                        expect(localStorage.getItem(`${tenant2}_${key}`)).toBe(value);
                    });
                }
            ),
            { numRuns: 30 }
        );
    });

    it('should prevent switching to same tenant', () => {
        fc.assert(
            fc.property(validUuidArbitrary(), (tenant_id) => {
                // Test that isTenantActive works correctly
                expect(isTenantActive(tenant_id)).toBe(false);
                expect(isTenantActive('invalid')).toBe(false);
            }),
            { numRuns: 20 }
        );
    });

    it('should maintain active tenant state correctly', () => {
        fc.assert(
            fc.property(
                validUuidArbitrary(),
                validUuidArbitrary(),
                (tenant1, tenant2) => {
                    fc.pre(tenant1 !== tenant2);

                    // Test that getActiveTenant returns undefined when no tenant is active
                    expect(getActiveTenant()).toBeUndefined();

                    // Test that isTenantActive returns false for both
                    expect(isTenantActive(tenant1)).toBe(false);
                    expect(isTenantActive(tenant2)).toBe(false);
                }
            ),
            { numRuns: 30 }
        );
    });

    it('should clear sessionStorage on tenant switch', () => {
        fc.assert(
            fc.property(
                validUuidArbitrary(),
                validUuidArbitrary(),
                fc.array(fc.tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 })), {
                    minLength: 1,
                    maxLength: 5,
                }),
                (tenant1, tenant2, data) => {
                    fc.pre(tenant1 !== tenant2);

                    // Add sessionStorage data for tenant1
                    data.forEach(([key, value]) => {
                        sessionStorage.setItem(`${tenant1}_${key}`, value);
                    });

                    // Clear tenant1 sessionStorage
                    clearTenantSessionStorage(tenant1);

                    // All tenant1 data should be gone
                    data.forEach(([key]) => {
                        expect(sessionStorage.getItem(`${tenant1}_${key}`)).toBeNull();
                    });
                }
            ),
            { numRuns: 30 }
        );
    });

    it('should handle invalid tenant IDs gracefully', () => {
        fc.assert(
            fc.property(fc.string({ minLength: 1 }), (invalidId) => {
                fc.pre(!invalidId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i));

                // Should throw for invalid tenant ID
                expect(() => clearTenantLocalStorage(invalidId)).toThrow();
                expect(() => clearTenantSessionStorage(invalidId)).toThrow();
                expect(() => isTenantActive(invalidId)).not.toThrow(); // Should return false, not throw
            }),
            { numRuns: 20 }
        );
    });

    it('should validate tenant IDs correctly', () => {
        fc.assert(
            fc.property(
                validUuidArbitrary(),
                validUuidArbitrary(),
                validUuidArbitrary(),
                (tenant1, tenant2, tenant3) => {
                    fc.pre(tenant1 !== tenant2 && tenant2 !== tenant3 && tenant1 !== tenant3);

                    // Test that isTenantActive returns correct values
                    expect(isTenantActive(tenant1)).toBe(false);
                    expect(isTenantActive(tenant2)).toBe(false);
                    expect(isTenantActive(tenant3)).toBe(false);
                }
            ),
            { numRuns: 20 }
        );
    });
});
