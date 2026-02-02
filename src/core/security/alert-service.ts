import prisma from '@/src/core/db/prisma';
import { v4 as uuidv4 } from 'uuid';

export type AlertType =
  | 'SIMULTANEOUS_LOGIN'
  | 'SUSPICIOUS_IP'
  | 'IMPOSSIBLE_TRAVEL'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PRICE_CHANGE_LIMIT'
  | 'REFUND_LIMIT_EXCEEDED'
  | 'NEW_DEVICE'
  | 'BLOCKED_DEVICE'
  | 'DEVICE_MISMATCH'
  | 'UNAUTHORIZED_TERMINAL_ACCESS';

export interface AlertContext {
  employeeId: string;
  alertType: AlertType;
  reason: string;
  ipAddress?: string;
  location?: {
    lat: number;
    lng: number;
  };
}

/**
 * Crea una alerta de seguridad
 */
export async function createAlert(
  tenantId: string,
  context: AlertContext
): Promise<string> {
  const alertId = uuidv4();

  await prisma.session_alerts.create({
    data: {
      id: alertId,
      tenant_id: tenantId,
      employee_id: context.employeeId,
      alert_type: context.alertType,
      reason: context.reason,
      ip_address: context.ipAddress,
      location_lat: context.location?.lat,
      location_lng: context.location?.lng,
      is_resolved: false,
    },
  });

  return alertId;
}

/**
 * Obtiene todas las alertas no resueltas
 */
export async function getUnresolvedAlerts(
  tenantId: string
): Promise<any[]> {
  return prisma.session_alerts.findMany({
    where: {
      tenant_id: tenantId,
      is_resolved: false,
    },
    orderBy: {
      created_at: 'desc',
    },
  });
}

/**
 * Obtiene alertas de un empleado
 */
export async function getEmployeeAlerts(
  tenantId: string,
  employeeId: string,
  limit: number = 50
): Promise<any[]> {
  return prisma.session_alerts.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });
}

/**
 * Marca una alerta como resuelta
 */
export async function resolveAlert(
  alertId: string,
  resolvedBy: string,
  notes?: string
): Promise<void> {
  await prisma.session_alerts.update({
    where: {
      id: alertId,
    },
    data: {
      is_resolved: true,
      resolved_by: resolvedBy,
      resolved_at: new Date(),
      resolution_notes: notes,
    },
  });
}

/**
 * Obtiene alertas por tipo
 */
export async function getAlertsByType(
  tenantId: string,
  alertType: AlertType,
  limit: number = 50
): Promise<any[]> {
  return prisma.session_alerts.findMany({
    where: {
      tenant_id: tenantId,
      alert_type: alertType,
    },
    orderBy: {
      created_at: 'desc',
    },
    take: limit,
  });
}

/**
 * Obtiene estadísticas de alertas
 */
export async function getAlertStats(
  tenantId: string
): Promise<{
  total: number;
  unresolved: number;
  byType: Record<AlertType, number>;
}> {
  const alerts = await prisma.session_alerts.findMany({
    where: {
      tenant_id: tenantId,
    },
  });

  const byType: Record<AlertType, number> = {
    SIMULTANEOUS_LOGIN: 0,
    SUSPICIOUS_IP: 0,
    IMPOSSIBLE_TRAVEL: 0,
    RATE_LIMIT_EXCEEDED: 0,
    PRICE_CHANGE_LIMIT: 0,
    REFUND_LIMIT_EXCEEDED: 0,
    NEW_DEVICE: 0,
    BLOCKED_DEVICE: 0,
    DEVICE_MISMATCH: 0,
    UNAUTHORIZED_TERMINAL_ACCESS: 0,
  };

  let unresolved = 0;

  for (const alert of alerts) {
    byType[alert.alert_type as AlertType]++;
    if (!alert.is_resolved) {
      unresolved++;
    }
  }

  return {
    total: alerts.length,
    unresolved,
    byType,
  };
}

/**
 * Limpia alertas antiguas (más de 30 días)
 */
export async function cleanupOldAlerts(tenantId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await prisma.session_alerts.deleteMany({
    where: {
      tenant_id: tenantId,
      created_at: {
        lt: thirtyDaysAgo,
      },
      is_resolved: true,
    },
  });

  return result.count;
}
