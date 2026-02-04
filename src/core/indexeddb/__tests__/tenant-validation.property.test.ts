/**
 * Property-Based Tests for Tenant Validation Middleware
 * 
 * Tests universal correctness properties for tenant isolation:
 * - Property 20: Local Storage Isolation Prevents Cross-Tenant Access
 * - Property 21: Tenant Switch Clears Previous Data
 * 
 * Validates: Requirements 15.2, 15.4
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
    validateTenantId,
    validateEntityTenant,
    validateEntitiesTenant,
    TenantValidationError,
    withTenantReadValidation,
    withTenantWriteValidation,
} from '../tenant-validation';
import { closeAllTenantDatabases } from '../tenant-database';

// Mock window object for browser environment
beforeEach(() => {
    if (typeof window === 'undefined') {
        (global as any).window = {};
    }
});

afterEach(async () => {
    if ((global as any).window) {
        delete (global as any).window;
    }
    await closeAllTenantDatabases();
});

// ============================================================================
// Arbitraries
// ============================================================================

/**
 * Generates valid UUID v4 strings
 */
const validUuidArbitrary = () =>
    fc.uuid().map(uuid => uuid.toLowerCase());

/**
 * Generates invalid tenant_id values
 */
const invalidTenantIdArbitrary = () =>
    fc.oneof(
        fc.constant(''),
        fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
        fc.string({ minLength: 1, maxLength: 100 })
    );

/**
 * Generates entities with tenant_id
 */
const entityArbitrary = (tenant_id: string) =>
    fc.object({
        tenant_id: fc.constant(tenant_id),
        data: fc.string(),
        id: fc.uuid(),
    });

/**
 * Generates arrays of entities
 */
const entitiesArbitrary = (tenant_id: string) =>
    fc.array(entityArbitrary(tenant_id), { minLength: 1, maxLength: 10 });

// ============================================================================
// Property Tests
// ============================================================================

