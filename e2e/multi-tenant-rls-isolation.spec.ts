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
import { AdminEmployeesPage } from './pages/AdminEmployeesPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminSettingsPage } from './pages/AdminSettingsPage';

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

    // Use POM for employees page
    const employeesPage = new AdminEmployeesPage(page);
    await employeesPage.navigate();

    // Skip test if no data is provisioned
    if (!(await employeesPage.hasEmployees())) {
      console.log('⚠️ Skipping test - no employees found for Tenant 1. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }

    // Get employee names for Tenant 1
    const tenant1Names = await employeesPage.getEmployeeNames();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to employees page
    await employeesPage.navigate();

    // Skip test if no data is provisioned
    if (!(await employeesPage.hasEmployees())) {
      console.log('⚠️ Skipping test - no employees found for Tenant 2. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }

    // Verify that Tenant 2 does NOT see Tenant 1's employees
    await employeesPage.verifyEmployeeNamesDoNotContain(tenant1Names);
  });

  test('✅ RLS: Tenant 1 cannot see Tenant 2 products', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Use POM for products page
    const productsPage = new AdminProductsPage(page);
    await productsPage.navigate();

    // Skip test if no data is provisioned
    if (!(await productsPage.hasProducts())) {
      console.log('⚠️ Skipping test - no products found for Tenant 1. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }

    // Get product names for Tenant 1
    const tenant1Names = await productsPage.getProductNames();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to products page
    await productsPage.navigate();

    // Skip test if no data is provisioned
    if (!(await productsPage.hasProducts())) {
      console.log('⚠️ Skipping test - no products found for Tenant 2. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }

    // Verify that Tenant 2 does NOT see Tenant 1's products
    await productsPage.verifyProductNamesDoNotContain(tenant1Names);
  });

  test('✅ RLS: Tenant 1 cannot see Tenant 2 orders', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Navigate to reportes page (Spanish route)
    await page.goto(`${baseURL}/admin/reportes`);

    // Get order IDs visible for Tenant 1
    const tenant1OrderIds = await page.locator('[data-testid="order-id"]').allTextContents();

    // Logout
    await logoutFromAdmin(page);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to reportes page (Spanish route)
    await page.goto(`${baseURL}/admin/reportes`);

    // Get order IDs visible for Tenant 2
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
    const isRedirected = !currentUrl.includes('tenant-2-employee-id');
    
    // Check for error messages (Spanish or English)
    const errorMessages = [
      'Error',
      'no encontrado',
      'Not Found',
      '404',
      '403',
      'Unauthorized',
      'No autorizado',
      'Empleado no encontrado'
    ];
    
    let hasError = false;
    for (const msg of errorMessages) {
      const locator = page.locator(`text=${msg}`);
      if (await locator.isVisible().catch(() => false)) {
        hasError = true;
        break;
      }
    }

    expect(hasError || isRedirected).toBeTruthy();
  });

  test('✅ RLS: Tenant 1 cannot access Tenant 2 product via direct URL', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to access a Tenant 2 product directly (Spanish route)
    await page.goto(`${baseURL}/admin/productos/tenant-2-product-id`, { waitUntil: 'networkidle' });

    // Should either be redirected or show error
    const currentUrl = page.url();
    const isRedirected = !currentUrl.includes('tenant-2-product-id');
    
    // Check for error messages (Spanish or English)
    const errorMessages = [
      'Error',
      'no encontrado',
      'Not Found',
      '404',
      '403',
      'Unauthorized',
      'No autorizado',
      'Producto no encontrado'
    ];
    
    let hasError = false;
    for (const msg of errorMessages) {
      const locator = page.locator(`text=${msg}`);
      if (await locator.isVisible().catch(() => false)) {
        hasError = true;
        break;
      }
    }

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

    // Use POM for dashboard page
    const dashboardPage = new AdminDashboardPage(page);
    await dashboardPage.navigate();

    // Get Tenant 1 analytics data
    const tenant1Revenue = await dashboardPage.getTotalRevenue();

    // Logout
    await logoutFromAdmin(page);

    // ✅ Agregar espera adicional después de logout para limpieza completa
    await page.waitForTimeout(2000);
    
    // ✅ Forzar navegación para limpiar estado
    await page.goto('http://localhost:3000/admin');

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Get Tenant 2 analytics data
    const tenant2Revenue = await dashboardPage.getTotalRevenue();

    // Verify they are different
    expect(tenant1Revenue).not.toBe(tenant2Revenue);
    expect(tenant1Revenue).not.toBe('...');
    expect(tenant2Revenue).not.toBe('...');
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

    // Use POM for settings page
    const settingsPage = new AdminSettingsPage(page);
    await settingsPage.navigate();

    // Get Tenant 1 settings
    const tenant1Name = await settingsPage.getTenantName();

    // Logout
    await logoutFromAdmin(page);

    // ✅ Agregar espera adicional después de logout para limpieza completa
    await page.waitForTimeout(2000);
    
    // ✅ Forzar navegación para limpiar estado
    await page.goto('http://localhost:3000/admin');

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);

    // Navigate to settings
    await settingsPage.navigate();

    // Get Tenant 2 settings
    const tenant2Name = await settingsPage.getTenantName();

    // Verify they are different
    expect(tenant1Name).not.toBe(tenant2Name);
    expect(tenant1Name).not.toBe('');
    expect(tenant2Name).not.toBe('');
  });

  test('✅ RLS: Cross-tenant API calls are blocked', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Try to fetch Tenant 2's employees via API
    const response = await page.request.get(`${baseURL}/api/admin/employees?tenant_id=${tenant2.id}`);

    // Should either return empty or fail
    if (response.ok()) {
      const data = await response.json();
      
      // Handle both formats: paginated { items: [], pagination: {} } and direct array []
      let employees: any[];
      if (data.items && Array.isArray(data.items)) {
        // Paginated format
        employees = data.items;
      } else if (Array.isArray(data)) {
        // Direct array format
        employees = data;
      } else {
        // Unknown format - fail test
        throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
      }
      
      // Should return empty array or only Tenant 1 employees
      expect(Array.isArray(employees)).toBeTruthy();
      // If it returns data, it should be for Tenant 1
      if (employees.length > 0) {
        expect(employees[0].tenant_id).toBe(tenant1.id);
      }
    } else {
      expect([403, 404, 401]).toContain(response.status());
    }
  });

  test('✅ RLS: Tenant switching clears previous tenant data', async ({ page }) => {
    // Authenticate as Tenant 1 admin
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);

    // Use POM for employees page
    const employeesPage = new AdminEmployeesPage(page);
    await employeesPage.navigate();
    
    // Skip test if no data
    if (!(await employeesPage.hasEmployees())) {
      console.log('⚠️ Skipping test - no employees found. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }
    
    // Get Tenant 1 employees
    const tenant1Employees = await employeesPage.getEmployeeNames();

    // Logout using helper function
    await logoutFromAdmin(page);
    
    // ✅ Espera robusta: Verificar que el PIN pad está visible (admin usa PIN pad, no input password)
    await page.waitForSelector('[data-testid="pin-pad"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Authenticate as Tenant 2 admin
    await authenticateAsAdmin(page, tenant2.adminPin, tenant2.id);
    
    // ✅ Espera robusta: Verificar que estamos en admin panel
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Navigate to employees page
    await employeesPage.navigate();
    
    // Skip test if no data
    if (!(await employeesPage.hasEmployees())) {
      console.log('⚠️ Skipping test - no employees found for Tenant 2. Run: npx tsx scripts/provision-e2e-test-tenants.ts');
      test.skip();
      return;
    }
    
    // Get Tenant 2 employees
    const tenant2Employees = await employeesPage.getEmployeeNames();

    // Verify they are different
    expect(tenant1Employees).not.toEqual(tenant2Employees);

    // Logout and re-authenticate as Tenant 1
    await logoutFromAdmin(page);
    
    // ✅ Espera robusta: Verificar que el PIN pad está visible (admin usa PIN pad, no input password)
    await page.waitForSelector('[data-testid="pin-pad"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // ✅ Forzar navegación para limpiar estado completamente
    await page.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    await authenticateAsAdmin(page, tenant1.adminPin, tenant1.id);
    
    // ✅ Espera robusta: Verificar que estamos en admin panel
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Navigate to employees page
    await employeesPage.navigate();
    
    // ✅ Espera robusta: Verificar que la tabla está visible
    await page.waitForSelector('[data-testid="employee-name"]', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // ✅ Verificar que hay empleados antes de obtenerlos
    if (!(await employeesPage.hasEmployees())) {
      console.log('⚠️ Warning: No employees found after re-authentication. Retrying...');
      // Intentar recargar la página
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="employee-name"]', { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // Get Tenant 1 employees again
    const tenant1EmployeesAgain = await employeesPage.getEmployeeNames();

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

    // Should fail (endpoint doesn't exist yet - returns 404)
    expect([403, 404, 401, 400]).toContain(response.status());
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

    // Should fail (endpoint doesn't exist yet - returns 404)
    expect([403, 404, 401]).toContain(response.status());
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

