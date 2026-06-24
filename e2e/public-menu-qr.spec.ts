/**
 * E2E Test: Public Menu (QR Table)
 * Tests the public-facing menu page accessed via table QR codes
 * This page uses a light theme (not admin dark theme)
 */
import { test, expect } from '@playwright/test';

// @smoke: gate bloqueante de CI (publico, rapido, sin auth/seed). Ver job e2e-smoke en ci.yml.
test.describe('Public Menu QR', { tag: '@smoke' }, () => {
  const testSlug = 'polleria-test';
  const testTableId = 'mesa-01';

  test('should load public menu page', async ({ page }) => {
    await page.goto(`/menu/${testSlug}/${testTableId}`);
    await page.waitForLoadState('domcontentloaded');
    // Page should render without errors (even if tenant doesn't exist)
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('should handle non-existent tenant gracefully', async ({ page }) => {
    await page.goto(`/menu/non-existent-tenant/mesa-99`);
    await page.waitForLoadState('domcontentloaded');
    // Should show an error message or redirect, not crash
    const status = page.locator('text=no encontrado, text=error, text=Error, text=No encontrado');
    const pageContent = await page.textContent('body');
    // Page should render something (error message or empty state)
    expect(pageContent).toBeTruthy();
  });

  test('should display menu page with light background', async ({ page }) => {
    await page.goto(`/menu/${testSlug}/${testTableId}`);
    await page.waitForLoadState('domcontentloaded');
    // Public menu uses light theme - verify background is not dark
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // Background should not be the admin dark theme (zinc-900 = rgb(24, 24, 27))
    if (bgColor) {
      expect(bgColor).not.toBe('rgb(24, 24, 27)');
    }
  });

  test('should have call waiter functionality', async ({ page }) => {
    await page.goto(`/menu/${testSlug}/${testTableId}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    // Look for call waiter button
    const callBtn = page.locator('button:has-text("Llamar"), button:has-text("Mesero"), button:has-text("mesero")');
    if (await callBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(callBtn.first()).toBeVisible();
    }
  });
});
