/**
 * POS Integration for Delivery
 * Crea delivery_order cuando se crea una orden tipo DELIVERY
 * 
 * Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 7.3
 */

import { DeliveryService } from './delivery.service';
import { notifyDeliveryReady } from './notification-handlers';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { asCentavos } from '@/src/core/types/shared';

export interface CreateDeliveryFromOrderInput {
  tenantId: string;
  orderId: string;
  addressText: string;
  addressReference?: string;
  customerPhone: string;
  deliveryFeeCents: number;
  estimatedMins?: number;
}

/**
 * Create delivery_order when a DELIVERY order is created
 * Called from order creation flow
 */
export async function createDeliveryFromOrder(
  input: CreateDeliveryFromOrderInput
): Promise<string> {
  const estimatedDeliveryAt = input.estimatedMins
    ? new Date(Date.now() + input.estimatedMins * 60 * 1000)
    : undefined;

  const delivery = await DeliveryService.createDeliveryOrder({
    tenantId: input.tenantId,
    orderId: input.orderId,
    addressText: input.addressText,
    addressReference: input.addressReference,
    customerPhone: input.customerPhone,
    deliveryFee: asCentavos(input.deliveryFeeCents),
    estimatedDeliveryAt,
  });

  logger.info('DELIVERY_CREATED_FROM_ORDER', 'Delivery order created from POS', {
    deliveryId: delivery.id,
    orderId: input.orderId,
  });

  return delivery.id;
}

/**
 * Check if an order is a delivery order
 */
export async function isDeliveryOrder(orderId: string): Promise<boolean> {
  const delivery = await prisma.delivery_orders.findFirst({
    where: { order_id: orderId },
    select: { id: true },
  });
  return !!delivery;
}

/**
 * Get delivery for an order
 */
export async function getDeliveryForOrder(orderId: string) {
  return prisma.delivery_orders.findFirst({
    where: { order_id: orderId },
  });
}

/**
 * Notify dispatch when all items are ready for a delivery order
 * Called from KDS when all items transition to READY
 */
export async function notifyDeliveryOrderReady(
  tenantId: string,
  orderId: string
): Promise<void> {
  const delivery = await prisma.delivery_orders.findFirst({
    where: { 
      order_id: orderId,
      status: { in: ['PENDING', 'ASSIGNED'] },
    },
    select: { id: true },
  });

  if (delivery) {
    await notifyDeliveryReady(tenantId, delivery.id);
  }
}

/**
 * Check if order has all items ready (for KDS integration)
 */
export async function checkAllItemsReady(orderId: string): Promise<boolean> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { items: true },
  });

  if (!order?.items) return false;

  const items = order.items as Array<{ status?: string }>;
  
  // All items must be READY or DONE
  return items.every(item => 
    item.status === 'READY' || item.status === 'DONE'
  );
}
