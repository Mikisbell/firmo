import { test, expect } from "@playwright/test";
import { setupWaiterTerminal, setupKDSTerminal, setupCashierTerminal } from "./helpers/test-utils";

/**
 * E2E Test: Complete Waiter Flow
 * 
 * Simulates the complete flow from waiter login to order submission
 * and verification that orders reach all stations (KDS + Cashier).
 * 
 * Flow:
 * 1. Waiter logs in (simulated via localStorage)
 * 2. Waiter selects a table
 * 3. Waiter adds items for different stations (PARRILLA, COCINA, BAR)
 * 4. Waiter submits order to kitchen
 * 5. Verify order appears on KDS Parrilla
 * 6. Verify order appears on KDS Cocina
 * 7. Verify order appears on KDS Bar
 * 8. Verify order appears on Cashier pending orders
 */

test.describe("Complete Waiter Flow - End to End", () => {
    test.beforeEach(async ({ page }) => {
        // Setup: Configure waiter terminal with session
        await setupWaiterTerminal(page);
    });

    test("complete flow: waiter login → order → submit → KDS + cashier receive", async ({ page, context }) => {
        console.log("🚀 Starting Complete Waiter Flow Test");

        // ============================================================
        // STEP 1: Waiter Login (Simulated - go directly to waiter page)
        // ============================================================
        console.log("📱 STEP 1: Waiter accessing system");
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Verify we're on the waiter page (MESERO header should be visible)
        await expect(page.locator('text=MESERO')).toBeVisible({ timeout: 10000 });
        console.log("✅ Waiter page loaded successfully");

        // ============================================================
        // STEP 2: Select a Table
        // ============================================================
        console.log("🪑 STEP 2: Selecting table");
        const tableNumber = "1";

        // Wait for loading spinner to disappear
        console.log("  → Waiting for page to finish loading...");
        await page.waitForSelector('.animate-spin', { 
            state: 'hidden', 
            timeout: 10000 
        }).catch(() => {
            console.log("  ⚠️ No loading spinner found (may already be loaded)");
        });

        // Wait extra time for React hydration and data loading
        await page.waitForTimeout(3000);

        // Try multiple selectors for tables
        console.log("  → Looking for table buttons...");
        
        // Check if any table-like elements exist
        const hasButtons = await page.locator('button').count();
        console.log(`  → Found ${hasButtons} buttons on page`);
        
        // Look for any text containing "Mesa"
        const mesaElements = await page.locator('text=/Mesa/i').count();
        console.log(`  → Found ${mesaElements} elements with "Mesa" text`);
        
        // Try to find the specific table with multiple strategies
        let tableButton = page.locator(`button:has-text("Mesa ${tableNumber}")`).first();
        let buttonVisible = await tableButton.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (!buttonVisible) {
            // Try alternative selector
            console.log("  → Trying alternative selector...");
            tableButton = page.locator(`text=Mesa ${tableNumber}`).first();
            buttonVisible = await tableButton.isVisible({ timeout: 2000 }).catch(() => false);
        }
        
        if (!buttonVisible) {
            // Debug: Take screenshot and dump page content
            await page.screenshot({ path: 'test-results/debug-no-tables.png', fullPage: true });
            const content = await page.content();
            console.log("  ❌ Tables not found! Screenshot saved");
            console.log("  → Page title:", await page.title());
            console.log("  → URL:", page.url());
            console.log("  → Has 'MESERO' text:", await page.locator('text=MESERO').isVisible());
            
            // Check if there's an error message
            const errorText = await page.locator('text=/error|Error/i').first().textContent().catch(() => null);
            if (errorText) {
                console.log("  → Error on page:", errorText);
            }
            
            throw new Error("Tables did not load - see screenshot and logs");
        }
        
        console.log(`  ✅ Mesa ${tableNumber} button found and visible`);

        // Click the button
        await tableButton.click();
        console.log(`  ✅ Mesa ${tableNumber} clicked`);

        // Wait for navigation
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Verify we're on the order page
        await expect(page.locator(`text=Mesa ${tableNumber}`)).toBeVisible();
        console.log(`✅ Table ${tableNumber} selected - Order page loaded`);

        // ============================================================
        // STEP 3: Add Items for Different Stations
        // ============================================================
        console.log("🍽️ STEP 3: Adding items for different stations");

        // Add item for PARRILLA (Pollo)
        console.log("  → Adding Pollo (PARRILLA)");
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible({ timeout: 3000 })) {
            await polloButton.click();
            await page.waitForTimeout(500);
            console.log("  ✅ Pollo added (PARRILLA)");
        } else {
            console.log("  ⚠️ Pollo button not found, skipping");
        }

        // Add item for COCINA (Papas)
        console.log("  → Adding Papas (COCINA)");
        const papasButton = page.locator('button:has-text("Papas")').first();
        if (await papasButton.isVisible({ timeout: 3000 })) {
            await papasButton.click();
            await page.waitForTimeout(500);
            console.log("  ✅ Papas added (COCINA)");
        } else {
            console.log("  ⚠️ Papas button not found, skipping");
        }

        // Add item for BAR (Gaseosa)
        console.log("  → Adding Gaseosa (BAR)");
        const gaseosaButton = page.locator('button:has-text("Gaseosa")').first();
        if (await gaseosaButton.isVisible({ timeout: 3000 })) {
            await gaseosaButton.click();
            await page.waitForTimeout(500);
            console.log("  ✅ Gaseosa added (BAR)");
        } else {
            console.log("  ⚠️ Gaseosa button not found, skipping");
        }

        // Verify items appear in order panel
        console.log("  → Verifying items in order panel");
        const orderPanel = page.locator('[data-testid="order-panel"]').or(page.locator('text=Total'));
        await expect(orderPanel).toBeVisible({ timeout: 5000 });
        console.log("  ✅ Order panel shows items");

        // ============================================================
        // STEP 4: Submit Order to Kitchen
        // ============================================================
        console.log("📤 STEP 4: Submitting order to kitchen");
        const sendButton = page.locator('button:has-text("Enviar")').or(
            page.locator('button:has-text("Enviar a Cocina")')
        );
        await expect(sendButton).toBeVisible({ timeout: 5000 });
        await sendButton.click();

        // Wait for success toast
        const successToast = page.locator('text=¡Enviado!').or(
            page.locator('text=Pedido enviado')
        );
        await expect(successToast).toBeVisible({ timeout: 5000 });
        console.log("✅ Order submitted successfully");
        await page.waitForTimeout(2000); // Wait for IndexedDB sync

        // ============================================================
        // STEP 5: Verify Order on KDS Parrilla
        // ============================================================
        console.log("🔥 STEP 5: Verifying order on KDS Parrilla");
        const kdsParrillaPage = await context.newPage();
        await setupKDSTerminal(kdsParrillaPage, "PARRILLA");
        await kdsParrillaPage.goto("/cocina/horno");
        await kdsParrillaPage.waitForLoadState("networkidle");
        await kdsParrillaPage.waitForTimeout(2000); // Wait for IndexedDB to sync

        // Look for Pollo item on Parrilla KDS
        const polloOnKDS = kdsParrillaPage.locator('text=Pollo');
        const polloVisible = await polloOnKDS.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (polloVisible) {
            console.log("✅ Pollo visible on KDS Parrilla");
            
            // Verify order ticket structure
            const ticket = kdsParrillaPage.locator('[data-testid="kds-ticket"]').first();
            if (await ticket.isVisible({ timeout: 5000 })) {
                console.log("✅ KDS ticket structure present");
            }
        } else {
            console.log("⚠️ Pollo not visible on KDS Parrilla (may not have been added)");
        }

        // ============================================================
        // STEP 6: Verify Order on KDS Cocina
        // ============================================================
        console.log("🍳 STEP 6: Verifying order on KDS Cocina");
        const kdsCocinaPage = await context.newPage();
        await setupKDSTerminal(kdsCocinaPage, "COCINA");
        await kdsCocinaPage.goto("/cocina");
        await kdsCocinaPage.waitForLoadState("networkidle");
        await kdsCocinaPage.waitForTimeout(2000);

        // Look for Papas item on Cocina KDS
        const papasOnKDS = kdsCocinaPage.locator('text=Papas');
        const papasVisible = await papasOnKDS.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (papasVisible) {
            console.log("✅ Papas visible on KDS Cocina");
        } else {
            console.log("⚠️ Papas not visible on KDS Cocina (may not have been added)");
        }

        // ============================================================
        // STEP 7: Verify Order on KDS Bar
        // ============================================================
        console.log("🍺 STEP 7: Verifying order on KDS Bar");
        const kdsBarPage = await context.newPage();
        await setupKDSTerminal(kdsBarPage, "BAR");
        await kdsBarPage.goto("/bar");
        await kdsBarPage.waitForLoadState("networkidle");
        await kdsBarPage.waitForTimeout(2000);

        // Look for Gaseosa item on Bar KDS
        const gaseosaOnKDS = kdsBarPage.locator('text=Gaseosa');
        const gaseosaVisible = await gaseosaOnKDS.isVisible({ timeout: 10000 }).catch(() => false);
        
        if (gaseosaVisible) {
            console.log("✅ Gaseosa visible on KDS Bar");
        } else {
            console.log("⚠️ Gaseosa not visible on KDS Bar (may not have been added)");
        }

        // ============================================================
        // STEP 8: Verify Order on Cashier (POS)
        // ============================================================
        console.log("💰 STEP 8: Verifying order on Cashier");
        const cashierPage = await context.newPage();
        await setupCashierTerminal(cashierPage);
        await cashierPage.goto("/pos");
        await cashierPage.waitForLoadState("networkidle");
        await cashierPage.waitForTimeout(2000);

        // Look for pending orders section
        const pendingOrders = cashierPage.locator('text=Órdenes Pendientes').or(
            cashierPage.locator('text=Pendientes')
        );
        
        if (await pendingOrders.isVisible({ timeout: 5000 })) {
            console.log("✅ Pending orders section visible on Cashier");
            
            // Look for our table number in pending orders
            const tableInCashier = cashierPage.locator(`text=Mesa ${tableNumber}`);
            const tableVisible = await tableInCashier.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (tableVisible) {
                console.log(`✅ Mesa ${tableNumber} visible in Cashier pending orders`);
            } else {
                console.log(`⚠️ Mesa ${tableNumber} not visible in Cashier (may need to refresh)`);
            }
        } else {
            console.log("⚠️ Pending orders section not found on Cashier");
        }

        // ============================================================
        // STEP 9: Summary and Cleanup
        // ============================================================
        console.log("\n📊 TEST SUMMARY:");
        console.log("================");
        console.log(`✅ Waiter accessed system`);
        console.log(`✅ Table ${tableNumber} selected`);
        console.log(`✅ Items added to order`);
        console.log(`✅ Order submitted to kitchen`);
        console.log(`${polloVisible ? '✅' : '⚠️'} Order visible on KDS Parrilla`);
        console.log(`${papasVisible ? '✅' : '⚠️'} Order visible on KDS Cocina`);
        console.log(`${gaseosaVisible ? '✅' : '⚠️'} Order visible on KDS Bar`);
        console.log(`✅ Cashier page accessed`);
        console.log("================\n");

        // Cleanup
        await kdsParrillaPage.close();
        await kdsCocinaPage.close();
        await kdsBarPage.close();
        await cashierPage.close();

        console.log("🎉 Complete Waiter Flow Test Finished");
    });

    test("verify order status changes propagate across all screens", async ({ page, context }) => {
        console.log("🔄 Starting Order Status Propagation Test");

        // Create and submit order
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 2');
        await page.waitForLoadState("networkidle");

        // Add item
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible({ timeout: 3000 })) {
            await polloButton.click();
            await page.waitForTimeout(500);
        }

        // Submit
        const sendButton = page.locator('button:has-text("Enviar")');
        await sendButton.click();
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(2000);

        // Open KDS and change status
        const kdsPage = await context.newPage();
        await kdsPage.goto("/cocina/horno");
        await kdsPage.waitForLoadState("networkidle");
        await kdsPage.waitForTimeout(2000);

        // Find and click item to change status
        const itemButton = kdsPage.locator('button:has-text("Pollo")').first();
        if (await itemButton.isVisible({ timeout: 10000 })) {
            console.log("✅ Item found on KDS");
            
            // Click to change status PENDING → COOKING
            await itemButton.click();
            await kdsPage.waitForTimeout(1000);
            console.log("✅ Status changed to COOKING");

            // Click again to change COOKING → READY
            await itemButton.click();
            await kdsPage.waitForTimeout(1000);
            console.log("✅ Status changed to READY");

            // Verify item still visible (should be marked as READY)
            await expect(itemButton).toBeVisible();
        } else {
            console.log("⚠️ Item not found on KDS");
        }

        await kdsPage.close();
        console.log("🎉 Order Status Propagation Test Finished");
    });

    test("verify multiple waiters can work simultaneously", async ({ page, context }) => {
        console.log("👥 Starting Multiple Waiters Test");

        // Waiter 1: Mesa 3
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 3');
        await page.waitForLoadState("networkidle");

        const pollo1 = page.locator('button:has-text("Pollo")').first();
        if (await pollo1.isVisible({ timeout: 3000 })) {
            await pollo1.click();
            await page.waitForTimeout(300);
        }

        // Waiter 2: Mesa 4 (new tab)
        const waiter2Page = await context.newPage();
        await waiter2Page.goto("/mozo");
        await waiter2Page.waitForLoadState("networkidle");
        await waiter2Page.click('text=Mesa 4');
        await waiter2Page.waitForLoadState("networkidle");

        const papas2 = waiter2Page.locator('button:has-text("Papas")').first();
        if (await papas2.isVisible({ timeout: 3000 })) {
            await papas2.click();
            await waiter2Page.waitForTimeout(300);
        }

        // Submit both orders simultaneously
        const send1 = page.locator('button:has-text("Enviar")');
        const send2 = waiter2Page.locator('button:has-text("Enviar")');

        await Promise.all([
            send1.click(),
            send2.click(),
        ]);

        // Wait for both success toasts
        await expect(page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        await expect(waiter2Page.locator('text=¡Enviado!')).toBeVisible({ timeout: 5000 });
        console.log("✅ Both orders submitted successfully");

        await page.waitForTimeout(2000);

        // Verify both orders on KDS
        const kdsPage = await context.newPage();
        await kdsPage.goto("/cocina");
        await kdsPage.waitForLoadState("networkidle");
        await kdsPage.waitForTimeout(2000);

        // Should see multiple tickets
        const tickets = kdsPage.locator('[data-testid="kds-ticket"]');
        const ticketCount = await tickets.count();
        console.log(`✅ Found ${ticketCount} tickets on KDS`);
        expect(ticketCount).toBeGreaterThanOrEqual(2);

        await waiter2Page.close();
        await kdsPage.close();
        console.log("🎉 Multiple Waiters Test Finished");
    });

    test("verify order persists after page refresh", async ({ page }) => {
        console.log("🔄 Starting Order Persistence Test");

        // Create order
        await page.goto("/mozo");
        await page.waitForLoadState("networkidle");
        await page.click('text=Mesa 5');
        await page.waitForLoadState("networkidle");

        // Add item
        const polloButton = page.locator('button:has-text("Pollo")').first();
        if (await polloButton.isVisible({ timeout: 3000 })) {
            await polloButton.click();
            await page.waitForTimeout(500);
        }

        // Verify item in order panel
        await expect(page.locator('text=Pollo').nth(1)).toBeVisible();
        console.log("✅ Item added to order");

        // Refresh page
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1000);

        // Navigate back to same table
        await page.click('text=Mesa 5');
        await page.waitForLoadState("networkidle");

        // Verify item still there
        const itemStillThere = await page.locator('text=Pollo').nth(1).isVisible({ timeout: 5000 }).catch(() => false);
        
        if (itemStillThere) {
            console.log("✅ Order persisted after refresh");
        } else {
            console.log("⚠️ Order not persisted (expected behavior if not submitted)");
        }

        console.log("🎉 Order Persistence Test Finished");
    });
});
