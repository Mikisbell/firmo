/**
 * Admin Notification Service
 * Sistema de notificaciones para el panel de administración
 */

import prisma from '@/src/core/db/prisma';
import type { 
  AdminNotification, 
  CreateAdminNotificationInput,
  AdminNotificationStats 
} from './types';

/**
 * Crear una notificación para administradores
 */
export async function createAdminNotification(
  input: CreateAdminNotificationInput
): Promise<AdminNotification> {
  const notification = await prisma.admin_notifications.create({
    data: {
      tenant_id: input.tenant_id,
      type: input.type,
      priority: input.priority,
      category: input.category,
      title: input.title,
      message: input.message,
      actionable: input.actionable || false,
      action_type: input.action?.type,
      action_target: input.action?.target,
      action_label: input.action?.label,
      metadata: input.metadata || {},
    },
  });

  return mapNotification(notification);
}

/**
 * Obtener notificaciones con filtros
 */
export async function getAdminNotifications(
  tenantId: string,
  options: {
    unread?: boolean;
    priority?: string;
    category?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ notifications: AdminNotification[]; total: number }> {
  const where: any = {
    tenant_id: tenantId,
    expires_at: { gt: new Date() },
  };

  if (options.unread !== undefined) {
    where.read = !options.unread;
  }

  if (options.priority) {
    where.priority = options.priority;
  }

  if (options.category) {
    where.category = options.category;
  }

  const [notifications, total] = await Promise.all([
    prisma.admin_notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options.limit || 20,
      skip: options.offset || 0,
    }),
    prisma.admin_notifications.count({ where }),
  ]);

  return {
    notifications: notifications.map(mapNotification),
    total,
  };
}

/**
 * Obtener estadísticas de notificaciones
 */
export async function getAdminNotificationStats(
  tenantId: string
): Promise<AdminNotificationStats> {
  const [total, unread, critical] = await Promise.all([
    prisma.admin_notifications.count({
      where: {
        tenant_id: tenantId,
        expires_at: { gt: new Date() },
      },
    }),
    prisma.admin_notifications.count({
      where: {
        tenant_id: tenantId,
        read: false,
        expires_at: { gt: new Date() },
      },
    }),
    prisma.admin_notifications.count({
      where: {
        tenant_id: tenantId,
        read: false,
        priority: 'HIGH',
        expires_at: { gt: new Date() },
      },
    }),
  ]);

  return {
    total,
    unread,
    hasCritical: critical > 0,
  };
}

/**
 * Marcar notificación como leída
 */
export async function markNotificationAsRead(
  notificationId: string,
  tenantId: string
): Promise<void> {
  await prisma.admin_notifications.update({
    where: {
      id: notificationId,
      tenant_id: tenantId,
    },
    data: {
      read: true,
      read_at: new Date(),
    },
  });
}

/**
 * Marcar todas las notificaciones como leídas
 */
export async function markAllNotificationsAsRead(
  tenantId: string
): Promise<number> {
  const result = await prisma.admin_notifications.updateMany({
    where: {
      tenant_id: tenantId,
      read: false,
      expires_at: { gt: new Date() },
    },
    data: {
      read: true,
      read_at: new Date(),
    },
  });

  return result.count;
}

/**
 * Marcar notificaciones como vistas (en dropdown)
 */
export async function markNotificationsAsViewed(
  notificationIds: string[],
  tenantId: string
): Promise<void> {
  await prisma.admin_notifications.updateMany({
    where: {
      id: { in: notificationIds },
      tenant_id: tenantId,
    },
    data: {
      viewed: true,
    },
  });
}

/**
 * Eliminar notificación
 */
export async function deleteAdminNotification(
  notificationId: string,
  tenantId: string
): Promise<void> {
  await prisma.admin_notifications.delete({
    where: {
      id: notificationId,
      tenant_id: tenantId,
    },
  });
}

/**
 * Limpiar notificaciones expiradas (background job)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const result = await prisma.admin_notifications.deleteMany({
    where: {
      expires_at: { lt: new Date() },
    },
  });

  return result.count;
}

// ============ HELPERS ============

function mapNotification(raw: any): AdminNotification {
  return {
    id: raw.id,
    tenant_id: raw.tenant_id,
    type: raw.type,
    priority: raw.priority,
    category: raw.category,
    title: raw.title,
    message: raw.message,
    read: raw.read,
    viewed: raw.viewed,
    actionable: raw.actionable,
    action: raw.actionable
      ? {
          type: raw.action_type,
          target: raw.action_target,
          label: raw.action_label,
        }
      : undefined,
    metadata: raw.metadata || {},
    created_at: raw.created_at.toISOString(),
    read_at: raw.read_at?.toISOString(),
    expires_at: raw.expires_at?.toISOString(),
  };
}
