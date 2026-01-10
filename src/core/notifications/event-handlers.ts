/**
 * Event Handlers para Notificaciones
 * Se registran en el Event Bus para reaccionar a eventos relevantes
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { sendToEmployee, sendToRole } from './notification.service';
import type { NotificationPayload } from './types';

// Buffer for notification grouping (5 second window)
interface PendingNotification {
  orderId: string;
  waiterId: string;
  tenantId: string;
  tableNumber: string;
  items: Array<{ name: string; station: string }>;
  timer: ReturnType<typeof setTimeout> | null;
}

const pendingNotifications: Map<string, PendingNotification> = new Map();
const GROUPING_WINDOW_MS = 5000;

// Event types (simplified from domain events)
export interface OrderItemStatusChangedEvent {
  type: 'ORDER_ITEM_STATUS_CHANGED';
  payload: {
    order_id: string;
    item_id: string;
    from: string;
    to: string;
  };
  meta: {
    tenant_id: string;
    terminal_id: string;
    timestamp: string;
  };
}

export interface RequestCheckEvent {
  type: 'REQUEST_CHECK';
  payload: {
    order_id: string;
    table_id: string;
  };
  meta: {
    tenant_id: string;
    terminal_id: string;
    actor_id: string;
    timestamp: string;
  };
}

/**
 * Handle ORDER_ITEM_STATUS_CHANGED event when item becomes READY
 * Groups multiple items from same order within 5 second window
 */
export async function handleItemReady(event: OrderItemStatusChangedEvent): Promise<void> {
  // Only handle transitions to READY
  if (event.payload.to !== 'READY') {
    return;
  }

  const { order_id, item_id } = event.payload;
  const { tenant_id } = event.meta;

  // Get order details
  const order = await prisma.orders.findUnique({
    where: { id: order_id },
    select: {
      id: true,
      waiter_id: true,
      fulfillment: true,
      items: true,
    },
  });

  if (!order || !order.waiter_id) {
    logger.debug('NOTIFICATION_ORDER_NOT_FOUND', 'Order not found or no waiter assigned', { orderId: order_id });
    return;
  }

  // Get item details from order's items JSON array
  const items = order.items as Array<{
    id: string;
    product_name?: string;
    name?: string;
    station?: string;
  }> | null;
  
  const item = items?.find(i => i.id === item_id);

  if (!item) {
    logger.debug('NOTIFICATION_ITEM_NOT_FOUND', 'Item not found in order', { orderId: order_id, itemId: item_id });
    return;
  }

  // Extract table number from fulfillment
  const fulfillment = order.fulfillment as { table_number?: string } | null;
  const tableNumber = fulfillment?.table_number || 'N/A';

  // Group notifications by order
  const key = `${tenant_id}:${order_id}`;
  let pending = pendingNotifications.get(key);

  if (!pending) {
    pending = {
      orderId: order_id,
      waiterId: order.waiter_id,
      tenantId: tenant_id,
      tableNumber,
      items: [],
      timer: null,
    };
    pendingNotifications.set(key, pending);
  }

  // Add item to pending
  pending.items.push({
    name: item.product_name || item.name || 'Item',
    station: item.station || 'COCINA',
  });

  // Clear existing timer
  if (pending.timer) {
    clearTimeout(pending.timer);
  }

  // Set new timer to send grouped notification
  pending.timer = setTimeout(async () => {
    await sendGroupedItemReadyNotification(key);
  }, GROUPING_WINDOW_MS);
}

/**
 * Send grouped notification for all ready items
 */
async function sendGroupedItemReadyNotification(key: string): Promise<void> {
  const pending = pendingNotifications.get(key);
  if (!pending || pending.items.length === 0) {
    return;
  }

  // Build notification payload
  const itemCount = pending.items.length;
  const itemNames = pending.items.map(i => i.name);
  const stations = [...new Set(pending.items.map(i => i.station))];

  const payload: NotificationPayload = {
    type: 'ITEM_READY',
    title: `🍽️ Mesa ${pending.tableNumber}`,
    body: itemCount === 1
      ? `${itemNames[0]} está listo`
      : `${itemCount} items listos: ${itemNames.slice(0, 3).join(', ')}${itemCount > 3 ? '...' : ''}`,
    data: {
      order_id: pending.orderId,
      table_number: pending.tableNumber,
      station: stations.join(', '),
      url: `/mozo/mesa/${pending.orderId}`,
    },
    tag: `item-ready-${pending.orderId}`,
  };

  // Send to waiter
  await sendToEmployee(pending.tenantId, pending.waiterId, payload);

  // Clean up
  pendingNotifications.delete(key);
}

