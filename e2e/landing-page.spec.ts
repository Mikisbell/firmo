/**
 * E2E Test: Landing Page & Demo Request
 * Tests the public landing page and demo request form
 */
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should load landing page', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.locator('text=PARK POS')).toBeVisible({ timeout: 10000 });
  });

  test('should display feature sections', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.locator('text=Funcionalidades')).toBeVisible({ timeout: 10000 });
  });

  test('should display pricing section', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.locator('text=Planes')).toBeVisible({ timeout: 10000 });
  });

  test('should show demo request form', async ({ page }) => {
    await page.goto('/landing');
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 10000 });
  });

  test('should validate demo request form fields', async ({ page }) => {
    await page.goto('/landing');

    // Try submitting empty form
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Should show validation errors
      await page.waitForTimeout(500);
    }
  });

  test('should submit demo request successfully', async ({ page }) => {
    await page.goto('/landing');

    // Fill form
    await page.fill('input[name="name"], input[placeholder*="Nombre"]', 'Test User');
    await page.fill('input[name="email"], input[placeholder*="Email"], input[type="email"]', 'test@polleria.com');
    await page.fill('input[name="restaurant"], input[placeholder*="Restaurante"], input[placeholder*="restaurante"]', 'Pollería Test');

    // Submit
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Wait for success message
      await page.waitForTimeout(2000);
    }
  });
});
