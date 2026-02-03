/**
 * Property-Based Tests for Tenant-Scoped Login
 * 
 * Tests that verify tenant isolation in authentication layer
 * 
 * **Validates: Requirements 12.1, 12.3, 12.4**
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import {
  validateEmployeeBelongsToTenant,
  validateTokenTenant,
} from '../tenant-login';

// ============================================================================
// Arbitraries for Property Testing
// ============================================================================

const arbUUID = fc.uuid().map(() => randomUUID());

const arbTenantId = arbUUID;

const arbEmployeeId = arbUUID;

const arbRole = fc.constantFrom('CASHIER', 'ADMIN', 'MANAGER', 'WAITER');

// ============================================================================
// Property 16: Login Validates Tenant Membership
// ============================================================================

describe('Property 16: Login Validates Tenant Membership', () => {
  /**
   * **Validates: Requirements 12.1**
   * 
   * For any employee that belongs to a tenant, validation should succeed.
   */
  it('accepts login for employee belonging to tenant', async () => {
    // Setup: Create test tenant and employee once
    const tenant_id = randomUUID();
    const employee_id = randomUUID();

    await prisma.tenants.create({
      data: {
        id: tenant_id,
        name: 'Test Tenant',
      },
    });

    await prisma.tenant_settings.create({
      data: {
        tenant_id,
        legal_name: 'Test Tenant',
        timezone: 'America/Lima',
        currency: 'PEN',
      },
    });

    const employee = await prisma.employees.create({
      data: {
        id: employee_id,
        tenant_id,
        name: 'Test Employee',
        role: 'CASHIER',
        pin_hash: 'test_hash',
        is_active: true,
      },
    });

    try {
      // Test: Property-based test with pre-created data
      await fc.assert(
        fc.asyncProperty(arbRole, async (role) => {
          // Update employee role
          await prisma.employees.update({
            where: { id: employee_id },
            data: { role },
          });

          const result = await validateEmployeeBelongsToTenant(employee_id, tenant_id);
          expect(result.valid).toBe(true);
        }),
        { numRuns: 4 } // Test with 4 different roles
      );
    } finally {
      // Cleanup
      await prisma.employees.delete({ where: { id: employee_id } });
      await prisma.tenant_settings.delete({ where: { tenant_id } });
      await prisma.tenants.delete({ where: { id: tenant_id } });
    }
  });

  /**
   * **Validates: Requirements 12.1**
   * 
   * For any employee that does NOT belong to a tenant, validation should fail.
   */
  it('rejects login for employee from different tenant', async () => {
    // Setup: Create two tenants and employees
    const tenant1_id = randomUUID();
    const tenant2_id = randomUUID();
    const employee_id = randomUUID();

    await prisma.tenants.createMany({
      data: [
        { id: tenant1_id, name: 'Tenant 1' },
        { id: tenant2_id, name: 'Tenant 2' },
      ],
    });

    await prisma.tenant_settings.createMany({
      data: [
        {
          tenant_id: tenant1_id,
          legal_name: 'Tenant 1',
          timezone: 'America/Lima',
          currency: 'PEN',
        },
        {
          tenant_id: tenant2_id,
          legal_name: 'Tenant 2',
          timezone: 'America/Lima',
          currency: 'PEN',
        },
      ],
    });

    const employee = await prisma.employees.create({
      data: {
        id: employee_id,
        tenant_id: tenant1_id,
        name: 'Test Employee',
        role: 'CASHIER',
        pin_hash: 'test_hash',
        is_active: true,
      },
    });

    try {
      // Test: Verify rejection for different tenant
      const result = await validateEmployeeBelongsToTenant(employee_id, tenant2_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('does not belong to tenant');
    } finally {
      // Cleanup
      await prisma.employees.delete({ where: { id: employee_id } });
      await prisma.tenant_settings.deleteMany({
        where: { tenant_id: { in: [tenant1_id, tenant2_id] } },
      });
      await prisma.tenants.deleteMany({
        where: { id: { in: [tenant1_id, tenant2_id] } },
      });
    }
  });

  /**
   * **Validates: Requirements 12.1**
   * 
   * For any inactive employee, validation should fail.
   */
  it('rejects login for inactive employees', async () => {
    // Setup: Create test tenant and inactive employee
    const tenant_id = randomUUID();
    const employee_id = randomUUID();

    await prisma.tenants.create({
      data: {
        id: tenant_id,
        name: 'Test Tenant',
      },
    });

    await prisma.tenant_settings.create({
      data: {
        tenant_id,
        legal_name: 'Test Tenant',
        timezone: 'America/Lima',
        currency: 'PEN',
      },
    });

    const employee = await prisma.employees.create({
      data: {
        id: employee_id,
        tenant_id,
        name: 'Test Employee',
        role: 'CASHIER',
        pin_hash: 'test_hash',
        is_active: false, // Inactive
      },
    });

    try {
      // Test: Verify rejection for inactive employee
      const result = await validateEmployeeBelongsToTenant(employee_id, tenant_id);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('inactive');
    } finally {
      // Cleanup
      await prisma.employees.delete({ where: { id: employee_id } });
      await prisma.tenant_settings.delete({ where: { tenant_id } });
      await prisma.tenants.delete({ where: { id: tenant_id } });
    }
  });
});

