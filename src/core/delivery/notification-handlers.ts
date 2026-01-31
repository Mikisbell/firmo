/**
 * Delivery Notification Handlers
 * Maneja notificaciones push para el módulo de delivery
 * 
 * Estos handlers se llaman directamente desde los servicios de delivery,
 * no a través del event bus (los eventos de delivery no están en el schema principal).
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { sendToRole } from '@/src/core/notifications/notification.service';
import type { NotificationPayload } from '@/src/core/notifications/types';

// ============ HANDLERS ============

/**
 * Notify driver when a delivery is assigned to them
 * Called from DeliveryService.assignDriver
 */
export async function notifyDeliveryAssigned(
  tenantId: string,
  deliveryId: string,
  driverId: string
): Promise<void> {
  try {
    // Get delivery details
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        order_id: true,
        address_text: true,
      },
    });

    if (!delivery) {
      logger.debug('DELIVERY_NOTIF_NOT_FOUND', 'Delivery not found', { deliveryId });
      return;
    }

    // Get order number
    const order = await prisma.orders.findUnique({
      where: { id: delivery.order_id },
      select: { order_number: true },
    });

    // Get driver info - check if driver has an associated employee
    // For now, drivers don't have employee_id, so we log and skip push
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
      select: { name: true, phone: true },
    });

    if (!driver) {
      logger.debug('DELIVERY_NOTIF_DRIVER_NOT_FOUND', 'Driver not found', { driverId });
      return;
    }

    const orderNumber = order?.order_number || 'N/A';
    const address = delivery.address_text || 'Sin dirección';

    // Log the assignment (push notification would require driver to have employee_id)
    logger.info('DELIVERY_ASSIGNED_NOTIF', 'Delivery assigned notification', {
      deliveryId,
      driverId,
      driverName: driver.name,
      orderNumber,
      address,
    });

    // TODO: When drivers have employee_id, send push notification:
    // const payload = buildDeliveryAssignedPayload(orderNumber, address, deliveryId, delivery.order_id, driverId);
    // await sendToEmployee(tenantId, driver.employee_id, payload);

  } catch (err) {
    logger.error(
      'DELIVERY_NOTIF_ERROR',
      'Error sending delivery assigned notification',
      err instanceof Error ? err : new Error(String(err)),
      { deliveryId, driverId }
    );
  }
}

/**
 * Notify dispatch panel when all items are ready for a delivery order
 * Called when KDS marks all items as READY
 */
export async function notifyDeliveryReady(
  tenantId: string,
  deliveryId: string
): Promise<void> {
  try {
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        order_id: true,
        driver_id: true,
        address_text: true,
      },
    });

    if (!delivery) {
      return;
    }

    const order = await prisma.orders.findUnique({
      where: { id: delivery.order_id },
      select: { order_number: true },
    });

    const orderNumber = order?.order_number || 'N/A';

    // Notify all cashiers (dispatch role)
    const payload: NotificationPayload = {
      type: 'DELIVERY_READY_FOR_DISPATCH',
      title: `✅ Delivery listo`,
      body: `Pedido #${orderNumber} listo para despachar`,
      data: {
        order_id: delivery.order_id,
        delivery_id: deliveryId,
        url: '/admin/delivery',
      },
      tag: `delivery-ready-${deliveryId}`,
    };

    await sendToRole(tenantId, 'CASHIER', payload);

    logger.info('DELIVERY_READY_NOTIF', 'Delivery ready notification sent', {
      deliveryId,
      orderNumber,
    });

  } catch (err) {
    logger.error(
      'DELIVERY_NOTIF_ERROR',
      'Error sending delivery ready notification',
      err instanceof Error ? err : new Error(String(err)),
      { deliveryId }
    );
  }
}

/**
 * Log delivery delay for monitoring
 * Called from metrics service when checking for delays
 */
export async function logDeliveryDelayed(
  tenantId: string,
  deliveryId: string,
  minutesDelayed: number
): Promise<void> {
  try {
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        order_id: true,
        driver_id: true,
        address_text: true,
      },
    });

    if (!delivery) {
      return;
    }

    let driverName = 'Sin asignar';
    if (delivery.driver_id) {
      const driver = await prisma.drivers.findUnique({
        where: { id: delivery.driver_id },
        select: { name: true },
      });
      driverName = driver?.name || 'Desconocido';
    }

    const order = await prisma.orders.findUnique({
      where: { id: delivery.order_id },
      select: { order_number: true },
    });

    logger.warn('DELIVERY_DELAYED', 'Delivery is delayed', {
      deliveryId,
      orderId: delivery.order_id,
      orderNumber: order?.order_number,
      minutesDelayed,
      driverName,
      tenantId,
    });

  } catch (err) {
    logger.error(
      'DELIVERY_DELAY_LOG_ERROR',
      'Error logging delivery delay',
      err instanceof Error ? err : new Error(String(err)),
      { deliveryId }
    );
  }
}

// ============ PAYLOAD BUILDERS (for testing) ============

export function buildDeliveryAssignedPayload(
  orderNumber: string,
  address: string,
  deliveryId: string,
  orderId: string,
  driverId: string
): NotificationPayload {
  return {
    type: 'DELIVERY_ASSIGNED',
    title: `🛵 Nuevo delivery asignado`,
    body: `Pedido #${orderNumber} - ${address}`,
    data: {
      order_id: orderId,
      delivery_id: deliveryId,
      driver_id: driverId,
      address,
      url: '/delivery',
    },
    tag: `delivery-assigned-${deliveryId}`,
  };
}

export function buildDeliveryReadyPayload(
  orderNumber: string,
  deliveryId: string,
  orderId: string
): NotificationPayload {
  return {
    type: 'DELIVERY_READY_FOR_DISPATCH',
    title: `✅ Pedido listo para salir`,
    body: `Pedido #${orderNumber} está listo. ¡A entregar!`,
    data: {
      order_id: orderId,
      delivery_id: deliveryId,
      url: '/delivery',
    },
    tag: `delivery-ready-${deliveryId}`,
  };
}
