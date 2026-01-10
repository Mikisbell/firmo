/**
 * Delivery Service
 * Gestión de pedidos de delivery con flota propia
 */

import prisma from '@/src/core/db/prisma';
import { 
  DeliveryOrder, 
  DeliveryStatus, 
  CreateDeliveryInput, 
  ZoneFeeResult,
  isValidTransition 
} from './types';
import { notifyDeliveryAssigned } from './notification-handlers';
import { asCentavos } from '@/src/core/types/shared';

export class DeliveryServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'DeliveryServiceError';
  }
}

export const DeliveryService = {
  /**
   * Crear un nuevo delivery order
   */
  async createDeliveryOrder(input: CreateDeliveryInput): Promise<DeliveryOrder> {
    const id = crypto.randomUUID();
    
    const delivery = await prisma.delivery_orders.create({
      data: {
        id,
        tenant_id: input.tenantId,
        order_id: input.orderId,
        address_text: input.addressText,
        address_reference: input.addressReference || null,
        customer_phone: input.customerPhone,
        delivery_fee: input.deliveryFee,
        estimated_delivery_at: input.estimatedDeliveryAt || null,
        address_id: input.addressId || null,
        status: 'PENDING',
      },
    });

    return mapToDeliveryOrder(delivery);
  },

  /**
   * Asignar motorizado a un delivery
   */
  async assignDriver(deliveryId: string, driverId: string): Promise<DeliveryOrder> {
    // Verificar que el delivery existe y está en PENDING
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new DeliveryServiceError('Delivery not found', 'NOT_FOUND', 404);
    }

    if (delivery.status !== 'PENDING') {
      throw new DeliveryServiceError(
        `Cannot assign driver: delivery is ${delivery.status}, expected PENDING`,
        'INVALID_TRANSITION'
      );
    }

    // Verificar que el driver existe, está disponible Y pertenece al mismo tenant
    const driver = await prisma.drivers.findFirst({
      where: { 
        id: driverId,
        tenant_id: delivery.tenant_id  // Validación de tenant para seguridad multi-tenant
      },
    });

    if (!driver) {
      throw new DeliveryServiceError('Driver not found', 'DRIVER_NOT_FOUND', 404);
    }

    if (!driver.is_active) {
      throw new DeliveryServiceError('Driver is inactive', 'DRIVER_UNAVAILABLE');
    }

    // Verificar que el driver no tiene entregas activas
    const activeDelivery = await prisma.delivery_orders.findFirst({
      where: {
        driver_id: driverId,
        status: { in: ['ASSIGNED', 'DISPATCHED'] },
      },
    });

    if (activeDelivery) {
      throw new DeliveryServiceError(
        'Driver already has an active delivery',
        'DRIVER_UNAVAILABLE'
      );
    }

    // Asignar driver
    const updated = await prisma.delivery_orders.update({
      where: { id: deliveryId },
      data: {
        driver_id: driverId,
        status: 'ASSIGNED',
        assigned_at: new Date(),
      },
    });

    // Notificar al motorizado (async, no bloquea)
    notifyDeliveryAssigned(delivery.tenant_id, deliveryId, driverId).catch(() => {
      // Silently ignore notification errors
    });

    return mapToDeliveryOrder(updated);
  },

  /**
   * Marcar delivery como despachado (motorizado salió)
   */
  async markDispatched(deliveryId: string): Promise<DeliveryOrder> {
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new DeliveryServiceError('Delivery not found', 'NOT_FOUND', 404);
    }

    if (!isValidTransition(delivery.status as DeliveryStatus, 'DISPATCHED')) {
      throw new DeliveryServiceError(
        `Cannot dispatch: delivery is ${delivery.status}, expected ASSIGNED`,
        'INVALID_TRANSITION'
      );
    }

    const updated = await prisma.delivery_orders.update({
      where: { id: deliveryId },
      data: {
        status: 'DISPATCHED',
        dispatched_at: new Date(),
      },
    });

    return mapToDeliveryOrder(updated);
  },

  /**
   * Marcar delivery como entregado
   */
  async markDelivered(deliveryId: string, signatureUrl?: string): Promise<DeliveryOrder> {
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new DeliveryServiceError('Delivery not found', 'NOT_FOUND', 404);
    }

    if (!isValidTransition(delivery.status as DeliveryStatus, 'DELIVERED')) {
      throw new DeliveryServiceError(
        `Cannot deliver: delivery is ${delivery.status}, expected DISPATCHED`,
        'INVALID_TRANSITION'
      );
    }

    const deliveredAt = new Date();
    
    // Calcular tiempo de entrega en minutos
    let deliveryTimeMins: number | null = null;
    if (delivery.dispatched_at) {
      const dispatchedAt = new Date(delivery.dispatched_at);
      deliveryTimeMins = Math.round(
        (deliveredAt.getTime() - dispatchedAt.getTime()) / (1000 * 60)
      );
    }

    const updated = await prisma.delivery_orders.update({
      where: { id: deliveryId },
      data: {
        status: 'DELIVERED',
        delivered_at: deliveredAt,
        delivery_time_mins: deliveryTimeMins,
        signature_url: signatureUrl || null,
      },
    });

    return mapToDeliveryOrder(updated);
  },

  /**
   * Marcar delivery como fallido
   */
  async markFailed(deliveryId: string, reason: string): Promise<DeliveryOrder> {
    if (!reason || reason.trim().length === 0) {
      throw new DeliveryServiceError(
        'Failure reason is required',
        'VALIDATION_ERROR'
      );
    }

    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) {
      throw new DeliveryServiceError('Delivery not found', 'NOT_FOUND', 404);
    }

    const currentStatus = delivery.status as DeliveryStatus;
    if (!isValidTransition(currentStatus, 'FAILED')) {
      throw new DeliveryServiceError(
        `Cannot fail: delivery is ${delivery.status}, expected ASSIGNED or DISPATCHED`,
        'INVALID_TRANSITION'
      );
    }

    const updated = await prisma.delivery_orders.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        failed_at: new Date(),
        failure_reason: reason.trim(),
      },
    });

    return mapToDeliveryOrder(updated);
  },

  /**
   * Obtener deliveries por estado
   */
  async getByStatus(
    tenantId: string, 
    statuses: DeliveryStatus[]
  ): Promise<DeliveryOrder[]> {
    const deliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: statuses },
      },
      orderBy: { created_at: 'asc' },
    });

    return deliveries.map(mapToDeliveryOrder);
  },

  /**
   * Obtener deliveries de un driver
   */
  async getDriverDeliveries(driverId: string): Promise<DeliveryOrder[]> {
    const deliveries = await prisma.delivery_orders.findMany({
      where: {
        driver_id: driverId,
        status: { in: ['ASSIGNED', 'DISPATCHED'] },
      },
      orderBy: { assigned_at: 'asc' },
    });

    return deliveries.map(mapToDeliveryOrder);
  },

  /**
   * Obtener un delivery por ID
   */
  async getById(deliveryId: string): Promise<DeliveryOrder | null> {
    const delivery = await prisma.delivery_orders.findUnique({
      where: { id: deliveryId },
    });

    return delivery ? mapToDeliveryOrder(delivery) : null;
  },

  /**
   * Calcular fee de delivery basado en zona
   */
  async calculateDeliveryFee(
    tenantId: string,
    lat: number,
    lng: number,
    locationId?: string
  ): Promise<ZoneFeeResult> {
    // Obtener zonas activas
    const zones = await prisma.delivery_zones.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        ...(locationId && { location_id: locationId }),
      },
      orderBy: { priority: 'desc' },
    });

    // Buscar zona que contenga el punto
    for (const zone of zones) {
      if (zone.type === 'RADIUS' && zone.center_lat && zone.center_lng && zone.radius_km) {
        const distance = haversineDistance(
          Number(zone.center_lat),
          Number(zone.center_lng),
          lat,
          lng
        );

        if (distance <= Number(zone.radius_km)) {
          return {
            zoneId: zone.id,
            zoneName: zone.name,
            fee: asCentavos(zone.delivery_fee),
            estimatedMins: zone.estimated_mins,
            isOutsideZones: false,
          };
        }
      }
      
      // Soporte para zonas tipo POLYGON
      if (zone.type === 'POLYGON' && zone.polygon) {
        const polygon = zone.polygon as Array<{ lat: number; lng: number }>;
        if (isPointInPolygon(lat, lng, polygon)) {
          return {
            zoneId: zone.id,
            zoneName: zone.name,
            fee: asCentavos(zone.delivery_fee),
            estimatedMins: zone.estimated_mins,
            isOutsideZones: false,
          };
        }
      }
    }

    // Fuera de todas las zonas - usar fee por defecto del tenant
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    return {
      zoneId: null,
      zoneName: null,
      fee: asCentavos(settings?.default_delivery_fee_cents ?? 500), // S/5.00 por defecto
      estimatedMins: 45, // 45 min por defecto fuera de zona
      isOutsideZones: true,
    };
  },
};

