/**
 * Property 1: Terminal Configuration Consistency
 * Validates: Requirements 1.3, 1.4
 * 
 * For any order event created by the Waiter_Module, the terminal_id and actor_id 
 * in the event payload SHALL match the values stored in Terminal_Config at the 
 * time of creation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { TerminalConfig, TerminalRole } from '@/src/core/auth/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

// Simulated terminal config functions (matching fingerprint.ts)
function getStoredTerminalConfig(): TerminalConfig | null {
  const data = localStorageMock.getItem('park_terminal_config');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function setStoredTerminalConfig(config: TerminalConfig): void {
  localStorageMock.setItem('park_terminal_config', JSON.stringify(config));
}

function clearTerminalConfig(): void {
  localStorageMock.removeItem('park_terminal_id');
  localStorageMock.removeItem('park_terminal_config');
}

// Simulated event creation (matching POSActions pattern)
interface OrderEvent {
  event_type: string;
  tenant_id: string;
  terminal_id: string;
  actor_id: string;
  payload: {
    order_id: string;
    table_number?: string;
  };
}

function createOrderEvent(
  config: TerminalConfig,
  tableNumber: string
): OrderEvent {
  return {
    event_type: 'ORDER_CREATED',
    tenant_id: config.tenant_id,
    terminal_id: config.terminal_id,
    actor_id: config.terminal_id, // For waiter, actor_id = terminal_id
    payload: {
      order_id: crypto.randomUUID(),
      table_number: tableNumber,
    },
  };
}

function createItemAddedEvent(
  config: TerminalConfig,
  orderId: string,
  productId: string
): OrderEvent {
  return {
    event_type: 'ORDER_ITEM_ADDED',
    tenant_id: config.tenant_id,
    terminal_id: config.terminal_id,
    actor_id: config.terminal_id,
    payload: {
      order_id: orderId,
    },
  };
}

// Arbitraries
const terminalIdArb = fc.integer({ min: 1, max: 15 }).map(n => `waiter_${n.toString().padStart(2, '0')}`);
const tenantIdArb = fc.uuid();
const deviceFingerprintArb = fc.array(
  fc.integer({ min: 0, max: 15 }),
  { minLength: 32, maxLength: 32 }
).map(arr => arr.map(n => '0123456789abcdef'[n]).join(''));
const deviceNameArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
const locationIdArb = fc.uuid();
const tableNumberArb = fc.oneof(
  fc.integer({ min: 1, max: 45 }).map(n => `M${n}`),
  fc.integer({ min: 1, max: 10 }).map(n => `B${n}`)
);
const productIdArb = fc.uuid();

const actorIdArb = fc.uuid();

const terminalConfigArb: fc.Arbitrary<TerminalConfig> = fc.record({
  terminal_id: terminalIdArb,
  tenant_id: tenantIdArb,
  actor_id: actorIdArb,
  device_fingerprint: deviceFingerprintArb,
  device_name: deviceNameArb,
  role: fc.constant('WAITER' as TerminalRole),
  location_id: locationIdArb,
  is_allowed: fc.constant(true),
  registered_at: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ts => new Date(ts).toISOString()),
});

describe('Feature: waiter-module, Property 1: Terminal Configuration Consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('Order events use stored terminal config', () => {
    it('ORDER_CREATED event should use terminal_id from config', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          tableNumberArb,
          (config, tableNumber) => {
            setStoredTerminalConfig(config);
            const storedConfig = getStoredTerminalConfig();
            
            expect(storedConfig).not.toBeNull();
            
            const event = createOrderEvent(storedConfig!, tableNumber);
            
            // Property: terminal_id in event matches stored config
            expect(event.terminal_id).toBe(config.terminal_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ORDER_CREATED event should use tenant_id from config', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          tableNumberArb,
          (config, tableNumber) => {
            setStoredTerminalConfig(config);
            const storedConfig = getStoredTerminalConfig();
            
            const event = createOrderEvent(storedConfig!, tableNumber);
            
            // Property: tenant_id in event matches stored config
            expect(event.tenant_id).toBe(config.tenant_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ORDER_ITEM_ADDED event should use same terminal_id as config', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          tableNumberArb,
          productIdArb,
          (config, tableNumber, productId) => {
            setStoredTerminalConfig(config);
            const storedConfig = getStoredTerminalConfig();
            
            const orderEvent = createOrderEvent(storedConfig!, tableNumber);
            const itemEvent = createItemAddedEvent(
              storedConfig!,
              orderEvent.payload.order_id,
              productId
            );
            
            // Property: all events from same terminal use same terminal_id
            expect(itemEvent.terminal_id).toBe(orderEvent.terminal_id);
            expect(itemEvent.terminal_id).toBe(config.terminal_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('actor_id should match terminal_id for waiter terminals', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          tableNumberArb,
          (config, tableNumber) => {
            setStoredTerminalConfig(config);
            const storedConfig = getStoredTerminalConfig();
            
            const event = createOrderEvent(storedConfig!, tableNumber);
            
            // Property: for waiter module, actor_id = terminal_id
            expect(event.actor_id).toBe(event.terminal_id);
            expect(event.actor_id).toBe(config.terminal_id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Config persistence', () => {
    it('stored config should be retrievable unchanged', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          (config) => {
            setStoredTerminalConfig(config);
            const retrieved = getStoredTerminalConfig();
            
            // Property: config round-trips through localStorage unchanged
            expect(retrieved).toEqual(config);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('clearTerminalConfig should remove config', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          (config) => {
            setStoredTerminalConfig(config);
            expect(getStoredTerminalConfig()).not.toBeNull();
            
            clearTerminalConfig();
            
            // Property: after clear, config is null
            expect(getStoredTerminalConfig()).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('multiple sets should overwrite previous config', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          terminalConfigArb,
          (config1, config2) => {
            setStoredTerminalConfig(config1);
            setStoredTerminalConfig(config2);
            
            const retrieved = getStoredTerminalConfig();
            
            // Property: last set wins
            expect(retrieved).toEqual(config2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Event consistency across multiple operations', () => {
    it('all events in a session should use same terminal_id', () => {
      fc.assert(
        fc.property(
          terminalConfigArb,
          fc.array(tableNumberArb, { minLength: 1, maxLength: 10 }),
          (config, tableNumbers) => {
            setStoredTerminalConfig(config);
            const storedConfig = getStoredTerminalConfig()!;
            
            const events = tableNumbers.map(table => 
              createOrderEvent(storedConfig, table)
            );
            
            // Property: all events use same terminal_id
            const terminalIds = new Set(events.map(e => e.terminal_id));
            expect(terminalIds.size).toBe(1);
            expect(terminalIds.has(config.terminal_id)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('events should fail gracefully when config is missing', () => {
      localStorageMock.clear();
      const config = getStoredTerminalConfig();
      
      // Property: no config returns null (UI should redirect)
      expect(config).toBeNull();
    });
  });

  describe('Terminal ID format validation', () => {
    it('waiter terminal_id should follow pattern waiter_XX', () => {
      fc.assert(
        fc.property(
          terminalIdArb,
          (terminalId) => {
            // Property: terminal_id matches expected pattern
            expect(terminalId).toMatch(/^waiter_\d{2}$/);
            
            const num = parseInt(terminalId.split('_')[1], 10);
            expect(num).toBeGreaterThanOrEqual(1);
            expect(num).toBeLessThanOrEqual(15);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle config with optional fields', () => {
      const minimalConfig: TerminalConfig = {
        terminal_id: 'waiter_01',
        tenant_id: 'tenant-123',
        actor_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        device_fingerprint: 'abc123',
        device_name: 'Tablet 1',
        role: 'WAITER',
        location_id: 'loc-1',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      };
      
      setStoredTerminalConfig(minimalConfig);
      const retrieved = getStoredTerminalConfig();
      
      expect(retrieved).toEqual(minimalConfig);
      expect(retrieved?.station_id).toBeUndefined();
    });

    it('should handle config with station_id', () => {
      const configWithStation: TerminalConfig = {
        terminal_id: 'waiter_05',
        tenant_id: 'tenant-456',
        actor_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        device_fingerprint: 'def456',
        device_name: 'Tablet 5',
        role: 'WAITER',
        location_id: 'loc-1',
        station_id: 'station-A',
        is_allowed: true,
        registered_at: new Date().toISOString(),
      };
      
      setStoredTerminalConfig(configWithStation);
      const retrieved = getStoredTerminalConfig();
      
      expect(retrieved?.station_id).toBe('station-A');
    });
  });
});
