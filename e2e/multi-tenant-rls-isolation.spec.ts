/**
 * E2E Tests: Multi-Tenant RLS Isolation
 * 
 * Validates that RLS policies are enforced through the UI
 * Ensures tenants cannot access each other's data
 * 
 * Run: npm run test:e2e -- e2e/multi-tenant-rls-isolation.spec.ts
 * 
 * Prerequisites:
 * - Two tenants must be provisioned with different admin PINs
 * - Each tenant must have at least one employee and one product
 * - Test data should be seeded via provisioning API
 */

import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, logoutFromAdmin } from './helpers/test-utils';

test.describe('Multi-Tenant RLS Isolation E2E', () => {
  const baseURL = 'http://localhost:3000';
  
  // Test data - these should be provisioned before running tests
  // Run: npx tsx scripts/provision-e2e-test-tenants.ts
  const tenant1 = {
    id: '11111111-1111-1111-1111-111111111111',
    adminPin: '1111',
    name: 'Pollería Test 1',
  };
  
  const tenant2 = {
    id: '22222222-2222-2222-2222-222222222222',
    adminPin: '2222',
    name: 'Pollería Test 2',
  };

  test('✅ RLS: Tenant 1 cannot see Tenant 2 employees', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to employees page (Spanish route)
    await page.goto(`${baseURL}/admin/empleados`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="employee-row"]', { timeout: 10000 });

    // Get list of employees for Tenant 1
    const tenant1Employees = page.locator('[data-testid="employee-row"]');
    const tenant1Count = await tenant1Employees.count();

    // Verify we see Tenant 1 employees
    expect(tenant1Count).toBeGreaterThan(0);

    // Get employee names visible
    const tenant1Names = await page.locator('[data-testid="employee-name"]').allTextContents();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to employees page (Spanish route)
    await page.goto(`${baseURL}/admin/empleados`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="employee-row"]', { timeout: 10000 });

    // Get list of employees for Tenant 2
    const tenant2Employees = page.locator('[data-testid="employee-row"]');
    const tenant2Count = await tenant2Employees.count();

    // Verify we see Tenant 2 employees
    expect(tenant2Count).toBeGreaterThan(0);

    // Get employee names visible
    const tenant2Names = await page.locator('[data-testid="employee-name"]').allTextContents();

    // Verify that Tenant 2 does NOT see Tenant 1's employees
    for (const name of tenant1Names) {
      expect(tenant2Names).not.toContain(name);
    }
  });

  test('✅ RLS: Tenant 1 cannot see Tenant 2 products', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to products page (Spanish route)
    await page.goto(`${baseURL}/admin/productos`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="product-row"]', { timeout: 10000 });

    // Get list of products for Tenant 1
    const tenant1Products = page.locator('[data-testid="product-row"]');
    const tenant1Count = await tenant1Products.count();

    // Verify we see Tenant 1 products
    expect(tenant1Count).toBeGreaterThan(0);

    // Get product names visible
    const tenant1Names = await page.locator('[data-testid="product-name"]').allTextContents();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to products page (Spanish route)
    await page.goto(`${baseURL}/admin/productos`);

    // Wait for data to load
    await page.waitForSelector('[data-testid="product-row"]', { timeout: 10000 });

    // Get list of products for Tenant 2
    const tenant2Products = page.locator('[data-testid="product-row"]');
    const tenant2Count = await tenant2Products.count();

    // Verify we see Tenant 2 products
    expect(tenant2Count).toBeGreaterThan(0);

    // Get product names visible
    const tenant2Names = await page.locator('[data-testid="product-name"]').allTextContents();

    // Verify that Tenant 2 does NOT see Tenant 1's products
    for (const name of tenant1Names) {
      expect(tenant2Names).not.toContain(name);
    }
  });

  test('✅ RLS: Tenant 1 cannot see Tenant 2 orders', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to reportes page (Spanish route)
    await page.goto(`${baseURL}/admin/reportes`);

    // Get list of orders for Tenant 1
    const tenant1Orders = page.locator('[data-testid="order-row"]');
    const tenant1Count = await tenant1Orders.count();

    // Get order IDs visible
    const tenant1OrderIds = await page.locator('[data-testid="order-id"]').allTextContents();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to reportes page (Spanish route)
    await page.goto(`${baseURL}/admin/reportes`);

    // Get list of orders for Tenant 2
    const tenant2Orders = page.locator('[data-testid="order-row"]');
    const tenant2Count = await tenant2Orders.count();

    // Get order IDs visible
    const tenant2OrderIds = await page.locator('[data-testid="order-id"]').allTextContents();

    // Verify that Tenant 2 does NOT see Tenant 1's orders
    for (const orderId of tenant1OrderIds) {
      expect(tenant2OrderIds).not.toContain(orderId);
    }
  });

  test('✅ RLS: Tenant 1 cannot access Tenant 2 employee via direct URL', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to access a Tenant 2 employee directly (Spanish route)
    await page.goto(`${baseURL}/admin/empleados/tenant-2-employee-id`, { waitUntil: 'networkidle' });

    // Should either be redirected or show error
    const currentUrl = page.url();
    const isError = page.locator('text=/403|404|Not Found|Unauthorized/');
    const isRedirected = !currentUrl.includes('tenant-2-employee-id');

    const hasError = await isError.isVisible().catch(() => false);
    expect(hasError || isRedirected).toBeTruthy();
  });

  test('✅ RLS: Tenant 1 cannot access Tenant 2 product via direct URL', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to access a Tenant 2 product directly (Spanish route)
    await page.goto(`${baseURL}/admin/productos/tenant-2-product-id`, { waitUntil: 'networkidle' });

    // Should either be redirected or show error
    const currentUrl = page.url();
    const isError = page.locator('text=/403|404|Not Found|Unauthorized/');
    const isRedirected = !currentUrl.includes('tenant-2-product-id');

    const hasError = await isError.isVisible().catch(() => false);
    expect(hasError || isRedirected).toBeTruthy();
  });

  test('✅ RLS: Tenant 1 cannot edit Tenant 2 employee via API', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to edit a Tenant 2 employee via API
    const response = await page.request.put(`${baseURL}/api/admin/employees/tenant-2-employee-id`, {
      data: {
        name: 'Hacked Name',
      },
    });

    // Should return 403 or 404
    expect([403, 404, 401]).toContain(response.status());
  });

  test('✅ RLS: Tenant 1 cannot delete Tenant 2 product via API', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to delete a Tenant 2 product via API
    const response = await page.request.delete(`${baseURL}/api/admin/products/tenant-2-product-id`);

    // Should return 403 or 404
    expect([403, 404, 401]).toContain(response.status());
  });

  test('✅ RLS: Tenant 1 cannot create employee for Tenant 2', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to create employee for Tenant 2 via API
    const response = await page.request.post(`${baseURL}/api/admin/employees`, {
      data: {
        name: 'Hacked Employee',
        pin: '9999',
        tenant_id: tenant2.id,
      },
    });

    // Should either fail or create for Tenant 1 instead
    if (response.ok()) {
      const data = await response.json();
      // If it succeeds, it should be for Tenant 1, not Tenant 2
      expect(data.tenant_id).toBe(tenant1.id);
    } else {
      expect([403, 404, 401, 400]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant 1 cannot view Tenant 2 analytics', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to dashboard (Spanish route)
    await page.goto(`${baseURL}/admin/dashboard`);

    // Get Tenant 1 analytics data
    const tenant1Revenue = await page.locator('[data-testid="total-revenue"]').textContent();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to dashboard (Spanish route)
    await page.goto(`${baseURL}/admin/dashboard`);

    // Get Tenant 2 analytics data
    const tenant2Revenue = await page.locator('[data-testid="total-revenue"]').textContent();

    // Verify they are different
    expect(tenant1Revenue).not.toBe(tenant2Revenue);
  });

  test('✅ RLS: Tenant 1 cannot view Tenant 2 audit logs', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to audit logs (Spanish route)
    await page.goto(`${baseURL}/admin/auditoria`);

    // Get Tenant 1 audit logs
    const tenant1LogEntries = await page.locator('[data-testid="audit-log-entry"]').allTextContents();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to audit logs (Spanish route)
    await page.goto(`${baseURL}/admin/auditoria`);

    // Get Tenant 2 audit logs
    const tenant2LogEntries = await page.locator('[data-testid="audit-log-entry"]').allTextContents();

    // Verify that Tenant 2 does NOT see Tenant 1's audit logs
    for (const entry of tenant1LogEntries) {
      expect(tenant2LogEntries).not.toContain(entry);
    }
  });

  test('✅ RLS: Tenant 1 cannot view Tenant 2 settings', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to settings (Spanish route)
    await page.goto(`${baseURL}/admin/configuracion`);

    // Get Tenant 1 settings
    const tenant1Name = await page.locator('[data-testid="tenant-name"]').textContent();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to settings (Spanish route)
    await page.goto(`${baseURL}/admin/configuracion`);

    // Get Tenant 2 settings
    const tenant2Name = await page.locator('[data-testid="tenant-name"]').textContent();

    // Verify they are different
    expect(tenant1Name).not.toBe(tenant2Name);
  });

  test('✅ RLS: Cross-tenant API calls are blocked', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to fetch Tenant 2's employees via API
    const response = await page.request.get(`${baseURL}/api/admin/employees?tenant_id=${tenant2.id}`);

    // Should either return empty or fail
    if (response.ok()) {
      const data = await response.json();
      // Should return empty array or only Tenant 1 employees
      expect(Array.isArray(data)).toBeTruthy();
      // If it returns data, it should be for Tenant 1
      if (data.length > 0) {
        expect(data[0].tenant_id).toBe(tenant1.id);
      }
    } else {
      expect([403, 404, 401]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant switching clears previous tenant data', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to employees (Spanish route)
    await page.goto(`${baseURL}/admin/empleados`);

    // Get Tenant 1 employees
    const tenant1Employees = await page.locator('[data-testid="employee-name"]').allTextContents();

    // Logout
    await page.click('button:has-text("Cerrar Sesión")');

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to employees (Spanish route)
    await page.goto(`${baseURL}/admin/empleados`);

    // Get Tenant 2 employees
    const tenant2Employees = await page.locator('[data-testid="employee-name"]').allTextContents();

    // Verify they are different
    expect(tenant1Employees).not.toEqual(tenant2Employees);

    // Logout and re-authenticate as Tenant 1
    await logoutFromAdmin(page);
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to employees (Spanish route)
    await page.goto(`${baseURL}/admin/empleados`);

    // Get Tenant 1 employees again
    const tenant1EmployeesAgain = await page.locator('[data-testid="employee-name"]').allTextContents();

    // Verify we're back to Tenant 1 data
    expect(tenant1EmployeesAgain).toEqual(tenant1Employees);
  });

  test('✅ RLS: Tenant 1 cannot bulk import data for Tenant 2', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to bulk import with Tenant 2 ID
    const response = await page.request.post(`${baseURL}/api/admin/bulk-import`, {
      data: {
        tenant_id: tenant2.id,
        data: [
          { name: 'Hacked Product', price: 100 },
        ],
      },
    });

    // Should fail or import for Tenant 1 instead
    if (response.ok()) {
      const data = await response.json();
      // If it succeeds, it should be for Tenant 1
      expect(data.tenant_id).toBe(tenant1.id);
    } else {
      expect([403, 404, 401, 400]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant 1 cannot export Tenant 2 data', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to export Tenant 2 data
    const response = await page.request.post(`${baseURL}/api/tenant/export`, {
      data: {
        tenant_id: tenant2.id,
        format: 'json',
      },
    });

    // Should fail
    expect([403, 404, 401, 400]).toContain(response.status());
  });

  test('✅ RLS: Tenant 1 cannot restore Tenant 2 backup', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to restore Tenant 2 backup
    const response = await page.request.post(`${baseURL}/api/tenant/restore`, {
      data: {
        tenant_id: tenant2.id,
        backup_id: 'some-backup-id',
      },
    });

    // Should fail
    expect([403, 404, 401, 400]).toContain(response.status());
  });

  test('✅ RLS: Tenant 1 cannot modify Tenant 2 configuration', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to modify Tenant 2 configuration
    const response = await page.request.put(`${baseURL}/api/tenant/configuration`, {
      data: {
        tenant_id: tenant2.id,
        timezone: 'America/New_York',
      },
    });

    // Should fail or modify Tenant 1 instead
    if (response.ok()) {
      const data = await response.json();
      // If it succeeds, it should be for Tenant 1
      expect(data.tenant_id).toBe(tenant1.id);
    } else {
      expect([403, 404, 401, 400]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant 1 cannot view Tenant 2 quotas', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to view Tenant 2 quotas
    const response = await page.request.get(`${baseURL}/api/admin/quotas?tenant_id=${tenant2.id}`);

    // Should fail or return empty
    if (response.ok()) {
      const data = await response.json();
      // Should return empty or only Tenant 1 quotas
      expect(Array.isArray(data)).toBeTruthy();
      if (data.length > 0) {
        expect(data[0].tenant_id).toBe(tenant1.id);
      }
    } else {
      expect([403, 404, 401]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant 1 cannot modify Tenant 2 quotas', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to modify Tenant 2 quotas
    const response = await page.request.put(`${baseURL}/api/admin/quotas/tenant-2-quota-id`, {
      data: {
        limit: 1000,
      },
    });

    // Should fail
    expect([403, 404, 401]).toContain(response.status());
  });
});

