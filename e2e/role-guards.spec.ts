/**
 * E2E Tests — RoleGuard (frontend route protection)
 *
 * Verifies that each protected route only renders for the correct role
 * and redirects unauthorized roles back to '/'.
 */
import { test, expect } from '@playwright/test';
import { setupRoleTerminal } from './helpers/test-utils';

// ── Allowed access ──────────────────────────────────────────────────

test.describe('RoleGuard — allowed access', () => {

  test('CASHIER can access /pos', async ({ page }) => {
    await setupRoleTerminal(page, 'CASHIER');
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
    // Should stay on /pos (not redirected)
    expect(page.url()).toContain('/pos');
    await expect(page.locator('body')).toBeVisible();
  });

  test('WAITER can access /mozo', async ({ page }) => {
    await setupRoleTerminal(page, 'WAITER');
    await page.goto('/mozo');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/mozo');
    await expect(page.locator('body')).toBeVisible();
  });

  test('KITCHEN can access /cocina', async ({ page }) => {
    await setupRoleTerminal(page, 'KITCHEN');
    await page.goto('/cocina');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/cocina');
  });

  test('COOK can access /cocina', async ({ page }) => {
    await setupRoleTerminal(page, 'COOK');
    await page.goto('/cocina');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/cocina');
  });

  test('PACKER can access /cocina', async ({ page }) => {
    await setupRoleTerminal(page, 'PACKER');
    await page.goto('/cocina');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/cocina');
  });

  test('BAR can access /bar', async ({ page }) => {
    await setupRoleTerminal(page, 'BAR');
    await page.goto('/bar');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/bar');
  });

  test('DRIVER can access /delivery', async ({ page }) => {
    await setupRoleTerminal(page, 'DRIVER');
    await page.goto('/delivery');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/delivery');
  });
});

// ── Denied access (redirect to /) ──────────────────────────────────

test.describe('RoleGuard — denied access redirects to /', () => {

  test('WAITER cannot access /pos', async ({ page }) => {
    await setupRoleTerminal(page, 'WAITER');
    await page.goto('/pos');
    // RoleGuard should redirect to '/'
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/pos');
  });

  test('CASHIER cannot access /mozo', async ({ page }) => {
    await setupRoleTerminal(page, 'CASHIER');
    await page.goto('/mozo');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/mozo');
  });

  test('WAITER cannot access /cocina', async ({ page }) => {
    await setupRoleTerminal(page, 'WAITER');
    await page.goto('/cocina');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/cocina');
  });

  test('CASHIER cannot access /bar', async ({ page }) => {
    await setupRoleTerminal(page, 'CASHIER');
    await page.goto('/bar');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/bar');
  });

  test('WAITER cannot access /delivery', async ({ page }) => {
    await setupRoleTerminal(page, 'WAITER');
    await page.goto('/delivery');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/delivery');
  });

  test('KITCHEN cannot access /pos', async ({ page }) => {
    await setupRoleTerminal(page, 'KITCHEN');
    await page.goto('/pos');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/pos');
  });

  test('BAR cannot access /mozo', async ({ page }) => {
    await setupRoleTerminal(page, 'BAR');
    await page.goto('/mozo');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/mozo');
  });

  test('DRIVER cannot access /cocina', async ({ page }) => {
    await setupRoleTerminal(page, 'DRIVER');
    await page.goto('/cocina');
    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/cocina');
  });
});
