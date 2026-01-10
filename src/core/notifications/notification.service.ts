/**
 * Notification Service
 * Gestiona suscripciones Web Push y envío de notificaciones
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';

// Web-push is optional - only used when VAPID keys are configured
let webpush: typeof import('web-push') | null = null;
try {
  webpush = require('web-push');
} catch {
  logger.warn('NOTIFICATION_WEBPUSH_UNAVAILABLE', 'web-push not available');
}
import type {
  PushSubscription,
  PushSubscriptionData,
  NotificationPayload,
  NotificationPreferences,
  EmployeeSubscriptionStatus,
} from './types';

// Configure VAPID keys from environment
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@parkpos.pe';

// Only configure VAPID if all keys are present and subject is valid
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && webpush) {
  // Validate VAPID_SUBJECT format (must be mailto: or https://)
  const isValidSubject = VAPID_SUBJECT.startsWith('mailto:') || VAPID_SUBJECT.startsWith('https://');
  if (isValidSubject) {
    try {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch (error) {
      logger.warn('NOTIFICATION_VAPID_CONFIG_ERROR', 'Failed to configure VAPID', { error: String(error) });
      webpush = null; // Disable webpush if config fails
    }
  } else {
    logger.warn('NOTIFICATION_VAPID_INVALID_SUBJECT', 'VAPID_SUBJECT must start with mailto: or https://', { subject: VAPID_SUBJECT });
    webpush = null; // Disable webpush if subject is invalid
  }
}

// ============ SUBSCRIPTIONS ============

export async function subscribe(
  tenantId: string,
  employeeId: string,
  subscription: PushSubscriptionData
): Promise<void> {
  await prisma.push_subscriptions.upsert({
    where: {
      tenant_id_employee_id_endpoint: {
        tenant_id: tenantId,
        employee_id: employeeId,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      last_used_at: new Date(),
    },
    create: {
      tenant_id: tenantId,
      employee_id: employeeId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
  });
}

export async function unsubscribe(
  tenantId: string,
  employeeId: string,
  endpoint: string
): Promise<void> {
  await prisma.push_subscriptions.deleteMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
      endpoint,
    },
  });
}

export async function getSubscriptions(
  tenantId: string,
  employeeId: string
): Promise<PushSubscription[]> {
  const subs = await prisma.push_subscriptions.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: employeeId,
    },
  });

  return subs.map(s => ({
    id: s.id,
    tenant_id: s.tenant_id,
    employee_id: s.employee_id,
    endpoint: s.endpoint,
    keys: {
      p256dh: s.p256dh_key,
      auth: s.auth_key,
    },
    device_info: s.device_info || undefined,
    created_at: s.created_at.toISOString(),
    last_used_at: s.last_used_at.toISOString(),
  }));
}

// ============ PREFERENCES ============

export async function getPreferences(
  tenantId: string,
  employeeId: string
): Promise<NotificationPreferences> {
  const prefs = await prisma.notification_preferences.findUnique({
    where: {
      tenant_id_employee_id: {
        tenant_id: tenantId,
        employee_id: employeeId,
      },
    },
  });

  if (!prefs) {
    // Return defaults
    return {
      employee_id: employeeId,
      items_ready: true,
      request_check: true,
      sound_enabled: true,
    };
  }

  return {
    employee_id: prefs.employee_id,
    items_ready: prefs.items_ready,
    request_check: prefs.request_check,
    sound_enabled: prefs.sound_enabled,
  };
}

export async function updatePreferences(
  tenantId: string,
  employeeId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const updated = await prisma.notification_preferences.upsert({
    where: {
      tenant_id_employee_id: {
        tenant_id: tenantId,
        employee_id: employeeId,
      },
    },
    update: {
      ...(prefs.items_ready !== undefined && { items_ready: prefs.items_ready }),
      ...(prefs.request_check !== undefined && { request_check: prefs.request_check }),
      ...(prefs.sound_enabled !== undefined && { sound_enabled: prefs.sound_enabled }),
      updated_at: new Date(),
    },
    create: {
      tenant_id: tenantId,
      employee_id: employeeId,
      items_ready: prefs.items_ready ?? true,
      request_check: prefs.request_check ?? true,
      sound_enabled: prefs.sound_enabled ?? true,
    },
  });

  return {
    employee_id: updated.employee_id,
    items_ready: updated.items_ready,
    request_check: updated.request_check,
    sound_enabled: updated.sound_enabled,
  };
}

// ============ SENDING ============

export async function sendToEmployee(
  tenantId: string,
  employeeId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  // Check preferences
  const prefs = await getPreferences(tenantId, employeeId);
  
  if (payload.type === 'ITEM_READY' && !prefs.items_ready) {
    logger.debug('NOTIFICATION_SKIPPED', 'Skipped ITEM_READY - preference disabled', { employeeId });
    return { sent: 0, failed: 0 };
  }
  
  if (payload.type === 'REQUEST_CHECK' && !prefs.request_check) {
    logger.debug('NOTIFICATION_SKIPPED', 'Skipped REQUEST_CHECK - preference disabled', { employeeId });
    return { sent: 0, failed: 0 };
  }

  // Get subscriptions
  const subscriptions = await getSubscriptions(tenantId, employeeId);
  
  if (subscriptions.length === 0) {
    logger.debug('NOTIFICATION_NO_SUBSCRIPTIONS', 'No subscriptions for employee', { employeeId });
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscriptions) {
    try {
      if (!webpush) {
        logger.warn('NOTIFICATION_WEBPUSH_NOT_CONFIGURED', 'web-push not configured, skipping send');
        failed++;
        continue;
      }
      
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
          },
        },
        JSON.stringify(payload)
      );
      
      // Update last_used_at
      await prisma.push_subscriptions.update({
        where: { id: sub.id },
        data: { last_used_at: new Date() },
      });
      
      sent++;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      logger.error('NOTIFICATION_SEND_FAILED', 'Failed to send notification', error instanceof Error ? error : undefined, { endpoint: sub.endpoint });
      
      // Remove expired subscriptions (410 Gone)
      if (err.statusCode === 410) {
        await prisma.push_subscriptions.delete({
          where: { id: sub.id },
        });
        logger.info('NOTIFICATION_SUBSCRIPTION_REMOVED', 'Removed expired subscription', { subscriptionId: sub.id });
      }
      
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendToRole(
  tenantId: string,
  role: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  // Get all employees with the role
  const employees = await prisma.employees.findMany({
    where: {
      tenant_id: tenantId,
      role,
      is_active: true,
    },
    select: { id: true },
  });

  let totalSent = 0;
  let totalFailed = 0;

  for (const emp of employees) {
    const result = await sendToEmployee(tenantId, emp.id, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}

export async function sendTest(
  tenantId: string,
  employeeId: string
): Promise<{ sent: number; failed: number }> {
  const payload: NotificationPayload = {
    type: 'TEST',
    title: '🔔 Notificación de prueba',
    body: 'Las notificaciones están funcionando correctamente',
    data: {
      order_id: 'test',
      url: '/mozo',
    },
  };

  return sendToEmployee(tenantId, employeeId, payload);
}

// ============ ADMIN ============

export async function getSubscriptionStatus(
  tenantId: string
): Promise<EmployeeSubscriptionStatus[]> {
  const employees = await prisma.employees.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: ['WAITER', 'CASHIER'] },
    },
    select: {
      id: true,
      name: true,
      push_subscriptions: {
        select: {
          last_used_at: true,
        },
        orderBy: {
          last_used_at: 'desc',
        },
        take: 1,
      },
    },
  });

  const now = new Date();

  return employees.map(emp => {
    const lastSub = emp.push_subscriptions[0];
    const lastActive = lastSub?.last_used_at || null;
    
    let daysInactive = 0;
    if (lastActive) {
      daysInactive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      employee_id: emp.id,
      employee_name: emp.name,
      has_subscription: emp.push_subscriptions.length > 0,
      last_active: lastActive?.toISOString() || null,
      days_inactive: lastActive ? daysInactive : -1,
    };
  });
}

// ============ VAPID KEY GETTER ============

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