/**
 * Handle REQUEST_CHECK event
 * Sends notification to all cashiers
 */
export async function handleRequestCheck(event: RequestCheckEvent): Promise<void> {
  const { order_id, table_id } = event.payload;
  const { tenant_id } = event.meta;

  // Get order details
  const order = await prisma.orders.findUnique({
    where: { id: order_id },
    select: {
      id: true,
      total_cents: true,
      waiter_id: true,
      fulfillment: true,
    },
  });

  if (!order) {
    logger.debug('NOTIFICATION_ORDER_NOT_FOUND', 'Order not found for REQUEST_CHECK', { orderId: order_id });
    return;
  }

  // Get waiter name
  let waiterName = 'Mozo';
  if (order.waiter_id) {
    const waiter = await prisma.employees.findUnique({
      where: { id: order.waiter_id },
      select: { name: true },
    });
    if (waiter) {
      waiterName = waiter.name;
    }
  }

  // Extract table number
  const fulfillment = order.fulfillment as { table_number?: string } | null;
  const tableNumber = fulfillment?.table_number || table_id || 'N/A';

  // Format total
  const totalSoles = ((order.total_cents || 0) / 100).toFixed(2);

  const payload: NotificationPayload = {
    type: 'REQUEST_CHECK',
    title: `💳 Cuenta solicitada - Mesa ${tableNumber}`,
    body: `${waiterName} solicita cuenta. Total: S/ ${totalSoles}`,
    data: {
      order_id: order_id,
      table_number: tableNumber,
      url: `/caja/orden/${order_id}`,
    },
    tag: `request-check-${order_id}`,
  };

  // Send to all cashiers
  await sendToRole(tenant_id, 'CASHIER', payload);
}

/**
 * Build ITEM_READY notification payload
 * Exported for testing
 */
export function buildItemReadyPayload(
  tableNumber: string,
  items: Array<{ name: string; station: string }>,
  orderId: string
): NotificationPayload {
  const itemCount = items.length;
  const itemNames = items.map(i => i.name);
  const stations = [...new Set(items.map(i => i.station))];

  return {
    type: 'ITEM_READY',
    title: `🍽️ Mesa ${tableNumber}`,
    body: itemCount === 1
      ? `${itemNames[0]} está listo`
      : `${itemCount} items listos: ${itemNames.slice(0, 3).join(', ')}${itemCount > 3 ? '...' : ''}`,
    data: {
      order_id: orderId,
      table_number: tableNumber,
      station: stations.join(', '),
      url: `/mozo/mesa/${orderId}`,
    },
    tag: `item-ready-${orderId}`,
  };
}

/**
 * Build REQUEST_CHECK notification payload
 * Exported for testing
 */
export function buildRequestCheckPayload(
  tableNumber: string,
  totalCents: number,
  waiterName: string,
  orderId: string
): NotificationPayload {
  const totalSoles = (totalCents / 100).toFixed(2);

  return {
    type: 'REQUEST_CHECK',
    title: `💳 Cuenta solicitada - Mesa ${tableNumber}`,
    body: `${waiterName} solicita cuenta. Total: S/ ${totalSoles}`,
    data: {
      order_id: orderId,
      table_number: tableNumber,
      url: `/caja/orden/${orderId}`,
    },
    tag: `request-check-${orderId}`,
  };
}

/**
 * Get pending notifications count (for testing)
 */
export function getPendingNotificationsCount(): number {
  return pendingNotifications.size;
}

/**
 * Clear all pending notifications (for testing)
 */
export function clearPendingNotifications(): void {
  for (const pending of pendingNotifications.values()) {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
  }
  pendingNotifications.clear();
}

/**
 * Force flush pending notifications (for testing)
 */
export async function flushPendingNotifications(): Promise<void> {
  const keys = [...pendingNotifications.keys()];
  for (const key of keys) {
    const pending = pendingNotifications.get(key);
    if (pending?.timer) {
      clearTimeout(pending.timer);
    }
    await sendGroupedItemReadyNotification(key);
  }
}
