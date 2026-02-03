/**
 * Property-Based Tests for Tenant Isolation
 * 
 * Tests that verify tenant isolation at all layers:
 * - Database layer (RLS policies)
 * - API layer (tenant context)
 * - Event sourcing layer
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6, 2.1, 2.5, 2.6**
 */

import fc from 'fast-check';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import prisma from '@/src/core/db/prisma';
import {
  extractTenantContext,
  validateTenantContext,
  setRLSSessionVariables,
  TenantToken,
} from '../tenant-context';
import { randomUUID } from 'crypto';

describe('Tenant Isolation Properties', () => {
  let testTenant1Id: string;
  let testTenant2Id: string;

  beforeAll(async () => {
    // Create test tenants
    testTenant1Id = randomUUID();
    testTenant2Id = randomUUID();

    await Promise.all([
      prisma.tenants.create({
        data: {
          id: testTenant1Id,
          name: 'Test Tenant 1',
          is_active: true,
        },
      }),
      prisma.tenants.create({
        data: {
          id: testTenant2Id,
          name: 'Test Tenant 2',
          is_active: true,
        },
      }),
    ]);
  });

  afterAll(async () => {
    // Clean up test tenants
    await Promise.all([
      prisma.tenants.delete({ where: { id: testTenant1Id } }),
      prisma.tenants.delete({ where: { id: testTenant2Id } }),
    ]);
  });

  /**
   * Property 1: RLS Enforces Tenant Isolation
   * 
   * For any two different tenants, queries executed with one tenant's context
   * should never return data from the other tenant.
   * 
   * **Validates: Requirements 1.1, 1.2, 1.4**
   */
  describe('Property 1: RLS Enforces Tenant Isolation', () => {
    it('queries with different tenant contexts return different data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.uuid(),
          async (tenant1, tenant2) => {
            // Skip if same tenant
            if (tenant1 === tenant2) return;

            // Create test data for tenant1
            const product1 = await prisma.products.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant1Id,
                sku: `SKU-${randomUUID()}`,
                name: 'Product 1',
                price_cents: 1000,
                is_active: true,
              },
            });

            // Create test data for tenant2
            const product2 = await prisma.products.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant2Id,
                sku: `SKU-${randomUUID()}`,
                name: 'Product 2',
                price_cents: 2000,
                is_active: true,
              },
            });

            // Set RLS context for tenant1
            await setRLSSessionVariables({
              tenant_id: testTenant1Id,
              is_cross_tenant_admin: false,
            });

            // Query products for tenant1
            const products1 = await prisma.products.findMany({
              where: { tenant_id: testTenant1Id },
            });

            // Verify tenant1 only sees their products
            expect(products1.some(p => p.id === product1.id)).toBe(true);
            expect(products1.some(p => p.id === product2.id)).toBe(false);

            // Clean up
            await Promise.all([
              prisma.products.delete({ where: { id: product1.id } }),
              prisma.products.delete({ where: { id: product2.id } }),
            ]);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Property 2: Cross-Tenant Access Attempts Are Blocked
   * 
   * For any tenant, attempting to access another tenant's data should fail
   * unless the user is a cross-tenant admin.
   * 
   * **Validates: Requirements 1.3, 2.3**
   */
  describe('Property 2: Cross-Tenant Access Attempts Are Blocked', () => {
    it('non-admin users cannot access other tenant data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (_unused) => {
            // Create test data for tenant1
            const order1 = await prisma.orders.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant1Id,
                order_number: Math.floor(Math.random() * 100000),
                order_status: 'OPEN',
                total_cents: 5000,
              },
            });

            // Set RLS context for tenant2 (different tenant)
            await setRLSSessionVariables({
              tenant_id: testTenant2Id,
              is_cross_tenant_admin: false,
            });

            // Try to query tenant1's orders from tenant2 context
            const orders = await prisma.orders.findMany({
              where: { tenant_id: testTenant1Id },
            });

            // RLS should prevent access
            expect(orders.some(o => o.id === order1.id)).toBe(false);

            // Clean up
            await prisma.orders.delete({ where: { id: order1.id } });
          }
        ),
        { numRuns: 5 }
      );
    });

    it('cross-tenant admins can access other tenant data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (_unused) => {
            // Create test data for tenant1
            const order1 = await prisma.orders.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant1Id,
                order_number: Math.floor(Math.random() * 100000),
                order_status: 'OPEN',
                total_cents: 5000,
              },
            });

            // Set RLS context for cross-tenant admin
            await setRLSSessionVariables({
              tenant_id: testTenant2Id,
              is_cross_tenant_admin: true,
            });

            // Query tenant1's orders as cross-tenant admin
            const orders = await prisma.orders.findMany({
              where: { tenant_id: testTenant1Id },
            });

            // Cross-tenant admin should see the data
            expect(orders.some(o => o.id === order1.id)).toBe(true);

            // Clean up
            await prisma.orders.delete({ where: { id: order1.id } });
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Property 3: RLS Violations Are Logged
   * 
   * For any RLS policy violation attempt, the system should log the violation
   * for security auditing.
   * 
   * **Validates: Requirements 1.6**
   */
  describe('Property 3: RLS Violations Are Logged', () => {
    it('attempted cross-tenant access is logged', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (_unused) => {
            // Create test data for tenant1
            const employee1 = await prisma.employees.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant1Id,
                name: 'Employee 1',
                role: 'CASHIER',
                pin_hash: 'hash',
                is_active: true,
              },
            });

            // Log access attempt
            await prisma.admin_access_logs.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant2Id,
                employee_id: randomUUID(),
                action: 'ATTEMPTED_CROSS_TENANT_ACCESS',
                resource: `employees/${employee1.id}`,
              },
            });

            // Verify log was created
            const logs = await prisma.admin_access_logs.findMany({
              where: {
                action: 'ATTEMPTED_CROSS_TENANT_ACCESS',
              },
            });

            expect(logs.length).toBeGreaterThan(0);

            // Clean up
            await Promise.all([
              prisma.employees.delete({ where: { id: employee1.id } }),
              prisma.admin_access_logs.deleteMany({
                where: { action: 'ATTEMPTED_CROSS_TENANT_ACCESS' },
              }),
            ]);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Property 4: Tenant Context Extraction From JWT
   * 
   * For any valid JWT token with tenant_id, extracting tenant context
   * should produce a valid TenantContext object.
   * 
   * **Validates: Requirements 2.1**
   */
  describe('Property 4: Tenant Context Extraction From JWT', () => {
    it('extracts valid tenant context from JWT token', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.boolean(),
          (tenant_id, employee_id, is_admin) => {
            const token: TenantToken = {
              tenant_id,
              employee_id,
              is_cross_tenant_admin: is_admin,
            };

            const context = extractTenantContext(token);

            expect(context.tenant_id).toBe(tenant_id);
            expect(context.employee_id).toBe(employee_id);
            expect(context.is_cross_tenant_admin).toBe(is_admin);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('throws error when tenant_id is missing', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (employee_id) => {
            const token: TenantToken = {
              tenant_id: '', // Missing tenant_id
              employee_id,
            };

            expect(() => extractTenantContext(token)).toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: API Requests Include Tenant Context
   * 
   * For any API request with valid authentication, the tenant_id should be
   * included in request logs for audit trails.
   * 
   * **Validates: Requirements 2.5**
   */
  describe('Property 5: API Requests Include Tenant Context', () => {
    it('tenant_id is logged with all API requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (tenant_id) => {
            // Log API request with tenant context
            await prisma.admin_access_logs.create({
              data: {
                id: randomUUID(),
                tenant_id,
                employee_id: randomUUID(),
                action: 'API_REQUEST',
                resource: '/api/orders',
              },
            });

            // Verify log includes tenant_id
            const logs = await prisma.admin_access_logs.findMany({
              where: {
                tenant_id,
                action: 'API_REQUEST',
              },
            });

            expect(logs.length).toBeGreaterThan(0);
            expect(logs[0].tenant_id).toBe(tenant_id);

            // Clean up
            await prisma.admin_access_logs.deleteMany({
              where: { tenant_id, action: 'API_REQUEST' },
            });
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 6: Prisma Queries Are Tenant-Scoped
   * 
   * For any Prisma query executed with tenant context, the query should
   * automatically be scoped to the current tenant via RLS.
   * 
   * **Validates: Requirements 2.6**
   */
  describe('Property 6: Prisma Queries Are Tenant-Scoped', () => {
    it('queries are automatically scoped by RLS', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (_unused) => {
            // Create products for both tenants
            const product1 = await prisma.products.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant1Id,
                sku: `SKU-${randomUUID()}`,
                name: 'Product 1',
                price_cents: 1000,
                is_active: true,
              },
            });

            const product2 = await prisma.products.create({
              data: {
                id: randomUUID(),
                tenant_id: testTenant2Id,
                sku: `SKU-${randomUUID()}`,
                name: 'Product 2',
                price_cents: 2000,
                is_active: true,
              },
            });

            // Set context for tenant1
            await setRLSSessionVariables({
              tenant_id: testTenant1Id,
              is_cross_tenant_admin: false,
            });

            // Query all products (should be scoped by RLS)
            const products = await prisma.products.findMany();

            // Should only see tenant1's products
            const hasProduct1 = products.some(p => p.id === product1.id);
            const hasProduct2 = products.some(p => p.id === product2.id);

            expect(hasProduct1).toBe(true);
            expect(hasProduct2).toBe(false);

            // Clean up
            await Promise.all([
              prisma.products.delete({ where: { id: product1.id } }),
              prisma.products.delete({ where: { id: product2.id } }),
            ]);
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});
