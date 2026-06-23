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
 * Determina si TODOS los items de una orden ya están listos en cocina.
 *
 * PROPÓSITO (análisis del comentario original "for KDS integration"):
 * Esta función responde la pregunta "¿la cocina terminó con esta orden?".
 * Su uso natural es el handoff KDS → delivery: cuando el último item de una
 * orden de tipo DELIVERY transiciona a READY/DONE, el dispatcher debe ser
 * notificado para asignar un repartidor. El punto de integración candidato
 * es `notifyDeliveryOrderReady()` (este mismo archivo), que hoy se dispara
 * sin verificar que la orden completa esté lista. NOTA: hoy esta función no
 * tiene llamadores productivos; queda reparada y lista, pero su re-cableado
 * al flujo real requiere aprobación explícita.
 *
 * FUENTE DE VERDAD: `order_item_projections` (proyección VIVA del KDS), NO el
 * JSON `orders.items[].status`. Ese JSON queda CONGELADO en la creación de la
 * orden (solo refleja ORDER_CREATED) y nunca recibe las transiciones de estado
 * de cocina — leer de ahí devolvía siempre `false` (el trap original).
 *
 * Ciclo de vida vivo del status en la proyección:
 *   PENDING → IN_KITCHEN → READY → DONE
 * "Todos listos" = NO existe ninguna fila de la orden fuera de (READY, DONE).
 *
 * EDGE CASE — 0 filas proyectadas: ORDER_CREATED no proyecta sus items
 * iniciales (solo ORDER_ITEM_ADDED / ORDER_SUBMITTED lo hacen). Si la orden no
 * tiene ninguna fila en la proyección, NO hay evidencia de que esté lista, así
 * que retornamos `false` (fail-safe: nunca dispara handoff sin pruebas).
 *
 * Implementación Node puro, edge-safe: una sola query de conteo.
 */
export async function checkAllItemsReady(orderId: string): Promise<boolean> {
  // Filas de la orden que aún NO están listas (status fuera de READY/DONE).
  const notReadyCount = await prisma.order_item_projections.count({
    where: {
      order_id: orderId,
      status: { notIn: ['READY', 'DONE'] },
    },
  });

  // Si hay alguna fila no lista → la orden no está completa.
  if (notReadyCount > 0) return false;

  // notReadyCount === 0 puede significar dos cosas:
  //  (a) todos los items están READY/DONE  → listo
  //  (b) la orden no tiene NINGUNA fila proyectada → sin evidencia
  // Distinguimos contando el total de filas proyectadas de la orden.
  const totalCount = await prisma.order_item_projections.count({
    where: { order_id: orderId },
  });

  // 0 filas proyectadas → fail-safe: no hay evidencia de que estén listos.
  return totalCount > 0;
}
