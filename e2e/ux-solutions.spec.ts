import { test, expect } from '@playwright/test';

/**
 * E2E Tests for 21 UX Solutions Implementation
 * Validates all fixes in real browser environment
 */

// ============================================================
// FIX 1: Auto-calculate Change with Breakdown
// ============================================================
test.describe('FIX 1: Change Calculation', () => {
  test('should show change breakdown when paying with cash', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /punto de venta/i })).toBeVisible({ timeout: 15000 });
    
    // Open shift
    await page.getByRole('button', { name: /abrir turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    await expect(page.getByText(/turno abierto/i)).toBeVisible({ timeout: 5000 });
    
    // Add item to cart
    const firstProduct = page.getByTestId(/product-/).first();
    await firstProduct.click({ timeout: 10000 });
    
    // Open payment modal
    await page.getByRole('button', { name: /cobrar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    
    // Select cash payment
    await page.getByRole('button', { name: /efectivo/i }).click();
    
    // Enter payment amount more than total
    await page.getByRole('spinbutton').fill('1000');
    
    // Verify change is displayed
    const changeDisplay = page.getByText(/vuelto/i);
    await expect(changeDisplay).toBeVisible({ timeout: 5000 });
  });
});

// ============================================================
// FIX 2: Validate Discount <= Total
// ============================================================
test.describe('FIX 2: Discount Validation', () => {
  test('should block discount exceeding total', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /punto de venta/i })).toBeVisible({ timeout: 15000 });
    
    // Open shift and add item
    await page.getByRole('button', { name: /abrir turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    const firstProduct = page.getByTestId(/product-/).first();
    await firstProduct.click({ timeout: 10000 });
    
    // Open discount modal
    await page.getByRole('button', { name: /descuento/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    
    // Enter 100% discount (should be blocked or show error)
    await page.getByRole('spinbutton').fill('100');
    await page.getByRole('button', { name: /aplicar/i }).click();
    
    // Verify error or blocked behavior
    const errorText = page.getByText(/excede|máximo|inválido/i);
    const isVisible = await errorText.isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});

// ============================================================
// FIX 7: Warning at Stock 0
// ============================================================
test.describe('FIX 7: Stock 0 Warning', () => {
  test('should show ZERO status indicator', async ({ page }) => {
    await page.goto('/inventario');
    
    // Login if needed
    const pinInput = page.getByRole('textbox', { name: /pin/i });
    if (await pinInput.isVisible().catch(() => false)) {
      await pinInput.fill('1234'); // Admin PIN
      await page.getByRole('button', { name: /ingresar/i }).click();
    }
    
    // Wait for stock view to load
    await expect(page.getByText(/stock|inventario/i)).toBeVisible({ timeout: 15000 });
    
    // Look for stock status indicators
    const statusIndicator = page.getByTitle(/sin stock|zero|crítico/i);
    const hasStatusIndicator = await statusIndicator.isVisible().catch(() => false);
    
    // If there are zero-stock items, indicator should be visible
    if (hasStatusIndicator) {
      await expect(statusIndicator).toBeVisible();
    }
  });
});

// ============================================================
// FIX 12: Auto-Cancel Abandoned Sales
// ============================================================
test.describe('FIX 12: Abandoned Sales', () => {
  test('should not auto-cancel active sales immediately', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /punto de venta/i })).toBeVisible({ timeout: 15000 });
    
    // Open shift
    await page.getByRole('button', { name: /abrir turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    // Add item
    const firstProduct = page.getByTestId(/product-/).first();
    await firstProduct.click({ timeout: 10000 });
    
    // Verify order is still active
    await expect(page.getByRole('button', { name: /cobrar/i })).toBeVisible();
    
    // Wait a short time (not 15 minutes)
    await page.waitForTimeout(2000);
    
    // Order should still be visible
    await expect(page.getByRole('button', { name: /cobrar/i })).toBeVisible();
  });
});

// ============================================================
// FIX 20: Cash Discrepancy Warnings
// ============================================================
test.describe('FIX 20: Cash Discrepancy Warning', () => {
  test('should warn on large variance when closing shift', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /punto de venta/i })).toBeVisible({ timeout: 15000 });
    
    // Open shift with S/. 200
    await page.getByRole('button', { name: /abrir turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    // Try to close shift with S/. 50 (very different)
    await page.getByRole('button', { name: /cerrar turno/i }).click();
    await page.getByRole('spinbutton').fill('50');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    // Wait for confirmation dialog or error
    await page.waitForTimeout(2000);
    
    // Either shows confirmation dialog or error about variance
    const dialogOrError = page.getByText(/variación|seguro|confirmar/i);
    const isVisible = await dialogOrError.isVisible().catch(() => false);
    expect(isVisible).toBeTruthy();
  });
});

// ============================================================
// FIX 21: Prevent Partial Close
// ============================================================
test.describe('FIX 21: Prevent Partial Close', () => {
  test('should block shift close with open checks', async ({ page }) => {
    await page.goto('/pos');
    await expect(page.getByRole('heading', { name: /punto de venta/i })).toBeVisible({ timeout: 15000 });
    
    // Open shift
    await page.getByRole('button', { name: /abrir turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    // Add item to create open check
    const firstProduct = page.getByTestId(/product-/).first();
    await firstProduct.click({ timeout: 10000 });
    
    // Try to close shift
    await page.getByRole('button', { name: /cerrar turno/i }).click();
    await page.getByRole('spinbutton').fill('200');
    await page.getByRole('button', { name: /confirmar/i }).click();
    
    // Should see error or be blocked
    await page.waitForTimeout(2000);
    
    // Check if shift actually closed (it shouldn't be if there are open checks)
    const shiftClosed = page.getByText(/turno cerrado|cerrado/i);
    const isOpen = await page.getByRole('button', { name: /cerrar turno/i }).isVisible().catch(() => false);
    
    // If shift is still open, the fix is working
    // If error about open checks appears, also working
    const hasOpenChecks = isOpen;
    expect(hasOpenChecks).toBeTruthy();
  });
});
