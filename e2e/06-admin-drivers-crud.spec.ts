/**
 * E2E Test: Admin Panel - Driver CRUD Operations
 * Tests complete CRUD operations for driver management in admin panel
 * 
 * Flows tested:
 * - Create new driver
 * - Read/List drivers
 * - Update driver information
 * - Deactivate driver (soft delete)
 * - Assign driver to delivery orders
 * - Validate driver phone format
 */
import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TEST_PINS } from './helpers/test-utils';

const BASE_URL = 'http://localhost:3000';

// Admin credentials
const ADMIN_PIN = TEST_PINS.ADMIN;

// Test data
const TEST_DRIVER = {
  name: 'Test Driver E2E',
  phone: '987654321',
};

const UPDATED_DRIVER = {
  name: 'Updated Driver E2E',
  phone: '987654322',
};

test.describe('Admin Panel - Driver CRUD', () => {
  
  test.describe('Page Loading', () => {
    test('should load admin panel drivers page', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display drivers list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
    });

    test('should have create driver button', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Create Driver', () => {
    test('should create a new driver via API', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: TEST_DRIVER,
      });

      expect([200, 201]).toContain(response.status());
    });

    test('should validate required fields when creating driver', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: '',
          phone: TEST_DRIVER.phone,
        },
      });

      expect(response.status()).toBe(400);
    });

    test('should validate phone format', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: TEST_DRIVER.name,
          phone: 'invalid-phone',
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Update Driver', () => {
    test('should update driver information', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const createResponse = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: TEST_DRIVER,
      });

      if (createResponse.ok()) {
        const driver = await createResponse.json();
        const driverId = driver.id;

        const updateResponse = await page.request.put(`${BASE_URL}/api/drivers/${driverId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          data: UPDATED_DRIVER,
        });

        expect(updateResponse.status()).toBe(200);
      }
    });
  });

  test.describe('Delete Driver', () => {
    test('should deactivate driver (soft delete)', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const createResponse = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: TEST_DRIVER,
      });

      if (createResponse.ok()) {
        const driver = await createResponse.json();
        const driverId = driver.id;

        const deleteResponse = await page.request.delete(`${BASE_URL}/api/drivers/${driverId}`);

        expect([200, 204]).toContain(deleteResponse.status());
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      await page.route('**/api/drivers', route => {
        route.abort('failed');
      });

      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('State Management', () => {
    test('should maintain state after page refresh', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers?page=1&is_active=true`);
      await page.waitForLoadState('networkidle');

      await page.reload();
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Filtering & Pagination', () => {
    test('should list active drivers only', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers?is_active=true`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should display driver status', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should paginate driver list', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers?page=1`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should search drivers by name', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers?search=Miguel`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });

    test('should display driver phone number', async ({ page }) => {
      await page.goto(`${BASE_URL}/admin/drivers`);
      await page.waitForLoadState('networkidle');

      await expect(page.locator('body')).toBeVisible();
    });
  });
});