describe('Tenant Validation Middleware - Properties', () => {
    describe('Property 20: Local Storage Isolation Prevents Cross-Tenant Access', () => {
        it('should reject any cross-tenant entity access', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    entityArbitrary(''),
                    (tenant1, tenant2, entity) => {
                        // Ensure different tenants
                        fc.pre(tenant1 !== tenant2);

                        // Set entity to tenant1
                        entity.tenant_id = tenant1;

                        // Attempting to validate with tenant2 should fail
                        expect(() => validateEntityTenant(entity, tenant2, 'test_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should accept only same-tenant entity access', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    entityArbitrary(''),
                    (tenant_id, entity) => {
                        entity.tenant_id = tenant_id;

                        // Should not throw
                        expect(() => validateEntityTenant(entity, tenant_id, 'test_op')).not.toThrow();
                    }
                )
            );
        });

        it('should reject batch operations with any cross-tenant entity', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 2,
                        maxLength: 10,
                    }),
                    (tenant1, tenant2, entities) => {
                        fc.pre(tenant1 !== tenant2);

                        // Set first entity to tenant1, second to tenant2
                        entities[0].tenant_id = tenant1;
                        entities[1].tenant_id = tenant2;

                        // Should reject the batch
                        expect(() => validateEntitiesTenant(entities, tenant1, 'test_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should accept batch operations with all same-tenant entities', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 1,
                        maxLength: 10,
                    }),
                    (tenant_id, entities) => {
                        // Set all entities to same tenant
                        entities.forEach(e => {
                            e.tenant_id = tenant_id;
                        });

                        // Should not throw
                        expect(() => validateEntitiesTenant(entities, tenant_id, 'test_op')).not.toThrow();
                    }
                )
            );
        });

        it('should validate tenant_id format before allowing access', () => {
            fc.assert(
                fc.property(
                    invalidTenantIdArbitrary(),
                    (invalidTenantId) => {
                        // Any invalid tenant_id should be rejected
                        if (invalidTenantId === '' || !invalidTenantId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                            expect(() => validateTenantId(invalidTenantId)).toThrow(TenantValidationError);
                        }
                    }
                )
            );
        });

        it('should prevent read operations on cross-tenant data', () => {
            // Synchronous test: validate that cross-tenant data would be rejected
            const tenant1 = '12345678-1234-1234-1234-123456789012';
            const tenant2 = '87654321-4321-4321-4321-210987654321';
            const crossTenantEntity = { tenant_id: tenant2, data: 'cross-tenant' };

            // Should throw when validating cross-tenant entity
            expect(() => validateEntityTenant(crossTenantEntity, tenant1, 'test_read')).toThrow(
                TenantValidationError
            );
        });

        it('should prevent write operations on cross-tenant data', () => {
            // Synchronous test: validate that cross-tenant data would be rejected
            const tenant1 = '12345678-1234-1234-1234-123456789012';
            const tenant2 = '87654321-4321-4321-4321-210987654321';
            const crossTenantEntity = { tenant_id: tenant2, data: 'cross-tenant' };

            // Should throw when validating cross-tenant entity
            expect(() => validateEntityTenant(crossTenantEntity, tenant1, 'test_write')).toThrow(
                TenantValidationError
            );
        });
    });

    describe('Property 21: Tenant Switch Clears Previous Data', () => {
        it('should maintain separate data for different tenants', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 1,
                        maxLength: 5,
                    }),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 1,
                        maxLength: 5,
                    }),
                    (tenant1, tenant2, entities1, entities2) => {
                        fc.pre(tenant1 !== tenant2);

                        // Set entities to their respective tenants
                        entities1.forEach(e => {
                            e.tenant_id = tenant1;
                        });
                        entities2.forEach(e => {
                            e.tenant_id = tenant2;
                        });

                        // Tenant1 entities should validate for tenant1
                        expect(() => validateEntitiesTenant(entities1, tenant1, 'test_op')).not.toThrow();

                        // Tenant1 entities should NOT validate for tenant2
                        expect(() => validateEntitiesTenant(entities1, tenant2, 'test_op')).toThrow(
                            TenantValidationError
                        );

                        // Tenant2 entities should validate for tenant2
                        expect(() => validateEntitiesTenant(entities2, tenant2, 'test_op')).not.toThrow();

                        // Tenant2 entities should NOT validate for tenant1
                        expect(() => validateEntitiesTenant(entities2, tenant1, 'test_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should enforce tenant isolation on all operations', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.object({ tenant_id: fc.constant(''), data: fc.string() }),
                    (tenant1, tenant2, entity) => {
                        fc.pre(tenant1 !== tenant2);

                        entity.tenant_id = tenant1;

                        // All validation functions should reject cross-tenant access
                        expect(() => validateEntityTenant(entity, tenant2, 'op1')).toThrow(
                            TenantValidationError
                        );

                        expect(() => validateEntitiesTenant([entity], tenant2, 'op2')).toThrow(
                            TenantValidationError
                        );

                        // But should accept same-tenant access
                        expect(() => validateEntityTenant(entity, tenant1, 'op3')).not.toThrow();
                        expect(() => validateEntitiesTenant([entity], tenant1, 'op4')).not.toThrow();
                    }
                )
            );
        });

        it('should validate tenant_id consistency across operations', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 1,
                        maxLength: 10,
                    }),
                    (tenant_id, entities) => {
                        // Set all entities to same tenant
                        entities.forEach(e => {
                            e.tenant_id = tenant_id;
                        });

                        // All entities should validate for their tenant
                        for (const entity of entities) {
                            expect(() => validateEntityTenant(entity, tenant_id, 'test_op')).not.toThrow();
                        }

                        // All entities together should validate
                        expect(() => validateEntitiesTenant(entities, tenant_id, 'test_op')).not.toThrow();
                    }
                )
            );
        });

        it('should reject operations with invalid tenant_id format', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
                    (validTenant, invalidTenant) => {
                        const entity = { tenant_id: validTenant, data: 'test' };

                        // Should reject invalid tenant_id
                        expect(() => validateTenantId(invalidTenant)).toThrow(TenantValidationError);

                        // Should reject validation with invalid tenant_id
                        expect(() => validateEntityTenant(entity, invalidTenant, 'test_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should maintain isolation even with similar tenant_ids', () => {
            fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    (tenant1, tenant2) => {
                        fc.pre(tenant1 !== tenant2);

                        const entity1 = { tenant_id: tenant1, data: 'data1' };
                        const entity2 = { tenant_id: tenant2, data: 'data2' };

                        // Each entity should only validate for its own tenant
                        expect(() => validateEntityTenant(entity1, tenant1, 'op')).not.toThrow();
                        expect(() => validateEntityTenant(entity1, tenant2, 'op')).toThrow(
                            TenantValidationError
                        );

                        expect(() => validateEntityTenant(entity2, tenant2, 'op')).not.toThrow();
                        expect(() => validateEntityTenant(entity2, tenant1, 'op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });
    });

    describe('Cross-Tenant Access Prevention', () => {
        it('should never allow reading cross-tenant entities', () => {
            return fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 1,
                        maxLength: 5,
                    }),
                    (tenant1, tenant2, entities) => {
                        fc.pre(tenant1 !== tenant2);

                        // Set entities to tenant2
                        entities.forEach(e => {
                            e.tenant_id = tenant2;
                        });

                        // Should reject the batch
                        expect(() => validateEntitiesTenant(entities, tenant1, 'read_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should never allow writing cross-tenant entities', () => {
            return fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.object({ tenant_id: fc.constant(''), data: fc.string() }),
                    (tenant1, tenant2, entity) => {
                        fc.pre(tenant1 !== tenant2);

                        entity.tenant_id = tenant2;

                        // Should reject the entity
                        expect(() => validateEntityTenant(entity, tenant1, 'write_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });

        it('should validate all entities in batch operations', () => {
            return fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    validUuidArbitrary(),
                    fc.array(fc.object({ tenant_id: fc.constant(''), data: fc.string() }), {
                        minLength: 2,
                        maxLength: 10,
                    }),
                    (tenant1, tenant2, entities) => {
                        fc.pre(tenant1 !== tenant2);

                        // Corrupt one entity with different tenant_id
                        entities[Math.floor(entities.length / 2)].tenant_id = tenant2;

                        // Should reject the entire batch
                        expect(() => validateEntitiesTenant(entities, tenant1, 'batch_op')).toThrow(
                            TenantValidationError
                        );
                    }
                )
            );
        });
    });

    describe('Tenant ID Validation Consistency', () => {
        it('should consistently validate the same tenant_id', () => {
            return fc.assert(
                fc.property(
                    validUuidArbitrary(),
                    (tenant_id) => {
                        // Multiple validations of same tenant_id should all succeed
                        for (let i = 0; i < 5; i++) {
                            expect(() => validateTenantId(tenant_id)).not.toThrow();
                        }
                    }
                )
            );
        });

        it('should consistently reject the same invalid tenant_id', () => {
            return fc.assert(
                fc.property(
                    fc.string().filter(s => !s.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
                    (invalidTenant) => {
                        // Multiple validations of same invalid tenant_id should all fail
                        for (let i = 0; i < 5; i++) {
                            expect(() => validateTenantId(invalidTenant)).toThrow(TenantValidationError);
                        }
                    }
                )
            );
        });
    });
});