/**
 * Calcular distancia entre dos puntos usando fórmula de Haversine
 * @returns Distancia en kilómetros
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Determinar si un punto está dentro de un polígono usando ray casting algorithm
 * @returns true si el punto está dentro del polígono
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  if (polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;
    
    const intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    
    if (intersect) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Mapear registro de Prisma a tipo DeliveryOrder
 */
function mapToDeliveryOrder(record: {
  id: string;
  tenant_id: string;
  order_id: string;
  driver_id: string | null;
  address_id: string | null;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: number;
  estimated_delivery_at: Date | null;
  assigned_at: Date | null;
  dispatched_at: Date | null;
  delivered_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  delivery_time_mins: number | null;
  signature_url: string | null;
  status: string;
  created_at: Date;
}): DeliveryOrder {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    order_id: record.order_id,
    driver_id: record.driver_id,
    address_id: record.address_id,
    address_text: record.address_text,
    address_reference: record.address_reference,
    customer_phone: record.customer_phone,
    delivery_fee: asCentavos(record.delivery_fee),
    estimated_delivery_at: record.estimated_delivery_at,
    assigned_at: record.assigned_at,
    dispatched_at: record.dispatched_at,
    delivered_at: record.delivered_at,
    failed_at: record.failed_at,
    failure_reason: record.failure_reason,
    delivery_time_mins: record.delivery_time_mins,
    signature_url: record.signature_url,
    status: record.status as DeliveryStatus,
    created_at: record.created_at,
  };
}

export default DeliveryService;
