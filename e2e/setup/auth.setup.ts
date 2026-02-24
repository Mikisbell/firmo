/**
 * Authentication Setup for E2E Tests
 * 
 * This setup file runs before all tests and creates authenticated sessions
 * for both test tenants. The authentication state is saved to files and
 * reused across all tests to avoid repeated login operations.
 * 
 * Run: npx playwright test --project=setup
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test tenant configurations
const TENANT_1 = {
  id: '11111111-1111-1111-1111-111111111111',
  adminPin: '1111',
  name: 'Pollería Test 1',
  storageStatePath: path.join(__dirname, '../../playwright/.auth/tenant1-admin.json'),
};

const TENANT_2 = {
  id: '22222222-2222-2222-2222-222222222222',
  adminPin: '2222',
  name: 'Pollería Test 2',
  storageStatePath: path.join(__dirname, '../../playwright/.auth/tenant2-admin.json'),
};

/**
 * Setup authentication for Tenant 1
 */
setup('authenticate as Tenant 1 admin', async ({ page }) => {
  console.log('[Setup] Authenticating as Tenant 1 admin...');

  // Navigate to admin panel
  await page.goto('http://localhost:3000/admin');

  // Set tenant_id in localStorage
  await page.evaluate((tenantId) => {
    localStorage.setItem('tenant_id', tenantId);
  }, TENANT_1.id);

  // Wait for PIN pad (30s for cold starts — AuthContext isLoading blocks render)
  await page.waitForSelector('[data-testid="pin-pad"]', { state: 'visible', timeout: 30000 });

  // Enter PIN — scope to pin-pad to avoid ambiguity
  for (const digit of TENANT_1.adminPin) {
    await page.locator(`[data-testid="pin-pad"] button:has-text("${digit}")`).click();
    await page.waitForTimeout(100);
  }

  // Wait for authentication to complete
  await page.waitForURL('**/admin/**', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  // Verify we're authenticated
  const url = page.url();
  expect(url).toContain('/admin');

  // Save storage state
  await page.context().storageState({ path: TENANT_1.storageStatePath });

  console.log(`[Setup] Tenant 1 authenticated - Storage state saved to ${TENANT_1.storageStatePath}`);
});

/**
 * Setup authentication for Tenant 2
 */
setup('authenticate as Tenant 2 admin', async ({ page }) => {
  console.log('[Setup] Authenticating as Tenant 2 admin...');

  // Navigate to admin panel
  await page.goto('http://localhost:3000/admin');

  // Set tenant_id in localStorage
  await page.evaluate((tenantId) => {
    localStorage.setItem('tenant_id', tenantId);
  }, TENANT_2.id);

  // Wait for PIN pad (30s for cold starts — AuthContext isLoading blocks render)
  await page.waitForSelector('[data-testid="pin-pad"]', { state: 'visible', timeout: 30000 });

  // Enter PIN — scope to pin-pad to avoid ambiguity
  for (const digit of TENANT_2.adminPin) {
    await page.locator(`[data-testid="pin-pad"] button:has-text("${digit}")`).click();
    await page.waitForTimeout(100);
  }

  // Wait for authentication to complete
  await page.waitForURL('**/admin/**', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');

  // Verify we're authenticated
  const url = page.url();
  expect(url).toContain('/admin');

  // Save storage state
  await page.context().storageState({ path: TENANT_2.storageStatePath });

  console.log(`[Setup] Tenant 2 authenticated - Storage state saved to ${TENANT_2.storageStatePath}`);
});
