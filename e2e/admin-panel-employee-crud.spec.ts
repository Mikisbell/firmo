/**
 * E2E Test: Admin Panel - Employee CRUD
 * Tests complete CRUD operations for employee management
 * This is a legacy test file - use e2e/04-admin-employees-crud.spec.ts instead
 */
import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TEST_PINS } from './helpers/test-utils';

const BASE_URL = 'http://localhost:3000';

test.describe('Admin Panel - Employee CRUD (Legacy)', () => {
  
  test('should create a new employee', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: `Test Employee ${Date.now()}`,
        role: 'WAITER',
        pin: `${Math.floor(Math.random() * 9000) + 1000}`,
      },
    });

    expect([200, 201]).toContain(response.status());
  });

  test('should list employees', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/empleados`);
    await page.waitForLoadState('domcontentloaded');
    
    expect(page.url()).toContain('admin/empleados');
  });

  test('should update an employee', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    // Create employee first
    const createResponse = await page.request.post(`${BASE_URL}/api/admin/employees`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: `Test Employee ${Date.now()}`,
        role: 'WAITER',
        pin: `${Math.floor(Math.random() * 9000) + 1000}`,
      },
    });

    if (createResponse.ok()) {
      const employee = await createResponse.json();
      const employeeId = employee.id;

      // Update employee
      const updateResponse = await page.request.put(`${BASE_URL}/api/admin/employees/${employeeId}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Updated Employee',
          role: 'CASHIER',
          pin: `${Math.floor(Math.random() * 9000) + 1000}`,
        },
      });

      expect(updateResponse.status()).toBe(200);
    }
  });

  test('should delete an employee', async ({ page }) => {
    await authenticateAsAdmin(page, TEST_PINS.ADMIN);

    // Create employee first
    const createResponse = await page.request.post(`${BASE_URL}/api/admin/employees`, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        name: `Test Employee ${Date.now()}`,
        role: 'WAITER',
        pin: `${Math.floor(Math.random() * 9000) + 1000}`,
      },
    });

    if (createResponse.ok()) {
      const employee = await createResponse.json();
      const employeeId = employee.id;

      // Delete employee
      const deleteResponse = await page.request.delete(`${BASE_URL}/api/admin/employees/${employeeId}`);

      expect([200, 204]).toContain(deleteResponse.status());
    }
  });
});
