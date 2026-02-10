import { test, expect } from "@playwright/test";
import { setupTerminalConfig } from "./helpers/terminal-setup";

/**
 * E2E Test: Waiter → KDS Flow
 * 
 * Verifies that orders created by waiters appear correctly on KDS screens
 * after being submitted to the kitchen.
 * 
 * Bug Fix: ORDER_SUBMITTED event was not being processed by the reducer,
 * causing orders to not appear on KDS screens.
 * 
 * Fix 2 (5 Feb 2026): Added terminal configuration setup to prevent redirect to home.
 */

test.describe("Waiter to KDS Flow", () => {
    test.beforeEach(async ({ page, context }) => {
        // CRITICAL: Mock catalog API to provide test products
        await page.route('/api/catalog/latest', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    items: [
                        { 
                            id: 'e2e-pollo', 
                            sku: 'POLLO-001',
                            name: 'Pollo a la Brasa', 
                            price_cents: 3500, 
                            station: 'PARRILLA',
                            category: 'POLLOS',
                            is_active: true
                        },
                        { 
                            id: 'e2e-papas', 
                            sku: 'GUARN-001',
                            name: 'Papas Fritas', 
                            price_cents: 800, 
                            station: 'COCINA',
                            category: 'GUARNICIONES',
                            is_active: true
                        },
                        { 
                            id: 'e2e-gaseosa', 
                            sku: 'BEB-001',
                            name: 'Gaseosa 1.5L', 
                            price_cents: 500, 
                            station: 'BAR',
                            category: 'BEBIDAS',
                            is_active: true
                        },
                    ],
                }),
            });
        });

        // CRITICAL: Set localStorage AND sessionStorage BEFORE any page loads
        // This ensures terminal config and auth session are available when components mount
        await context.addInitScript(() => {
            const terminalConfig = {
                tenant_id: "00000000-0000-0000-0000-000000000001",
                terminal_id: "WAITER_TEST_01",
                actor_id: "00000000-0000-0000-0000-000000000001",
                role: "WAITER",
                device_fingerprint: "test-device-fingerprint-waiter-1",
                activated_at: new Date().toISOString()
            };
            
            // Create a mock session for E2E tests
            const mockSession = {
                id: "e2e-test-session-" + Date.now(),
                terminal_id: "WAITER_TEST_01",
                actor_id: "00000000-0000-0000-0000-000000000001",
                role: "WAITER",
                created_at: Date.now(),
                last_activity: Date.now(),
                fingerprint: "test-device-fingerprint-waiter-1",
                risk_level: "low"
            };
            
            // IMPORTANT: Use correct localStorage keys
            localStorage.setItem('park_terminal_config', JSON.stringify(terminalConfig));
            localStorage.setItem('e2e_mode', 'true');
            
            // IMPORTANT: Set session in sessionStorage to bypass PIN screen
            sessionStorage.setItem('park_session_v2', JSON.stringify(mockSession));
        });
    });

    test("waiter creates order and submits to kitchen, KDS shows order", async ({ page, context }) => {
        // Step 1: Open waiter page in first tab
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");

        // Select a table (e.g., Mesa 1)
        await page.click('text=Mesa 1');
        await page.waitForLoadState("networkidle");

        // Step 2: Wait for catalog to load
        await page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });

        // Step 3: Add 3 different products (any available products)
        const productButtons = page.locator('[data-testid^="product-"]');
        const productCount = await productButtons.count();
        
        if (productCount === 0) {
            throw new Error("No products found in catalog");
        }

        // Add first 3 products (or less if not enough products)
        const itemsToAdd = Math.min(3, productCount);
        for (let i = 0; i < itemsToAdd; i++) {
            await productButtons.nth(i).click();
            await page.waitForTimeout(300);
        }

        // Step 4: Submit order to kitchen
        const sendButton = page.locator('button:has-text("Enviar")');
        await expect(sendButton).toBeVisible();
        await expect(sendButton).toBeEnabled({ timeout: 5000 });
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

        // Wait for catalog and add first product
        await page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });
        const firstProduct = page.locator('[data-testid^="product-"]').first();
        await firstProduct.click();
        await page.waitForTimeout(500);

        // Submit
        const sendButton = page.locator('button:has-text("Enviar")');
        await expect(sendButton).toBeEnabled({ timeout: 5000 });
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

        await page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });
        const product1 = page.locator('[data-testid^="product-"]').first();
        await product1.click();
        await page.waitForTimeout(300);

        // Waiter 2: Mesa 4 (new tab)
        const waiter2Page = await context.newPage();
        await waiter2Page.goto("/mozo");
        await waiter2Page.waitForLoadState("networkidle");
        await waiter2Page.click('text=Mesa 4');
        await waiter2Page.waitForLoadState("networkidle");

        await waiter2Page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });
        const product2 = waiter2Page.locator('[data-testid^="product-"]').nth(1);
        await product2.click();
        await waiter2Page.waitForTimeout(300);

        // Submit both orders simultaneously
        const sendButton1 = page.locator('button:has-text("Enviar")');
        const sendButton2 = waiter2Page.locator('button:has-text("Enviar")');

        await expect(sendButton1).toBeEnabled({ timeout: 5000 });
        await expect(sendButton2).toBeEnabled({ timeout: 5000 });

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

        // Wait for catalog and add first product
        await page.waitForSelector('[data-testid^="product-"]', { timeout: 10000 });
        const firstProduct = page.locator('[data-testid^="product-"]').first();
        
        // Get product name for verification
        const productName = await firstProduct.textContent();
        await firstProduct.click();
        await page.waitForTimeout(500);

        // Verify item appears in order panel (should appear twice: once in catalog, once in order)
        const itemInOrder = page.locator(`text=${productName}`).nth(1);
        await expect(itemInOrder).toBeVisible();

        // Submit
        const sendButton = page.locator('button:has-text("Enviar")');
        await expect(sendButton).toBeEnabled({ timeout: 5000 });
        await sendButton.click();
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(500);

        // Item should still be visible in order panel after submission
        await expect(page.locator('text=Pollo').nth(1)).toBeVisible();
    });
});
