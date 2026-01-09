/**
 * Property Test: Notification Routing Correctness (Property 7)
 * 
 * For any ORDER_ITEM_STATUS_CHANGED event with to: 'READY':
 * - The notification SHALL be sent to the waiter_id of the order
 * - The notification SHALL NOT be sent to other employees
 * 
 * For any REQUEST_CHECK event:
 * - The notification SHALL be sent to all employees with role 'CASHIER'
 * - The notification SHALL NOT be sent to non-CASHIER roles
 * 
 * Validates: Requirements 5.1, 6.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Track which employees received notifications
let notificationsSent: Array<{ tenantId: string; employeeId: string; type: string }> = [];
let roleNotificationsSent: Array<{ tenantId: string; role: string; type: string }> = [];

// Mock notification service
vi.mock('../notification.service', () => ({
  sendToEmployee: vi.fn().mockImplementation(async (tenantId, employeeId, payload) => {
    notificationsSent.push({ tenantId, employeeId, type: payload.type });
    return { sent: 1, failed: 0 };
  }),
  sendToRole: vi.fn().mockImplementation(async (tenantId, role, payload) => {
    roleNotificationsSent.push({ tenantId, role, type: payload.type });
    return { sent: 1, failed: 0 };
  }),
}));

// Mock prisma
const mockOrders: Map<string, {
  id: string;
  waiter_id: string | null;
  total_cents: number;
  fulfillment: { table_number?: string } | null;
  items: Array<{ id: string; product_name: string; station: string }> | null;
}> = new Map();

const mockEmployees: Map<string, {
  id: string;
  name: string;
  role: string;
}> = new Map();

const mockPrisma = {
  orders: {
    findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => {
      return mockOrders.get(args.where.id) || null;
    }),
  },
  employees: {
    findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => {
      return mockEmployees.get(args.where.id) || null;
    }),
  },
};

vi.mock('@/src/core/db/prisma', () => ({
  default: mockPrisma,
}));

// Generators
const uuidArb = fc.uuid();
const tableNumberArb = fc.integer({ min: 1, max: 99 }).map(n => String(n));
const productNameArb = fc.constantFrom('Pollo a la Brasa', '1/4 Pollo', 'Papas Fritas', 'Ensalada', 'Chicha Morada', 'Inca Kola');
const stationArb = fc.constantFrom('COCINA', 'HORNO', 'BAR');
const waiterNameArb = fc.constantFrom('Juan', 'María', 'Carlos', 'Ana', 'Pedro');

describe('Property 7: Notification Routing Correctness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationsSent = [];
    roleNotificationsSent = [];
    mockOrders.clear();
    mockEmployees.clear();
  });

  afterEach(async () => {
    // Clear pending notifications
    const { clearPendingNotifications } = await import('../event-handlers');
    clearPendingNotifications();
  });

  it('Property 7.1: ITEM_READY notification sent to waiter_id of the order', async () => {
    const { handleItemReady, flushPendingNotifications } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        tableNumberArb,
        productNameArb,
        stationArb,
        async (tenantId, orderId, itemId, waiterId, tableNumber, productName, station) => {
          // Setup mock data with items in the order
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: waiterId,
            total_cents: 5000,
            fulfillment: { table_number: tableNumber },
            items: [{ id: itemId, product_name: productName, station: station }],
          });
          notificationsSent = [];

          // Create event
          const event = {
            type: 'ORDER_ITEM_STATUS_CHANGED' as const,
            payload: {
              order_id: orderId,
              item_id: itemId,
              from: 'COOKING',
              to: 'READY',
            },
            meta: {
              tenant_id: tenantId,
              terminal_id: 'terminal-1',
              timestamp: new Date().toISOString(),
            },
          };

          // Handle event
          await handleItemReady(event);
          
          // Flush pending notifications (bypass 5s grouping)
          await flushPendingNotifications();

          // Verify notification sent to correct waiter
          expect(notificationsSent.length).toBe(1);
          expect(notificationsSent[0].employeeId).toBe(waiterId);
          expect(notificationsSent[0].tenantId).toBe(tenantId);
          expect(notificationsSent[0].type).toBe('ITEM_READY');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.2: ITEM_READY notification NOT sent when status is not READY', async () => {
    const { handleItemReady } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        fc.constantFrom('PENDING', 'COOKING', 'DELIVERED', 'CANCELLED'),
        async (tenantId, orderId, itemId, waiterId, toStatus) => {
          // Setup mock data with items in the order
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: waiterId,
            total_cents: 5000,
            fulfillment: { table_number: '1' },
            items: [{ id: itemId, product_name: 'Test Item', station: 'COCINA' }],
          });
          notificationsSent = [];

          // Create event with non-READY status
          const event = {
            type: 'ORDER_ITEM_STATUS_CHANGED' as const,
            payload: {
              order_id: orderId,
              item_id: itemId,
              from: 'PENDING',
              to: toStatus,
            },
            meta: {
              tenant_id: tenantId,
              terminal_id: 'terminal-1',
              timestamp: new Date().toISOString(),
            },
          };

          // Handle event
          await handleItemReady(event);

          // No notification should be sent
          expect(notificationsSent.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.3: REQUEST_CHECK notification sent to CASHIER role', async () => {
    const { handleRequestCheck } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        tableNumberArb,
        waiterNameArb,
        fc.integer({ min: 1000, max: 100000 }),
        async (tenantId, orderId, tableId, waiterId, tableNumber, waiterName, totalCents) => {
          // Setup mock data
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: waiterId,
            total_cents: totalCents,
            fulfillment: { table_number: tableNumber },
            items: [{ id: 'item-1', product_name: 'Test Item', station: 'COCINA' }],
          });
          mockEmployees.set(waiterId, {
            id: waiterId,
            name: waiterName,
            role: 'WAITER',
          });
          roleNotificationsSent = [];

          // Create event
          const event = {
            type: 'REQUEST_CHECK' as const,
            payload: {
              order_id: orderId,
              table_id: tableId,
            },
            meta: {
              tenant_id: tenantId,
              terminal_id: 'terminal-1',
              actor_id: waiterId,
              timestamp: new Date().toISOString(),
            },
          };

          // Handle event
          await handleRequestCheck(event);

          // Verify notification sent to CASHIER role
          expect(roleNotificationsSent.length).toBe(1);
          expect(roleNotificationsSent[0].role).toBe('CASHIER');
          expect(roleNotificationsSent[0].tenantId).toBe(tenantId);
          expect(roleNotificationsSent[0].type).toBe('REQUEST_CHECK');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.4: ITEM_READY not sent when order has no waiter', async () => {
    const { handleItemReady, flushPendingNotifications } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        async (tenantId, orderId, itemId) => {
          // Setup mock data with no waiter
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: null,
            total_cents: 5000,
            fulfillment: { table_number: '1' },
            items: [{ id: itemId, product_name: 'Test Item', station: 'COCINA' }],
          });
          notificationsSent = [];

          // Create event
          const event = {
            type: 'ORDER_ITEM_STATUS_CHANGED' as const,
            payload: {
              order_id: orderId,
              item_id: itemId,
              from: 'COOKING',
              to: 'READY',
            },
            meta: {
              tenant_id: tenantId,
              terminal_id: 'terminal-1',
              timestamp: new Date().toISOString(),
            },
          };

          // Handle event
          await handleItemReady(event);
          await flushPendingNotifications();

          // No notification should be sent
          expect(notificationsSent.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7.5: ITEM_READY not sent when order not found', async () => {
    const { handleItemReady, flushPendingNotifications } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        async (tenantId, orderId, itemId) => {
          // Don't setup order - it won't be found
          notificationsSent = [];

          // Create event
          const event = {
            type: 'ORDER_ITEM_STATUS_CHANGED' as const,
            payload: {
              order_id: orderId,
              item_id: itemId,
              from: 'COOKING',
              to: 'READY',
            },
            meta: {
              tenant_id: tenantId,
              terminal_id: 'terminal-1',
              timestamp: new Date().toISOString(),
            },
          };

          // Handle event
          await handleItemReady(event);
          await flushPendingNotifications();

          // No notification should be sent
          expect(notificationsSent.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
