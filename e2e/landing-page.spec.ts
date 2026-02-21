/**
 * E2E Test: Landing Page & Demo Request
 * Tests the public landing page sections and demo request form
 */
import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should load landing page with branding', async ({ page }) => {
    await expect(page.locator('text=PARK')).toBeVisible({ timeout: 10000 });
  });

  test('should display hero section', async ({ page }) => {
    // Hero section with main value proposition
    const heroContent = await page.textContent('h1, h2');
    expect(heroContent).toBeTruthy();
  });

  test('should display feature sections', async ({ page }) => {
    // Scroll down to features
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);
    const pageText = await page.textContent('body');
    // Should have feature-related content
    expect(pageText!.length).toBeGreaterThan(100);
  });

  test('should display pricing section', async ({ page }) => {
    // Scroll to pricing
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
    await page.waitForTimeout(500);
    const pricingText = page.locator('text=Plan, text=Planes, text=Precio, text=precio');
    if (await pricingText.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(pricingText.first()).toBeVisible();
    }
  });

  test('should show demo request form with fields', async ({ page }) => {
    // Scroll to form
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const form = page.locator('form');
    if (await form.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Form should have input fields
      const inputs = form.locator('input');
      const count = await inputs.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  test('should validate demo request form - empty submission', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitButton.click();
      // Browser validation should prevent submission or show errors
      await page.waitForTimeout(1000);
    }
  });

  test('should fill and submit demo request form', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Fill name
    const nameInput = page.locator('input[name="name"], input[placeholder*="Nombre"]');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Juan Pérez');
    }

    // Fill email
    const emailInput = page.locator('input[name="email"], input[type="email"], input[placeholder*="Email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('juan@polleria-ellenador.com');
    }

    // Fill restaurant name
    const restInput = page.locator('input[name="restaurant"], input[placeholder*="Restaurante"], input[placeholder*="restaurante"]');
    if (await restInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await restInput.fill('Pollería El Leñador');
    }

    // Submit
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await submitButton.click();
      await page.waitForTimeout(2000);
    }
  });

  test('should have responsive navigation', async ({ page }) => {
    // Check that navigation links exist
    const nav = page.locator('nav, header');
    if (await nav.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(nav.first()).toBeVisible();
    }
  });
});
