/**
 * E2E Test Utilities for PARK POS
 */
import { Page } from '@playwright/test';

export const TENANT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const API_SECRET = 'park_secret_mvp_2025';

// Test PINs from seed.ts
export const TEST_PINS = {
  ADMIN: '1234',
  CASHIER: '1111',
  WAITER: '2222',
  MANAGER: '0000',
  KITCHEN: '4444',
};

// Terminal IDs
export const TERMINALS = {
  CAJA: 'CAJA_01',
  MOZO_1: 'MOZO_01',
  MOZO_2: 'MOZO_02',
  COCINA: 'SPC_COCINA',
  HORNO: 'SPC_HORNO',
  BAR: 'SPC_BAR',
};

/**
 * Setup terminal in localStorage before navigating
 */
export async function setupTerminal(page: Page, terminalId: string, role: string) {
  await page.addInitScript(({ terminalId, role, tenantId }) => {
    const config = {
      terminal_id: terminalId,
      tenant_id: tenantId,
      device_fingerprint: 'test-fingerprint-' + terminalId,
      device_name: terminalId,
      role: role,
      location_id: 'LOC01',
      is_allowed: true,
      registered_at: new Date().toISOString(),
    };
    localStorage.setItem('park_terminal_config', JSON.stringify(config));
  }, { terminalId, role, tenantId: TENANT_ID });
}

/**
 * Login with PIN
 */
export async function loginWithPin(page: Page, pin: string) {
  // Wait for PIN pad to appear
  await page.waitForSelector('[data-testid="pin-pad"]', { timeout: 10000 }).catch(() => {
    // PIN pad might not be required if already logged in
  });
  
  // Enter PIN digits
  for (const digit of pin) {
    await page.click(`button:has-text("${digit}")`);
  }
  
  // Wait for login to complete
  await page.waitForTimeout(1000);
}

/**
 * Create an order via API
 */
export async function createOrderViaAPI(orderId: string, orderNumber: number, items: any[] = []) {
  const event = {
    event_id: crypto.randomUUID(),
    event_type: 'ORDER_CREATED',
    tenant_id: TENANT_ID,
    terminal_id: TERMINALS.CAJA,
    occurred_at: new Date().toISOString(),
    aggregate_type: 'ORDER',
    aggregate_id: orderId,
    schema_version: 1,
    terminal_sequence: 1,
    correlation_id: crypto.randomUUID(),
    payload: {
      order_id: orderId,
      order_number: orderNumber,
      order_type: 'DINE_IN',
      items: items,
      checks: [{ 
        check_id: crypto.randomUUID(), 
        lines: items,
        payment: { status: 'UNPAID', payments: [] },
        total_cents: items.reduce((sum: number, i: any) => sum + (i.price_cents * i.qty), 0),
      }],
    },
  };

  const response = await fetch('http://localhost:3000/api/events/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': API_SECRET,
    },
    body: JSON.stringify({
      tenant_id: TENANT_ID,
      terminal_id: TERMINALS.CAJA,
      events: [event],
      from_terminal_sequence: 0,
      to_terminal_sequence: 1,
    }),
  });

  return response.json();
}

/**
 * Wait for element with retry
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Generate unique order number for tests
 */
export function generateOrderNumber(): number {
  return 90000 + Math.floor(Math.random() * 9999);
}

/**
 * Generate UUID
 */
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
