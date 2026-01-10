/**
 * Delivery Metrics Service
 * Métricas y estadísticas de delivery
 */

import prisma from '@/src/core/db/prisma';
import { getBusinessDate } from '@/src/core/utils/business-date';

export interface DeliveryMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  avgDeliveryTimeMins: number | null;
  successRate: number; // 0-100
}

export interface DriverMetrics {
  driverId: string;
  driverName: string;
  deliveriesCompleted: number;
  deliveriesFailed: number;
  avgTimeMins: number | null;
  successRate: number; // 0-100
}

export interface DeliveryWithDelay {
  id: string;
  orderId: string;
  status: string;
  createdAt: Date;
  estimatedMins: number;
  elapsedMins: number;
  isDelayed: boolean;
}

export const DeliveryMetricsService = {
  /**
   * Obtener métricas del día actual
   */
  async getTodayMetrics(tenantId: string): Promise<DeliveryMetrics> {
    const today = getBusinessDate(new Date());
    return this.getMetricsForDate(tenantId, today);
  },

  /**
   * Obtener métricas para una fecha específica
   */
  async getMetricsForDate(tenantId: string, businessDate: string): Promise<DeliveryMetrics> {
    // Obtener todas las entregas del día
    const deliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        created_at: {
          gte: new Date(`${businessDate}T00:00:00`),
          lt: new Date(`${businessDate}T23:59:59`),
        },
      },
    });

    const totalDeliveries = deliveries.length;
    const completedDeliveries = deliveries.filter(d => d.status === 'DELIVERED').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'FAILED').length;
    const pendingDeliveries = deliveries.filter(
      d => ['PENDING', 'ASSIGNED', 'DISPATCHED'].includes(d.status)
    ).length;

    // Calcular tiempo promedio de entrega
    const completedWithTime = deliveries.filter(
      d => d.status === 'DELIVERED' && d.delivery_time_mins !== null
    );
    
    const avgDeliveryTimeMins = completedWithTime.length > 0
      ? Math.round(
          completedWithTime.reduce((sum, d) => sum + (d.delivery_time_mins || 0), 0) /
          completedWithTime.length
        )
      : null;

    // Calcular tasa de éxito (solo sobre entregas finalizadas)
    const finishedDeliveries = completedDeliveries + failedDeliveries;
    const successRate = finishedDeliveries > 0
      ? Math.round((completedDeliveries / finishedDeliveries) * 100)
      : 100; // Si no hay entregas finalizadas, 100%

    return {
      totalDeliveries,
      completedDeliveries,
      failedDeliveries,
      pendingDeliveries,
      avgDeliveryTimeMins,
      successRate,
    };
  },

  /**
   * Obtener métricas por driver en un rango de fechas
   */
  async getDriverMetrics(
    tenantId: string,
    dateFrom: string,
    dateTo: string
  ): Promise<DriverMetrics[]> {
    // Obtener todos los drivers
    const drivers = await prisma.drivers.findMany({
      where: { tenant_id: tenantId },
    });

    // Obtener entregas en el rango
    const deliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        driver_id: { not: null },
        created_at: {
          gte: new Date(`${dateFrom}T00:00:00`),
          lt: new Date(`${dateTo}T23:59:59`),
        },
        status: { in: ['DELIVERED', 'FAILED'] },
      },
    });

    // Agrupar por driver
    const metricsByDriver = new Map<string, {
      completed: number;
      failed: number;
      totalTimeMins: number;
      countWithTime: number;
    }>();

    for (const delivery of deliveries) {
      if (!delivery.driver_id) continue;

      const current = metricsByDriver.get(delivery.driver_id) || {
        completed: 0,
        failed: 0,
        totalTimeMins: 0,
        countWithTime: 0,
      };

      if (delivery.status === 'DELIVERED') {
        current.completed++;
        if (delivery.delivery_time_mins !== null) {
          current.totalTimeMins += delivery.delivery_time_mins;
          current.countWithTime++;
        }
      } else if (delivery.status === 'FAILED') {
        current.failed++;
      }

      metricsByDriver.set(delivery.driver_id, current);
    }

    // Construir resultado
    return drivers.map(driver => {
      const metrics = metricsByDriver.get(driver.id);
      
      if (!metrics) {
        return {
          driverId: driver.id,
          driverName: driver.name,
          deliveriesCompleted: 0,
          deliveriesFailed: 0,
          avgTimeMins: null,
          successRate: 100,
        };
      }

      const total = metrics.completed + metrics.failed;
      const successRate = total > 0
        ? Math.round((metrics.completed / total) * 100)
        : 100;

      const avgTimeMins = metrics.countWithTime > 0
        ? Math.round(metrics.totalTimeMins / metrics.countWithTime)
        : null;

      return {
        driverId: driver.id,
        driverName: driver.name,
        deliveriesCompleted: metrics.completed,
        deliveriesFailed: metrics.failed,
        avgTimeMins,
        successRate,
      };
    }).sort((a, b) => b.deliveriesCompleted - a.deliveriesCompleted);
  },

  /**
   * Obtener entregas pendientes con información de delay
   */
  async getPendingWithDelay(tenantId: string): Promise<DeliveryWithDelay[]> {
    const deliveries = await prisma.delivery_orders.findMany({
      where: {
        tenant_id: tenantId,
        status: { in: ['PENDING', 'ASSIGNED', 'DISPATCHED'] },
      },
      orderBy: { created_at: 'asc' },
    });

    const now = new Date();

    return deliveries.map(delivery => {
      const createdAt = new Date(delivery.created_at);
      const elapsedMins = Math.round(
        (now.getTime() - createdAt.getTime()) / (1000 * 60)
      );

      // Usar estimated_mins de la zona o 30 por defecto
      const estimatedMins = delivery.estimated_delivery_at
        ? Math.round(
            (new Date(delivery.estimated_delivery_at).getTime() - createdAt.getTime()) /
            (1000 * 60)
          )
        : 30;

      // Delay si excede estimado + 15 minutos
      const isDelayed = elapsedMins > estimatedMins + 15;

      return {
        id: delivery.id,
        orderId: delivery.order_id,
        status: delivery.status,
        createdAt,
        estimatedMins,
        elapsedMins,
        isDelayed,
      };
    });
  },

  /**
   * Calcular si una entrega está demorada
   */
  isDeliveryDelayed(
    createdAt: Date,
    estimatedMins: number,
    now: Date = new Date()
  ): boolean {
    const elapsedMins = Math.round(
      (now.getTime() - createdAt.getTime()) / (1000 * 60)
    );
    return elapsedMins > estimatedMins + 15;
  },
};

export default DeliveryMetricsService;