// ============================================================================
// Property 17: Token Tenant Mismatch Is Rejected
// ============================================================================

describe('Property 17: Token Tenant Mismatch Is Rejected', () => {
  /**
   * **Validates: Requirements 12.3, 12.4**
   * 
   * For any token with tenant_id matching the requested resource,
   * validation should succeed.
   */
  it('accepts token when tenant_id matches requested resource', async () => {
    await fc.assert(
      fc.asyncProperty(arbTenantId, async (tenant_id) => {
        const result = await validateTokenTenant(tenant_id, tenant_id);
        expect(result.valid).toBe(true);
      })
    );
  });

  /**
   * **Validates: Requirements 12.3, 12.4**
   * 
   * For any token with tenant_id NOT matching the requested resource,
   * validation should fail.
   */
  it('rejects token when tenant_id does not match requested resource', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(arbTenantId, arbTenantId),
        async ([token_tenant_id, requested_tenant_id]) => {
          fc.pre(token_tenant_id !== requested_tenant_id);

          const result = await validateTokenTenant(token_tenant_id, requested_tenant_id);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('does not match');
        }
      )
    );
  });

  /**
   * **Validates: Requirements 12.4**
   * 
   * For any token, it should not be reusable across different tenants.
   */
  it('prevents token reuse across different tenants', async () => {
    // Setup: Create two tenants
    const tenant1_id = randomUUID();
    const tenant2_id = randomUUID();

    await fc.assert(
      fc.asyncProperty(arbEmployeeId, async (employee_id) => {
        // Create tenants
        await prisma.tenants.createMany({
          data: [
            { id: tenant1_id, name: 'Tenant 1' },
            { id: tenant2_id, name: 'Tenant 2' },
          ],
        });

        // Create employee in tenant1
        await prisma.tenant_settings.create({
          data: {
            tenant_id: tenant1_id,
            legal_name: 'Tenant 1',
            timezone: 'America/Lima',
            currency: 'PEN',
          },
        });

        await prisma.employees.create({
          data: {
            id: employee_id,
            tenant_id: tenant1_id,
            name: 'Test Employee',
            role: 'CASHIER',
            pin_hash: 'test_hash',
            is_active: true,
          },
        });

        // Verify token from tenant1 is rejected for tenant2
        const result = await validateTokenTenant(tenant1_id, tenant2_id);
        expect(result.valid).toBe(false);

        // Cleanup
        await prisma.employees.delete({ where: { id: employee_id } });
        await prisma.tenant_settings.delete({ where: { tenant_id: tenant1_id } });
        await prisma.tenants.deleteMany({
          where: { id: { in: [tenant1_id, tenant2_id] } },
        });
      }),
      { numRuns: 5 } // Reduce iterations for speed
    );
  });
});
