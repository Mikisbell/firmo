/**
 * Stock Alert Notifier
 *
 * Sends push notifications to admin users when inventory drops below min_stock.
 * Called from deduction.service.ts after creating stock_alert records.
 *
 * @module core/inventory/stock-alert-notifier
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

// Web-push is optional — only used when VAPID keys are configured
let webpush: typeof import('web-push') | null = null;
try {
  const wp = require('web-push') as typeof import('web-push');
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@parkpos.pe';
  if (vapidPublic && vapidPrivate) {
    const isValidSubject = vapidSubject.startsWith('mailto:') || vapidSubject.startsWith('https://');
    if (isValidSubject) {
      wp.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      webpush = wp;
    }
  }
} catch {
  // web-push not available
}

export interface StockAlertNotification {
  tenantId: string;
  inventoryCode: string;
  inventoryName: string;
  currentStock: number;
  minStock: number;
  unit: string;
  alertType: 'LOW_STOCK' | 'OUT_OF_STOCK';
}

/**
 * Send push notifications to all admin employees of a tenant
 * when stock drops below the minimum threshold.
 *
 * Best-effort: never throws. Logs warnings on failure.
 */
export async function notifyLowStock(alert: StockAlertNotification): Promise<void> {
  try {
    if (!webpush) {
      logger.warn('STOCK_ALERT_NO_PUSH', 'Web Push no configurado, notificación de stock omitida', {
        inventory_code: alert.inventoryCode,
      });
      return;
    }

    // Find admin employees for this tenant
    const adminEmployees = await prisma.employees.findMany({
      where: {
        tenant_id: alert.tenantId,
        role: { in: [...ADMIN_ROLES] },
        is_active: true,
      },
      select: { id: true },
    });

    if (adminEmployees.length === 0) {
      return;
    }

    // Get push subscriptions for admin employees
    const subscriptions = await prisma.push_subscriptions.findMany({
      where: {
        tenant_id: alert.tenantId,
        employee_id: { in: adminEmployees.map((e) => e.id) },
      },
    });

    if (subscriptions.length === 0) {
      logger.warn('STOCK_ALERT_NO_SUBS', 'No hay suscripciones push para admins', {
        tenant_id: alert.tenantId,
        inventory_code: alert.inventoryCode,
      });
      return;
    }

    const isCritical = alert.alertType === 'OUT_OF_STOCK';
    const title = isCritical
      ? `Stock agotado: ${alert.inventoryName}`
      : `Stock bajo: ${alert.inventoryName}`;
    const body = isCritical
      ? `${alert.inventoryName} se agoto (${alert.currentStock} ${alert.unit})`
      : `Solo quedan ${alert.currentStock} ${alert.unit} de ${alert.inventoryName} (minimo: ${alert.minStock})`;

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/alert-icon.png',
      badge: '/icons/badge-icon.png',
      data: {
        type: 'stock_alert',
        inventoryCode: alert.inventoryCode,
        alertType: alert.alertType,
        url: '/inventario',
      },
      tag: `stock-${alert.inventoryCode}`,
      requireInteraction: isCritical,
    });

    // Send to all subscriptions (best-effort)
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush!.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
            },
            payload,
          );
          // Update last_used_at
          await prisma.push_subscriptions.update({
            where: { id: sub.id },
            data: { last_used_at: new Date() },
          }).catch(() => { /* non-critical */ });
        } catch (error: unknown) {
          // 410 Gone — subscription expired, remove
          if (error && typeof error === 'object' && 'statusCode' in error) {
            if ((error as { statusCode: number }).statusCode === 410) {
              await prisma.push_subscriptions.delete({ where: { id: sub.id } }).catch(() => {});
            }
          }
          throw error;
        }
      }),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info('STOCK_ALERT_PUSH_SENT', `Stock alert push: ${sent} enviados, ${failed} fallidos`, {
      tenant_id: alert.tenantId,
      inventory_code: alert.inventoryCode,
      alert_type: alert.alertType,
      sent,
      failed,
    });
  } catch (error) {
    logger.warn('STOCK_ALERT_PUSH_ERROR', 'Error enviando notificacion push de stock', {
      tenant_id: alert.tenantId,
      inventory_code: alert.inventoryCode,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
