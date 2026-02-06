import { test, expect } from "@playwright/test";
import { setupTerminalConfig } from "./helpers/terminal-setup";

/**
 * Debug Test: Waiter Page Diagnosis
 * 
 * This test helps diagnose why the waiter page is not showing tables
 * 
 * Fix (5 Feb 2026): Added terminal configuration setup to prevent redirect
 */

test.describe("Waiter Page Diagnosis", () => {
    test("diagnose waiter page loading", async ({ page, context }) => {
        // CRITICAL: Set localStorage AND sessionStorage BEFORE any page loads
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

        // Capture console logs
        const consoleLogs: string[] = [];
        page.on('console', msg => {
            consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
        });

        // Capture page errors
        const pageErrors: string[] = [];
        page.on('pageerror', error => {
            pageErrors.push(error.message);
        });

        // Now navigate directly to waiter page (localStorage already set)
        console.log("Navigating to /mozo...");
        await page.goto("/mozo", { waitUntil: 'domcontentloaded' });
        
        // Wait for specific elements instead of networkidle
        await page.waitForSelector('text=MESERO', { timeout: 10000 }).catch(() => {
            console.log("MESERO header not found");
        });
        
        await page.waitForTimeout(2000);

        // Take screenshot
        await page.screenshot({ path: 'test-results/waiter-page-debug.png', fullPage: true });

        // Get page title
        const title = await page.title();
        console.log(`Page title: ${title}`);

        // Get page URL (check if redirected)
        const url = page.url();
        console.log(`Current URL: ${url}`);

        // Check if terminal config modal is showing
        const terminalModal = page.locator('text=Terminal no configurado');
        if (await terminalModal.isVisible()) {
            console.log("❌ Terminal not configured modal is showing");
        }

        // Check if login/auth is required
        const loginForm = page.locator('input[type="password"]');
        if (await loginForm.isVisible()) {
            console.log("❌ Login form is showing");
        }

        // Check for any visible text
        const bodyText = await page.locator('body').textContent();
        console.log(`Body text (first 500 chars): ${bodyText?.substring(0, 500)}`);

        // Look for mesa buttons
        const mesaButtons = page.locator('text=/Mesa \\d+/');
        const mesaCount = await mesaButtons.count();
        console.log(`Found ${mesaCount} mesa buttons`);

        // Look for any buttons
        const allButtons = page.locator('button');
        const buttonCount = await allButtons.count();
        console.log(`Found ${buttonCount} total buttons`);

        // Print first 5 button texts
        for (let i = 0; i < Math.min(5, buttonCount); i++) {
            const buttonText = await allButtons.nth(i).textContent();
            console.log(`Button ${i}: ${buttonText}`);
        }

        // Print console logs
        console.log("\n=== Console Logs ===");
        consoleLogs.forEach(log => console.log(log));

        // Print page errors
        if (pageErrors.length > 0) {
            console.log("\n=== Page Errors ===");
            pageErrors.forEach(error => console.log(error));
        }

        // Assertions
        expect(url).toContain("/mozo");
        expect(mesaCount).toBeGreaterThan(0);
    });
});
