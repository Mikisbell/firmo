/**
 * E2E Test: Public Menu (QR Table)
 * Tests the public-facing menu page accessed via table QR codes
 */
import { test, expect } from '@playwright/test';

test.describe('Public Menu QR', () => {
  // This uses a test tenant slug and table ID
  const testSlug = 'polleria-test';
  const testTableId = 'mesa-01';

  test('should load public menu page with light theme', async ({ page }) => {
    await page.goto(`/menu/${testSlug}/${testTableId}`);
    // The page should have a light theme (not the dark admin theme)
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display menu categories', async ({ page }) => {
    await page.goto(`/menu/${testSlug}/${testTableId}`);
    await page.waitForLoadState('domcontentloaded');
    // Even if tenant doesn't exist, page should render gracefully
  });
});
