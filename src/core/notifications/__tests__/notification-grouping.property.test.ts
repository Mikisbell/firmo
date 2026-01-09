/**
 * Property Test: Notification Grouping (Property 9)
 * 
 * For any sequence of ITEM_READY events for the same order within 5 seconds,
 * the system SHALL send at most ONE notification containing all ready items.
 * 
 * Validates: Requirements 5.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Track notifications sent
let notificationsSent: Array<{
  tenantId: string;
  employeeId: string;
  payload: { type: string; body: string; data: { order_id: string } };
}> = [];

// Mock notification service
vi.mock('../notification.service', () => ({
  sendToEmployee: vi.fn().mockImplementation(async (tenantId, employeeId, payload) => {
    notificationsSent.push({ tenantId, employeeId, payload });
    return { sent: 1, failed: 0 };
  }),
  sendToRole: vi.fn().mockResolvedValue({ sent: 1, failed: 0 }),
}));

// Mock prisma
const mockOrders: Map<string, {
  id: string;
  waiter_id: string | null;
  total_cents: number;
  fulfillment: { table_number?: string } | null;
  items: Array<{ id: string; product_name: string; station: string }> | null;
}> = new Map();

const mockPrisma = {
  orders: {
    findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => {
      return mockOrders.get(args.where.id) || null;
    }),
  },
  employees: {
    findUnique: vi.fn().mockResolvedValue({ id: 'waiter-1', name: 'Juan', role: 'WAITER' }),
  },
};

vi.mock('@/src/core/db/prisma', () => ({
  default: mockPrisma,
}));

// Generators
const uuidArb = fc.uuid();
const tableNumberArb = fc.integer({ min: 1, max: 99 }).map(n => String(n));
const productNameArb = fc.constantFrom('Pollo a la Brasa', '1/4 Pollo', 'Papas Fritas', 'Ensalada', 'Chicha Morada');
const stationArb = fc.constantFrom('COCINA', 'HORNO', 'BAR');

describe('Property 9: Notification Grouping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationsSent = [];
    mockOrders.clear();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    // Clear pending notifications
    const { clearPendingNotifications } = await import('../event-handlers');
    clearPendingNotifications();
  });

  it('Property 9.1: Multiple items from same order result in single notification', async () => {
    const { handleItemReady, getPendingNotificationsCount } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        tableNumberArb,
        fc.array(
          fc.record({
            id: uuidArb,
            name: productNameArb,
            station: stationArb,
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (tenantId, orderId, waiterId, tableNumber, items) => {
          // Setup mock data with all items in the order
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: waiterId,
            total_cents: 5000,
            fulfillment: { table_number: tableNumber },
            items: items.map(item => ({
              id: item.id,
              product_name: item.name,
              station: item.station,
            })),
          });

          notificationsSent = [];

          // Send multiple ITEM_READY events for same order
          for (const item of items) {
            const event = {
              type: 'ORDER_ITEM_STATUS_CHANGED' as const,
              payload: {
                order_id: orderId,
                item_id: item.id,
                from: 'COOKING',
                to: 'READY',
              },
              meta: {
                tenant_id: tenantId,
                terminal_id: 'terminal-1',
                timestamp: new Date().toISOString(),
              },
            };
            await handleItemReady(event);
          }

          // Should have pending notification
          expect(getPendingNotificationsCount()).toBe(1);

          // No notification sent yet (within grouping window)
          expect(notificationsSent.length).toBe(0);

          // Advance time past grouping window (5 seconds)
          await vi.advanceTimersByTimeAsync(5100);

          // Now exactly ONE notification should be sent
          expect(notificationsSent.length).toBe(1);
          expect(notificationsSent[0].payload.data.order_id).toBe(orderId);
        }
      ),
      { numRuns: 50 } // Reduced due to timer complexity
    );
  });

  it('Property 9.2: Grouped notification contains all item names', async () => {
    const { handleItemReady } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        tableNumberArb,
        fc.array(
          fc.record({
            id: uuidArb,
            name: productNameArb,
            station: stationArb,
          }),
          { minLength: 2, maxLength: 3 }
        ),
        async (tenantId, orderId, waiterId, tableNumber, items) => {
          // Setup mock data with all items in the order
          mockOrders.set(orderId, {
            id: orderId,
            waiter_id: waiterId,
            total_cents: 5000,
            fulfillment: { table_number: tableNumber },
            items: items.map(item => ({
              id: item.id,
              product_name: item.name,
              station: item.station,
            })),
          });

          notificationsSent = [];

          // Send multiple ITEM_READY events
          for (const item of items) {
            const event = {
              type: 'ORDER_ITEM_STATUS_CHANGED' as const,
              payload: {
                order_id: orderId,
                item_id: item.id,
                from: 'COOKING',
                to: 'READY',
              },
              meta: {
                tenant_id: tenantId,
                terminal_id: 'terminal-1',
                timestamp: new Date().toISOString(),
              },
            };
            await handleItemReady(event);
          }

          // Advance time
          await vi.advanceTimersByTimeAsync(5100);

          // Notification body should mention item count
          expect(notificationsSent.length).toBe(1);
          expect(notificationsSent[0].payload.body).toContain(`${items.length} items`);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9.3: Different orders get separate notifications', async () => {
    const { handleItemReady } = await import('../event-handlers');

    await fc.assert(
      fc.asyncProperty(
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        uuidArb,
        tableNumberArb,
        tableNumberArb,
        async (tenantId, orderId1, orderId2, waiterId, itemId1, tableNumber1, tableNumber2) => {
          // Ensure different orders
          fc.pre(orderId1 !== orderId2);

          const itemId2 = crypto.randomUUID();

          // Setup mock data for two orders with items embedded
          mockOrders.set(orderId1, {
            id: orderId1,
            waiter_id: waiterId,
            total_cents: 5000,
            fulfillment: { table_number: tableNumber1 },
            items: [{ id: itemId1, product_name: 'Pollo', station: 'HORNO' }],
          });
          mockOrders.set(orderId2, {
            id: orderId2,
            waiter_id: waiterId,
            total_cents: 6000,
            fulfillment: { table_number: tableNumber2 },
            items: [{ id: itemId2, product_name: 'Papas', station: 'COCINA' }],
          });

          notificationsSent = [];

          // Send events for different orders
          await handleItemReady({
            type: 'ORDER_ITEM_STATUS_CHANGED',
            payload: { order_id: orderId1, item_id: itemId1, from: 'COOKING', to: 'READY' },
            meta: { tenant_id: tenantId, terminal_id: 'terminal-1', timestamp: new Date().toISOString() },
          });

          await handleItemReady({
            type: 'ORDER_ITEM_STATUS_CHANGED',
            payload: { order_id: orderId2, item_id: itemId2, from: 'COOKING', to: 'READY' },
            meta: { tenant_id: tenantId, terminal_id: 'terminal-1', timestamp: new Date().toISOString() },
          });

          // Advance time
          await vi.advanceTimersByTimeAsync(5100);

          // Should have TWO separate notifications
          expect(notificationsSent.length).toBe(2);
          
          const orderIds = notificationsSent.map(n => n.payload.data.order_id);
          expect(orderIds).toContain(orderId1);
          expect(orderIds).toContain(orderId2);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 9.4: Grouping window resets on new item', async () => {
    const { handleItemReady, getPendingNotificationsCount } = await import('../event-handlers');

    const tenantId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const waiterId = crypto.randomUUID();
    const itemId1 = crypto.randomUUID();
    const itemId2 = crypto.randomUUID();

    // Setup mock data with both items in the order
    mockOrders.set(orderId, {
      id: orderId,
      waiter_id: waiterId,
      total_cents: 5000,
      fulfillment: { table_number: '1' },
      items: [
        { id: itemId1, product_name: 'Pollo', station: 'HORNO' },
        { id: itemId2, product_name: 'Papas', station: 'COCINA' },
      ],
    });

    notificationsSent = [];

    // First item
    await handleItemReady({
      type: 'ORDER_ITEM_STATUS_CHANGED',
      payload: { order_id: orderId, item_id: itemId1, from: 'COOKING', to: 'READY' },
      meta: { tenant_id: tenantId, terminal_id: 'terminal-1', timestamp: new Date().toISOString() },
    });

    // Wait 3 seconds (within window)
    await vi.advanceTimersByTimeAsync(3000);
    expect(notificationsSent.length).toBe(0);

    // Second item - should reset timer
    await handleItemReady({
      type: 'ORDER_ITEM_STATUS_CHANGED',
      payload: { order_id: orderId, item_id: itemId2, from: 'COOKING', to: 'READY' },
      meta: { tenant_id: tenantId, terminal_id: 'terminal-1', timestamp: new Date().toISOString() },
    });

    // Wait another 3 seconds (6 total from first, but only 3 from second)
    await vi.advanceTimersByTimeAsync(3000);
    expect(notificationsSent.length).toBe(0); // Still waiting

    // Wait 2 more seconds (5 from second item)
    await vi.advanceTimersByTimeAsync(2100);
    expect(notificationsSent.length).toBe(1);
    expect(notificationsSent[0].payload.body).toContain('2 items');
  });

  it('Property 9.5: Pending count is zero after flush', async () => {
    const { handleItemReady, getPendingNotificationsCount, flushPendingNotifications } = await import('../event-handlers');

    const tenantId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const waiterId = crypto.randomUUID();
    const itemId = crypto.randomUUID();

    mockOrders.set(orderId, {
      id: orderId,
      waiter_id: waiterId,
      total_cents: 5000,
      fulfillment: { table_number: '1' },
      items: [{ id: itemId, product_name: 'Pollo', station: 'HORNO' }],
    });

    await handleItemReady({
      type: 'ORDER_ITEM_STATUS_CHANGED',
      payload: { order_id: orderId, item_id: itemId, from: 'COOKING', to: 'READY' },
      meta: { tenant_id: tenantId, terminal_id: 'terminal-1', timestamp: new Date().toISOString() },
    });

    expect(getPendingNotificationsCount()).toBe(1);

    await flushPendingNotifications();

    expect(getPendingNotificationsCount()).toBe(0);
    expect(notificationsSent.length).toBe(1);
  });
});
