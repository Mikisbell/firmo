/**
 * E2E Test Utilities for PARK POS
 */
import { Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

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
    event_id: uuidv4(),
    event_type: 'ORDER_CREATED',
    tenant_id: TENANT_ID,
    terminal_id: TERMINALS.CAJA,
    occurred_at: new Date().toISOString(),
    aggregate_type: 'ORDER',
    aggregate_id: orderId,
    schema_version: 1,
    terminal_sequence: 1,
    correlation_id: uuidv4(),
    payload: {
      order_id: orderId,
      order_number: orderNumber,
      order_type: 'DINE_IN',
      items: items,
      checks: [{ 
        check_id: uuidv4(), 
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

/**
 * Setup Waiter Terminal with Session
 * Configures localStorage with waiter terminal and session data
 */
export async function setupWaiterTerminal(page: Page) {
    await page.goto("/");
    
    await page.evaluate(({ tenantId }) => {
        // Terminal configuration
        const terminalConfig = {
            terminal_id: "waiter_test_1",
            tenant_id: tenantId,
            device_fingerprint: "test-fingerprint-waiter-" + Date.now(),
            device_name: "Test Waiter Terminal",
            role: "WAITER",
            location_id: "LOC01",
            is_allowed: true,
            registered_at: new Date().toISOString(),
        };
        localStorage.setItem('park_terminal_config', JSON.stringify(terminalConfig));
        
        // Session
        const session = {
            employee_id: "00000000-0000-0000-0000-000000000002",
            role: "WAITER",
            terminal_id: "waiter_test_1",
            logged_in_at: new Date().toISOString(),
            pin_verified: true,
        };
        localStorage.setItem('park_session', JSON.stringify(session));
    }, { tenantId: TENANT_ID });
    
    // Seed test data in IndexedDB
    await page.evaluate(async ({ tenantId }) => {
        // Open IndexedDB
        const dbName = 'park_pos_db';
        const request = indexedDB.open(dbName, 1);
        
        await new Promise((resolve, reject) => {
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains('events')) {
                    db.createObjectStore('events', { keyPath: 'event_id' });
                }
                if (!db.objectStoreNames.contains('catalog')) {
                    db.createObjectStore('catalog', { keyPath: 'id' });
                }
            };
        });
        
        const db = request.result as IDBDatabase;
        
        // Add test products to catalog
        const catalogTx = db.transaction(['catalog'], 'readwrite');
        const catalogStore = catalogTx.objectStore('catalog');
        
        const testProducts = [
            {
                id: 'prod-pollo',
                name: 'Pollo',
                price_cents: 3500,
                category: 'PLATOS',
                station: 'PARRILLA',
                is_active: true,
            },
            {
                id: 'prod-papas',
                name: 'Papas',
                price_cents: 800,
                category: 'ACOMPAÑAMIENTOS',
                station: 'COCINA',
                is_active: true,
            },
            {
                id: 'prod-gaseosa',
                name: 'Gaseosa',
                price_cents: 500,
                category: 'BEBIDAS',
                station: 'BAR',
                is_active: true,
            },
        ];
        
        for (const product of testProducts) {
            catalogStore.put(product);
        }
        
        await new Promise((resolve, reject) => {
            catalogTx.oncomplete = () => resolve(undefined);
            catalogTx.onerror = () => reject(catalogTx.error);
        });
        
        db.close();
    }, { tenantId: TENANT_ID });
    
    await page.waitForLoadState("networkidle");
}

/**
 * Setup KDS Terminal with Session
 * Configures localStorage with KDS terminal data for specific station
 */
export async function setupKDSTerminal(page: Page, station: string) {
    await page.goto("/");
    
    await page.evaluate(({ station, tenantId }) => {
        const terminalConfig = {
            terminal_id: `kds_${station.toLowerCase()}`,
            tenant_id: tenantId,
            device_fingerprint: `test-fingerprint-kds-${station}-` + Date.now(),
            device_name: `Test KDS ${station}`,
            role: "COOK",
            station: station,
            location_id: "LOC01",
            is_allowed: true,
            registered_at: new Date().toISOString(),
        };
        localStorage.setItem('park_terminal_config', JSON.stringify(terminalConfig));
        
        // Session for KDS
        const session = {
            employee_id: "00000000-0000-0000-0000-000000000003",
            role: "COOK",
            terminal_id: `kds_${station.toLowerCase()}`,
            logged_in_at: new Date().toISOString(),
            pin_verified: true,
        };
        localStorage.setItem('park_session', JSON.stringify(session));
    }, { station, tenantId: TENANT_ID });
    
    await page.waitForLoadState("networkidle");
}

/**
 * Setup Cashier Terminal with Session
 * Configures localStorage with cashier terminal data
 */
export async function setupCashierTerminal(page: Page) {
    await page.goto("/");
    
    await page.evaluate(({ tenantId }) => {
        const terminalConfig = {
            terminal_id: "cashier_test_1",
            tenant_id: tenantId,
            device_fingerprint: "test-fingerprint-cashier-" + Date.now(),
            device_name: "Test Cashier Terminal",
            role: "CASHIER",
            location_id: "LOC01",
            is_allowed: true,
            registered_at: new Date().toISOString(),
        };
        localStorage.setItem('park_terminal_config', JSON.stringify(terminalConfig));
        
        // Session for Cashier
        const session = {
            employee_id: "00000000-0000-0000-0000-000000000004",
            role: "CASHIER",
            terminal_id: "cashier_test_1",
            logged_in_at: new Date().toISOString(),
            pin_verified: true,
        };
        localStorage.setItem('park_session', JSON.stringify(session));
    }, { tenantId: TENANT_ID });
    
    await page.waitForLoadState("networkidle");
}

/**
 * Authenticate as Admin via UI
 * Navigates to admin panel and logs in with PIN using PinPad
 */
export async function authenticateAsAdmin(page: Page, pin: string = TEST_PINS.ADMIN, tenantId?: string): Promise<void> {
    // Navigate to admin panel
    await page.goto('http://localhost:3000/admin');
    
    // Set tenant_id in localStorage if provided (for multi-tenant E2E tests)
    if (tenantId) {
        await page.evaluate((tid) => {
            localStorage.setItem('tenant_id', tid);
        }, tenantId);
        console.log(`[authenticateAsAdmin] Set tenant_id in localStorage: ${tenantId}`);
    }
    
    // Wait for PinPad to appear
    await page.waitForSelector('[data-testid="pin-pad"]', { timeout: 10000 });
    
    // Enter PIN using PinPad buttons
    for (const digit of pin) {
        await page.click(`button:has-text("${digit}")`);
        await page.waitForTimeout(100); // Small delay between clicks
    }
    
    // Wait for authentication to complete and redirect
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    
    // Wait for admin panel to load
    await page.waitForLoadState('networkidle');
}

/**
 * Logout from Admin Panel
 * Opens user dropdown and clicks logout button
 * Works on both desktop and mobile (uses force: true for mobile)
 */
export async function logoutFromAdmin(page: Page): Promise<void> {
    // Open user dropdown with force click for mobile compatibility
    await page.click('button:has(svg.lucide-chevron-down)', { force: true });
    
    // Wait for dropdown animation
    await page.waitForTimeout(500);
    
    // Click logout button
    await page.click('button:has-text("Cerrar Sesión")');
    
    // Wait for logout to complete
    await page.waitForTimeout(1000);
}
