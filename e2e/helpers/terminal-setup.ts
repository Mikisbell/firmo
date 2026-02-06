import { Page } from '@playwright/test';

/**
 * Terminal Setup Helper for E2E Tests
 * 
 * Configures terminal configuration in localStorage to bypass
 * the terminal configuration check in waiter/KDS/cashier pages.
 */

export interface TerminalConfig {
    tenant_id: string;
    terminal_id: string;
    actor_id: string;
    role: 'WAITER' | 'KDS' | 'CASHIER' | 'ADMIN';
    device_fingerprint: string;
    activated_at: string;
}

/**
 * Setup terminal configuration for E2E tests
 * 
 * IMPORTANT: This function must be called AFTER navigating to a page,
 * as localStorage is only accessible within a page context.
 * 
 * @param page - Playwright page instance
 * @param role - Terminal role (WAITER, KDS, CASHIER, ADMIN)
 * @param terminalNumber - Terminal number (default: 1)
 * @returns The configured terminal config
 * 
 * @example
 * ```typescript
 * await page.goto("/");
 * await setupTerminalConfig(page, 'WAITER', 1);
 * await page.goto("/mozo");
 * ```
 */
export async function setupTerminalConfig(
    page: Page,
    role: 'WAITER' | 'KDS' | 'CASHIER' | 'ADMIN' = 'WAITER',
    terminalNumber: number = 1
): Promise<TerminalConfig> {
    const config: TerminalConfig = {
        tenant_id: "00000000-0000-0000-0000-000000000001",
        terminal_id: `${role}_TEST_${String(terminalNumber).padStart(2, '0')}`,
        actor_id: `00000000-0000-0000-0000-00000000000${terminalNumber}`,
        role: role,
        device_fingerprint: `test-device-fingerprint-${role.toLowerCase()}-${terminalNumber}`,
        activated_at: new Date().toISOString()
    };

    // Store in localStorage (must be called after page navigation)
    // IMPORTANT: Use 'park_terminal_config' key (matches fingerprint.ts)
    await page.evaluate((cfg) => {
        localStorage.setItem('park_terminal_config', JSON.stringify(cfg));
    }, config);

    return config;
}

/**
 * Setup multiple terminal configurations for multi-terminal tests
 * 
 * @param page - Playwright page instance
 * @param configs - Array of terminal configurations
 */
export async function setupMultipleTerminals(
    page: Page,
    configs: Array<{ role: 'WAITER' | 'KDS' | 'CASHIER' | 'ADMIN'; terminalNumber: number }>
): Promise<TerminalConfig[]> {
    const terminalConfigs: TerminalConfig[] = [];

    for (const { role, terminalNumber } of configs) {
        const config = await setupTerminalConfig(page, role, terminalNumber);
        terminalConfigs.push(config);
    }

    return terminalConfigs;
}

/**
 * Clear terminal configuration from localStorage
 * 
 * @param page - Playwright page instance
 */
export async function clearTerminalConfig(page: Page): Promise<void> {
    await page.evaluate(() => {
        localStorage.removeItem('park_terminal_config');
    });
}

/**
 * Get current terminal configuration from localStorage
 * 
 * @param page - Playwright page instance
 * @returns The current terminal config or null
 */
export async function getTerminalConfig(page: Page): Promise<TerminalConfig | null> {
    return await page.evaluate(() => {
        const config = localStorage.getItem('park_terminal_config');
        return config ? JSON.parse(config) : null;
    });
}
