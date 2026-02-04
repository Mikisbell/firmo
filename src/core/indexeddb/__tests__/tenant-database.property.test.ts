/**
 * Property-Based Tests for Tenant-Specific Database Naming
 * 
 * Task 18.2 - IndexedDB Tenant Isolation
 * 
 * **Property 19: IndexedDB Database Names Are Tenant-Specific**
 * 
 * For any two different tenants, their IndexedDB database names should be
 * different and include the tenant_id.
 * 
 * **Validates: Requirements 15.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getTenantDatabaseName } from '../tenant-database';

describe('Property 19: IndexedDB Database Names Are Tenant-Specific', () => {
    /**
     * Property: Different tenant_ids produce different database names
     * 
     * For any two different tenant_ids, the generated database names must be different.
     * This ensures complete isolation between tenants.
     */
    it('should generate different database names for different tenant_ids', () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                fc.uuid(),
                (tenant_id_1, tenant_id_2) => {
                    fc.pre(tenant_id_1 !== tenant_id_2);

                    const db_name_1 = getTenantDatabaseName(tenant_id_1);
                    const db_name_2 = getTenantDatabaseName(tenant_id_2);

                    // Database names must be different
                    expect(db_name_1).not.toBe(db_name_2);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Database names are deterministic
     * 
     * For any tenant_id, calling getTenantDatabaseName multiple times
     * must always produce the same database name.
     */
    it('should generate deterministic database names', () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                (tenant_id) => {
                    const db_name_1 = getTenantDatabaseName(tenant_id);
                    const db_name_2 = getTenantDatabaseName(tenant_id);
                    const db_name_3 = getTenantDatabaseName(tenant_id);

                    // All calls must produce the same name
                    expect(db_name_1).toBe(db_name_2);
                    expect(db_name_2).toBe(db_name_3);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Database names include tenant identifier
     * 
     * For any tenant_id, the generated database name must include
     * the first 8 characters of the tenant_id for identification.
     */
    it('should include tenant identifier in database name', () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                (tenant_id) => {
                    const db_name = getTenantDatabaseName(tenant_id);
                    const shortId = tenant_id.substring(0, 8);

                    // Database name must include the short tenant_id
                    expect(db_name).toContain(shortId);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Database names follow expected format
     * 
     * For any tenant_id, the generated database name must follow
     * the format: park_pos_db_{first_12_hex_chars}
     */
    it('should follow expected database name format', () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                (tenant_id) => {
                    const db_name = getTenantDatabaseName(tenant_id);
                    const hexOnly = tenant_id.replace(/-/g, '');
                    const shortId = hexOnly.substring(0, 12);
                    const expectedFormat = `park_pos_db_${shortId}`;

                    // Database name must match expected format
                    expect(db_name).toBe(expectedFormat);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Database names are valid for IndexedDB
     * 
     * For any tenant_id, the generated database name must be valid
     * for use with IndexedDB (non-empty, reasonable length).
     */
    it('should generate valid IndexedDB database names', () => {
        fc.assert(
            fc.property(
                fc.uuid(),
                (tenant_id) => {
                    const db_name = getTenantDatabaseName(tenant_id);

                    // Database name must be non-empty
                    expect(db_name.length).toBeGreaterThan(0);

                    // Database name must be reasonable length (< 255 chars)
                    expect(db_name.length).toBeLessThan(255);

                    // Database name must not contain invalid characters
                    // IndexedDB allows most characters, but we use safe subset
                    expect(/^[a-z0-9_-]+$/.test(db_name)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Database names are unique across large tenant sets
     * 
     * For any set of different tenant_ids, all generated database names
     * must be unique (no collisions).
     */
    it('should generate unique database names across large tenant sets', () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.uuid(), { minLength: 10, maxLength: 100 }),
                (tenant_ids) => {
                    const db_names = tenant_ids.map(getTenantDatabaseName);
                    const uniqueNames = new Set(db_names);

                    // All database names must be unique
                    expect(uniqueNames.size).toBe(db_names.length);
                }
            ),
            { numRuns: 50 }
        );
    });

    /**
     * Property: Invalid tenant_ids are rejected
     * 
     * For any invalid tenant_id (not a valid UUID), getTenantDatabaseName
     * must throw an error.
     */
    it('should reject invalid tenant_ids', () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.string().filter((s) => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
                    fc.constant(''),
                    fc.constant(null as any),
                    fc.constant(undefined as any)
                ),
                (invalid_tenant_id) => {
                    // Invalid tenant_ids must throw error
                    expect(() => getTenantDatabaseName(invalid_tenant_id)).toThrow();
                }
            ),
            { numRuns: 50 }
        );
    });
});
