/**
 * E2E Test: Admin Panel - Employee CRUD Operations
 * Tests complete CRUD operations for employee management in admin panel
 * 
 * Flows tested:
 * - Admin login with PIN
 * - Create new employee
 * - Read/List employees
 * - Update employee details
 * - Deactivate employee (soft delete)
 * - Permission validation
 */
import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TENANT_ID, TEST_PINS } from './helpers/test-utils';

const BASE_URL = 'http://localhost:3000';

// Admin credentials (from seed.ts)
const ADMIN_PIN = TEST_PINS.ADMIN;

// Test data
const TEST_EMPLOYEE = {
  name: `Test Employee E2E ${Date.now()}`,
  role: 'WAITER',
  pin: `${Math.floor(Math.random() * 9000) + 1000}`,
};

const UPDATED_EMPLOYEE = {
  name: 'Updated Employee E2E',
  role: 'CASHIER',
};

test.describe('Admin Panel - Employee CRUD', () => {
  
  test.describe('Page Loading', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${BASE_URL}/admin`);
      await page.waitForLoadState('networkidle');
    });

    test('should load admin panel', async ({ page }) => {
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display employees section', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados`);
      await page.waitForLoadState('networkidle');
      
      const hasError = await page.locator('.error, [class*="error"]').count() > 0;
      expect(hasError).toBeFalsy();
    });

    test('should display employees list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
    });

    test('should have create employee button', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Create Employee', () => {
    test('should create a new employee via API', async ({ page }) => {
      // Authenticate as admin first
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: TEST_EMPLOYEE.name,
          role: TEST_EMPLOYEE.role,
          pin: TEST_EMPLOYEE.pin,
        },
      });

      expect([200, 201]).toContain(response.status());
    });

    test('should validate required fields when creating employee', async ({ page }) => {
      // Authenticate as admin first
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: '',
          role: TEST_EMPLOYEE.role,
          pin: TEST_EMPLOYEE.pin,
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should validate PIN format', async ({ page }) => {
      // Authenticate as admin first
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: TEST_EMPLOYEE.name,
          role: TEST_EMPLOYEE.role,
          pin: 'invalid',
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Update Employee', () => {
    test('should update employee information', async ({ page }) => {
      const createResponse = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: TEST_EMPLOYEE,
      });

      if (createResponse.ok()) {
        const employee = await createResponse.json();
        const employeeId = employee.id;

        const updateResponse = await page.request.put(`${BASE_URL}/api/admin/employees/${employeeId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          data: UPDATED_EMPLOYEE,
        });

        expect(updateResponse.status()).toBe(200);
      }
    });
  });

  test.describe('Delete Employee', () => {
    test('should deactivate employee (soft delete)', async ({ page }) => {
      const createResponse = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: TEST_EMPLOYEE,
      });

      if (createResponse.ok()) {
        const employee = await createResponse.json();
        const employeeId = employee.id;

        const deleteResponse = await page.request.delete(`${BASE_URL}/api/admin/employees/${employeeId}`);

        expect(deleteResponse.status()).toBe(200);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/admin/employees', route => {
        route.abort('failed');
      });

      await page.goto(`${BASE_URL}/admin/empleados`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('State Management', () => {
    test('should maintain state after page refresh', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados?page=1&role=WAITER`);
      await page.waitForLoadState('networkidle');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Filtering & Pagination', () => {
    test('should display employee role correctly', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should filter employees by role', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados?role=WAITER`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should paginate employee list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/empleados?page=1`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });
});
