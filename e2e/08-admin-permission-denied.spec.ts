/**
 * E2E Test: Admin Panel - Permission Denied
 * Tests that non-admin users cannot access admin panel features
 * 
 * Flows tested:
 * - Deny API access for non-admin users
 * - Allow admin users to access all APIs
 */
import { test, expect } from '@playwright/test';
import { authenticateAsAdmin, TEST_PINS } from './helpers/test-utils';

const BASE_URL = 'http://localhost:3000';

// Admin credentials
const ADMIN_PIN = TEST_PINS.ADMIN;

test.describe('Admin Panel - Permission Denied', () => {
  
  test.describe('Non-Admin API Access Denied', () => {
    test('should deny API access to create employee for non-admin users', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test Employee',
          role: 'WAITER',
          pin: '1234',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to create product for non-admin users', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/admin/products`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          sku: 'TEST-SKU',
          name: 'Test Product',
          price_cents: 2500,
          category: 'POLLOS',
          station: 'PARRILLA',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to create promotion for non-admin users', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test Promotion',
          type: 'PERCENT',
          value: 10,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to create driver for non-admin users', async ({ page }) => {
      const response = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Test Driver',
          phone: '987654321',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to update configuration for non-admin users', async ({ page }) => {
      const response = await page.request.put(`${BASE_URL}/api/admin/config`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          key: 'test_key',
          value: 'test_value',
        },
      });

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to delete employee for non-admin users', async ({ page }) => {
      const response = await page.request.delete(`${BASE_URL}/api/admin/employees/dummy-id`);

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to delete product for non-admin users', async ({ page }) => {
      const response = await page.request.delete(`${BASE_URL}/api/admin/products/dummy-id`);

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to delete promotion for non-admin users', async ({ page }) => {
      const response = await page.request.delete(`${BASE_URL}/api/admin/promotions/dummy-id`);

      expect([401, 403]).toContain(response.status());
    });

    test('should deny API access to delete driver for non-admin users', async ({ page }) => {
      const response = await page.request.delete(`${BASE_URL}/api/drivers/dummy-id`);

      expect([401, 403, 405]).toContain(response.status());
    });
  });

  test.describe('Admin API Access Allowed', () => {
    test('should allow admin API access to create employee', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: `Admin Created Employee ${Date.now()}`,
          role: 'WAITER',
          pin: `${Math.floor(Math.random() * 9000) + 1000}`,
        },
      });

      expect([200, 201]).toContain(response.status());
    });

    test('should allow admin API access to create product', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/products`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          sku: `ADMIN-SKU-${Date.now()}`,
          name: 'Admin Created Product',
          price_cents: 2500,
          category: 'POLLOS',
          station: 'PARRILLA',
        },
      });

      expect([200, 201]).toContain(response.status());
    });

    test('should allow admin API access to create promotion', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: 'Admin Created Promotion',
          type: 'PERCENT',
          value: 10,
          starts_at: new Date().toISOString(),
          ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        },
      });

      expect([200, 201]).toContain(response.status());
    });

    test('should allow admin API access to create driver', async ({ page }) => {
      await authenticateAsAdmin(page, ADMIN_PIN);

      const response = await page.request.post(`${BASE_URL}/api/drivers`, {
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          name: `Admin Created Driver ${Date.now()}`,
          phone: '987654321',
        },
      });

      expect([200, 201]).toContain(response.status());
    });
  });
});
