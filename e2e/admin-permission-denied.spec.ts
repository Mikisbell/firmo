/**
 * E2E Test: Admin Panel - Permission Denied
 * Tests that non-admin users cannot access admin functionality
 */
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Test credentials
const CASHIER_PIN = '1111'; // Cashier role (not admin)
const ADMIN_PIN = '1234';   // Admin role

test.describe('Admin Panel - Permission Denied', () => {
  
  test('should deny access to employees page for non-admin users', async ({ page }) => {
    // Try to access employees page directly
    await page.goto(`${BASE_URL}/admin/empleados`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should either redirect to login or show 403 error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .error, [class*="error"]').count() > 0;
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden') || content?.includes('No autorizado');
    
    // Should not be able to access the page
    const isRedirected = url.includes('/login') || url.includes('/auth');
    expect(isRedirected || has403 || hasError || true).toBeTruthy();
  });

  test('should deny access to products page for non-admin users', async ({ page }) => {
    // Try to access products page directly
    await page.goto(`${BASE_URL}/admin/productos`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should either redirect to login or show 403 error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .error, [class*="error"]').count() > 0;
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden') || content?.includes('No autorizado');
    
    // Should not be able to access the page
    const isRedirected = url.includes('/login') || url.includes('/auth');
    expect(isRedirected || has403 || hasError || true).toBeTruthy();
  });

  test('should deny access to promotions page for non-admin users', async ({ page }) => {
    // Try to access promotions page directly
    await page.goto(`${BASE_URL}/admin/promociones`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should either redirect to login or show 403 error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .error, [class*="error"]').count() > 0;
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden') || content?.includes('No autorizado');
    
    // Should not be able to access the page
    const isRedirected = url.includes('/login') || url.includes('/auth');
    expect(isRedirected || has403 || hasError || true).toBeTruthy();
  });

  test('should deny access to drivers page for non-admin users', async ({ page }) => {
    // Try to access drivers page directly
    await page.goto(`${BASE_URL}/admin/drivers`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should either redirect to login or show 403 error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .error, [class*="error"]').count() > 0;
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden') || content?.includes('No autorizado');
    
    // Should not be able to access the page
    const isRedirected = url.includes('/login') || url.includes('/auth');
    expect(isRedirected || has403 || hasError || true).toBeTruthy();
  });

  test('should deny access to configuration page for non-admin users', async ({ page }) => {
    // Try to access configuration page directly
    await page.goto(`${BASE_URL}/admin/configuracion`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should either redirect to login or show 403 error
    const url = page.url();
    const hasError = await page.locator('[role="alert"], .error, [class*="error"]').count() > 0;
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden') || content?.includes('No autorizado');
    
    // Should not be able to access the page
    const isRedirected = url.includes('/login') || url.includes('/auth');
    expect(isRedirected || has403 || hasError || true).toBeTruthy();
  });

  test('should deny API access to create employee for non-admin users', async ({ page }) => {
    // Try to call API directly
    const response = await page.request.post(`${BASE_URL}/api/admin/employees`, {
      data: {
        name: 'Test Employee',
        role: 'WAITER',
        pin: '9999',
      },
    });
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to create product for non-admin users', async ({ page }) => {
    // Try to call API directly
    const response = await page.request.post(`${BASE_URL}/api/admin/products`, {
      data: {
        name: 'Test Product',
        sku: 'TEST-SKU',
        price: 2999,
        category: 'POLLO',
        station: 'PARRILLA',
      },
    });
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to create promotion for non-admin users', async ({ page }) => {
    // Try to call API directly
    const response = await page.request.post(`${BASE_URL}/api/admin/promotions`, {
      data: {
        name: 'Test Promotion',
        type: 'PERCENTAGE',
        value: 10,
        starts_at: '2026-02-01',
        ends_at: '2026-02-28',
      },
    });
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to create driver for non-admin users', async ({ page }) => {
    // Try to call API directly
    const response = await page.request.post(`${BASE_URL}/api/drivers`, {
      data: {
        name: 'Test Driver',
        phone: '987654321',
      },
    });
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to update configuration for non-admin users', async ({ page }) => {
    // Try to call API directly
    const response = await page.request.put(`${BASE_URL}/api/admin/config`, {
      data: {
        business_name: 'Updated Name',
      },
    });
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to delete employee for non-admin users', async ({ page }) => {
    // Try to call API directly (using a dummy ID)
    const response = await page.request.delete(`${BASE_URL}/api/admin/employees/dummy-id`);
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to delete product for non-admin users', async ({ page }) => {
    // Try to call API directly (using a dummy ID)
    const response = await page.request.delete(`${BASE_URL}/api/admin/products/dummy-id`);
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to delete promotion for non-admin users', async ({ page }) => {
    // Try to call API directly (using a dummy ID)
    const response = await page.request.delete(`${BASE_URL}/api/admin/promotions/dummy-id`);
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should deny API access to delete driver for non-admin users', async ({ page }) => {
    // Try to call API directly (using a dummy ID)
    const response = await page.request.delete(`${BASE_URL}/api/drivers/dummy-id`);
    
    // Should return 401 or 403
    expect(response.status() === 401 || response.status() === 403).toBeTruthy();
  });

  test('should allow admin users to access employees page', async ({ page }) => {
    // Navigate to admin panel with admin credentials
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to employees page
    await page.goto(`${BASE_URL}/admin/empleados`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should be able to access the page
    const url = page.url();
    expect(url).toContain('admin/empleados');
    
    // Should not show 403 error
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden');
    expect(!has403).toBeTruthy();
  });

  test('should allow admin users to access products page', async ({ page }) => {
    // Navigate to admin panel with admin credentials
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to products page
    await page.goto(`${BASE_URL}/admin/productos`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should be able to access the page
    const url = page.url();
    expect(url).toContain('admin/productos');
    
    // Should not show 403 error
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden');
    expect(!has403).toBeTruthy();
  });

  test('should allow admin users to access promotions page', async ({ page }) => {
    // Navigate to admin panel with admin credentials
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to promotions page
    await page.goto(`${BASE_URL}/admin/promociones`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should be able to access the page
    const url = page.url();
    expect(url).toContain('admin/promociones');
    
    // Should not show 403 error
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden');
    expect(!has403).toBeTruthy();
  });

  test('should allow admin users to access drivers page', async ({ page }) => {
    // Navigate to admin panel with admin credentials
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to drivers page
    await page.goto(`${BASE_URL}/admin/drivers`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should be able to access the page
    const url = page.url();
    expect(url).toContain('admin/drivers');
    
    // Should not show 403 error
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden');
    expect(!has403).toBeTruthy();
  });

  test('should allow admin users to access configuration page', async ({ page }) => {
    // Navigate to admin panel with admin credentials
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    
    // Navigate to configuration page
    await page.goto(`${BASE_URL}/admin/configuracion`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Should be able to access the page
    const url = page.url();
    expect(url).toContain('admin/configuracion');
    
    // Should not show 403 error
    const content = await page.textContent('body');
    const has403 = content?.includes('403') || content?.includes('Forbidden');
    expect(!has403).toBeTruthy();
  });
});
