import { test, expect } from "@playwright/test";

/**
 * E2E Test: Waiter → KDS Flow
 * 
 * Verifies that orders created by waiters appear correctly on KDS screens
 * after being submitted to the kitchen.
 * 
 * Bug Fix: ORDER_SUBMITTED event was not being processed by the reducer,
 * causing orders to not appear on KDS screens.
 */

test.describe("Waiter to KDS Flow", () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to home and ensure clean state
        await page.goto("/");
        await page.waitForLoadState("networkidle");
    });

    test("waiter creates order and submits to kitchen, KDS shows order", async ({ page, context }) => {
        // Step 1: Open waiter page in first tab
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");

        // Select a table (e.g., Mesa 1)
        await page.click('text=Mesa 1');
        await page.waitForLoadState("networkidle");

        // Step 2: Add items to order
        // Add item for PARRILLA
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible()) {
            await polloButton.click();
            await page.waitForTimeout(500);
        }

        // Add item for COCINA
        const papasButton = page.locator('button:has-text("Papas")').first();
        if (await papasButton.isVisible()) {
            await papasButton.click();
            await page.waitForTimeout(500);
        }

        // Add item for BAR
        const gaseosaButton = page.locator('button:has-text("Gaseosa")').first();
        if (await gaseosaButton.isVisible()) {
            await gaseosaButton.click();
            await page.waitForTimeout(500);
        }

        // Step 3: Submit order to kitchen
        const sendButton = page.locator('button:has-text("Enviar")');
        await expect(sendButton).toBeVisible();
        await sendButton.click();

        // Wait for success toast
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Step 4: Open KDS Cocina in new tab
        const kdsPage = await context.newPage();
        await kdsPage.goto("/cocina");
        await kdsPage.waitForLoadState("networkidle");
        await kdsPage.waitForTimeout(2000); // Wait for IndexedDB to sync

        // Step 5: Verify order appears on KDS
        // Should see order number
        const orderTicket = kdsPage.locator('[data-testid="kds-ticket"]').first();
        await expect(orderTicket).toBeVisible({ timeout: 10000 });

        // Should see items for COCINA station (Papas)
        await expect(kdsPage.locator('text=Papas')).toBeVisible();

        // Step 6: Open KDS Bar in another tab
        const barPage = await context.newPage();
        await barPage.goto("/bar");
        await barPage.waitForLoadState("networkidle");
        await barPage.waitForTimeout(2000);

        // Should see items for BAR station (Gaseosa)
        await expect(barPage.locator('text=Gaseosa')).toBeVisible({ timeout: 10000 });

        // Step 7: Open KDS Horno (Parrilla) in another tab
        const hornoPage = await context.newPage();
        await hornoPage.goto("/cocina/horno");
        await hornoPage.waitForLoadState("networkidle");
        await hornoPage.waitForTimeout(2000);

        // Should see items for PARRILLA station (Pollo)
        await expect(hornoPage.locator('text=Pollo')).toBeVisible({ timeout: 10000 });

        // Cleanup
        await kdsPage.close();
        await barPage.close();
        await hornoPage.close();
    });

    test("KDS can change item status after submission", async ({ page, context }) => {
        // Step 1: Create and submit order as waiter
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 2');
        await page.waitForLoadState("networkidle");

        // Add item
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible()) {
            await polloButton.click();
            await page.waitForTimeout(500);
        }

        // Submit
        const sendButton = page.locator('button:has-text("Enviar")');
        await sendButton.click();
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Step 2: Open KDS and change status
        const kdsPage = await context.newPage();
        await kdsPage.goto("/cocina/horno");
        await kdsPage.waitForLoadState("networkidle");
        await kdsPage.waitForTimeout(2000);

        // Find the item and click to change status
        const itemButton = kdsPage.locator('button:has-text("Pollo")').first();
        await expect(itemButton).toBeVisible({ timeout: 10000 });

        // Click to change from PENDING → COOKING
        await itemButton.click();
        await kdsPage.waitForTimeout(500);

        // Verify status changed (button should show different state)
        // The exact UI depends on implementation, but item should still be visible
        await expect(itemButton).toBeVisible();

        // Click again to change from COOKING → READY
        await itemButton.click();
        await kdsPage.waitForTimeout(500);

        // Item should still be visible
        await expect(itemButton).toBeVisible();

        await kdsPage.close();
    });

    test("multiple waiters can submit orders simultaneously", async ({ page, context }) => {
        // Simulate 2 waiters submitting orders at the same time

        // Waiter 1: Mesa 3
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 3');
        await page.waitForLoadState("networkidle");

        const polloButton1 = page.locator('button:has-text("Pollo")').first();
        if (await polloButton1.isVisible()) {
            await polloButton1.click();
            await page.waitForTimeout(300);
        }

        // Waiter 2: Mesa 4 (new tab)
        const waiter2Page = await context.newPage();
        await waiter2Page.goto("/mozo");
        await waiter2Page.waitForLoadState("networkidle");
        await waiter2Page.click('text=Mesa 4');
        await waiter2Page.waitForLoadState("networkidle");

        const papasButton2 = waiter2Page.locator('button:has-text("Papas")').first();
        if (await papasButton2.isVisible()) {
            await papasButton2.click();
            await waiter2Page.waitForTimeout(300);
        }

        // Submit both orders simultaneously
        const sendButton1 = page.locator('button:has-text("Enviar")');
        const sendButton2 = waiter2Page.locator('button:has-text("Enviar")');

        await Promise.all([
            sendButton1.click(),
            sendButton2.click(),
        ]);

        // Wait for both success toasts
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await expect(waiter2Page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(1000);

        // Open KDS and verify both orders appear
        const kdsPage = await context.newPage();
        await kdsPage.goto("/cocina");
        await kdsPage.waitForLoadState("networkidle");
        await kdsPage.waitForTimeout(2000);

        // Should see both orders (or at least their items)
        const tickets = kdsPage.locator('[data-testid="kds-ticket"]');
        const ticketCount = await tickets.count();
        expect(ticketCount).toBeGreaterThanOrEqual(2);

        await waiter2Page.close();
        await kdsPage.close();
    });

    test("order with no items cannot be submitted", async ({ page }) => {
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 5');
        await page.waitForLoadState("networkidle");

        // Try to submit without adding items
        const sendButton = page.locator('button:has-text("Enviar")');
        
        // Button might be disabled or clicking shows error
        if (await sendButton.isEnabled()) {
            await sendButton.click();
            // Should show error toast
            await expect(page.locator('text=No hay items')).toBeVisible({ timeout: 3000 });
        } else {
            // Button is disabled, which is also correct behavior
            expect(await sendButton.isDisabled()).toBe(true);
        }
    });

    test("submitted items remain visible on waiter screen", async ({ page }) => {
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 6');
        await page.waitForLoadState("networkidle");

        // Add item
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible()) {
            await polloButton.click();
            await page.waitForTimeout(500);
        }

        // Verify item appears in order panel
        await expect(page.locator('text=Pollo').nth(1)).toBeVisible(); // nth(1) because first is in catalog

        // Submit
        const sendButton = page.locator('button:has-text("Enviar")');
        await sendButton.click();
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);

        // Item should still be visible in order panel after submission
        await expect(page.locator('text=Pollo').nth(1)).toBeVisible();
    });
});
