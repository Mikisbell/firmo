/**
 * Driver Service
 * Gestión de motorizados para delivery
 */

import prisma from '@/src/core/db/prisma';
import { Driver, DriverWithStatus, DriverStatus, DeliveryOrder } from './types';
import { asCentavos } from '@/src/core/types/shared';
import { getAdminEmployeeId } from '@/src/core/config/employees';

export class DriverServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'DriverServiceError';
  }
}

export const DriverService = {
  /**
   * Crear un nuevo driver
   */
  async create(
    tenantId: string,
    name: string,
    phone?: string
  ): Promise<Driver> {
    if (!name || name.trim().length === 0) {
      throw new DriverServiceError('Name is required', 'VALIDATION_ERROR');
    }

    const id = crypto.randomUUID();
    const adminId = getAdminEmployeeId();

    // Create driver in transaction with audit trail
    const driver = await prisma.$transaction(async (tx) => {
      const newDriver = await tx.drivers.create({
        data: {
          id,
          tenant_id: tenantId,
          name: name.trim(),
          phone: phone?.trim() || null,
          is_active: true,
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          employee_id: adminId,
          action: 'CREATE',
          resource: 'drivers',
          metadata: { record_id: newDriver.id },
          created_at: new Date(),
        },
      });

      return newDriver;
    });

    return mapToDriver(driver);
  },

  /**
   * Actualizar un driver
   */
  async update(
    driverId: string,
    data: { name?: string; phone?: string }
  ): Promise<Driver> {
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new DriverServiceError('Driver not found', 'NOT_FOUND', 404);
    }

    const adminId = getAdminEmployeeId();

    // Update driver in transaction with audit trail
    const updated = await prisma.$transaction(async (tx) => {
      const updatedDriver = await tx.drivers.update({
        where: { id: driverId },
        data: {
          ...(data.name && { name: data.name.trim() }),
          ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: driver.tenant_id,
          employee_id: adminId,
          action: 'UPDATE',
          resource: 'drivers',
          metadata: {
            record_id: driverId,
            changes: data,
          },
          created_at: new Date(),
        },
      });

      return updatedDriver;
    });

    return mapToDriver(updated);
  },

  /**
   * Desactivar un driver
   */
  async deactivate(driverId: string): Promise<Driver> {
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new DriverServiceError('Driver not found', 'NOT_FOUND', 404);
    }

    const adminId = getAdminEmployeeId();

    // Deactivate driver in transaction with audit trail
    const updated = await prisma.$transaction(async (tx) => {
      const updatedDriver = await tx.drivers.update({
        where: { id: driverId },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id: driver.tenant_id,
          employee_id: adminId,
          action: 'DELETE',
          resource: 'drivers',
          metadata: { record_id: driverId },
          created_at: new Date(),
        },
      });

      return updatedDriver;
    });

    return mapToDriver(updated);
  },

  /**
   * Activar un driver
   */
  async activate(driverId: string): Promise<Driver> {
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new DriverServiceError('Driver not found', 'NOT_FOUND', 404);
    }

    const updated = await prisma.drivers.update({
      where: { id: driverId },
      data: { is_active: true },
    });

    return mapToDriver(updated);
  },

  /**
   * Obtener drivers disponibles (activos sin entregas activas)
   */
  async getAvailable(tenantId: string): Promise<Driver[]> {
    // Obtener IDs de drivers con entregas activas
    const activeDeliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['ASSIGNED', 'DISPATCHED'] },
        driver_id: { not: null },
      },
      select: { driver_id: true },
    });

    const busyDriverIds = activeDeliveries
      .map(d => d.driver_id)
      .filter((id): id is string => id !== null);

    // Obtener drivers activos que no están ocupados
    const drivers = await prisma.drivers.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        id: { notIn: busyDriverIds },
      },
      orderBy: { name: 'asc' },
    });

    return drivers.map(mapToDriver);
  },

  /**
   * Obtener estado actual de un driver
   */
  async getDriverStatus(driverId: string): Promise<{
    driver: Driver;
    currentDelivery: DeliveryOrder | null;
    status: DriverStatus;
  }> {
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new DriverServiceError('Driver not found', 'NOT_FOUND', 404);
    }

    // Buscar entrega activa
    const activeDelivery = await prisma.delivery_orders.findFirst({
      where: {
        driver_id: driverId,
        status: { in: ['ASSIGNED', 'DISPATCHED'] },
      },
    });

    let status: DriverStatus;
    if (!driver.is_active) {
      status = 'inactive';
    } else if (activeDelivery) {
      status = 'on_delivery';
    } else {
      status = 'available';
    }

    return {
      driver: mapToDriver(driver),
      currentDelivery: activeDelivery ? mapToDeliveryOrder(activeDelivery) : null,
      status,
    };
  },

  /**
   * Listar todos los drivers con su estado
   */
  async listWithStatus(tenantId: string): Promise<DriverWithStatus[]> {
    const drivers = await prisma.drivers.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });

    // Obtener entregas activas
    const activeDeliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['ASSIGNED', 'DISPATCHED'] },
        driver_id: { not: null },
      },
    });

    // Crear mapa de driver_id -> delivery
    const deliveryByDriver = new Map<string, typeof activeDeliveries[0]>();
    for (const delivery of activeDeliveries) {
      if (delivery.driver_id) {
        deliveryByDriver.set(delivery.driver_id, delivery);
      }
    }

    return drivers.map(driver => {
      const activeDelivery = deliveryByDriver.get(driver.id);
      let status: DriverStatus;

      if (!driver.is_active) {
        status = 'inactive';
      } else if (activeDelivery) {
        status = 'on_delivery';
      } else {
        status = 'available';
      }

      return {
        ...mapToDriver(driver),
        status,
        currentDelivery: activeDelivery ? mapToDeliveryOrder(activeDelivery) : null,
      };
    });
  },

  /**
   * Obtener un driver por ID
   */
  async getById(driverId: string): Promise<Driver | null> {
    const driver = await prisma.drivers.findUnique({
      where: { id: driverId },
    });

    return driver ? mapToDriver(driver) : null;
  },

  /**
   * Listar todos los drivers de un tenant
   */
  async list(tenantId: string): Promise<Driver[]> {
    const drivers = await prisma.drivers.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ is_active: 'desc' }, { name: 'asc' }],
    });

    return drivers.map(mapToDriver);
  },
};

function mapToDriver(record: {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}): Driver {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    name: record.name,
    phone: record.phone,
    is_active: record.is_active,
  };
}

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
    status: record.status as 'PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED',
    created_at: record.created_at,
  };
}

export default DriverService;
