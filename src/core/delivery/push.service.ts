/**
 * Push Service for Delivery Module 2026 Modernization
 * 
 * Manages Web Push API notifications for drivers:
 * - Subscription management (store/retrieve/delete)
 * - Notification sending with web-push library
 * - Notification queueing for offline drivers
 * - Retry logic with exponential backoff
 * 
 * @module delivery/push-service
 */

import webpush from 'web-push';
import prisma from '@/src/core/db/prisma';
import { deliveryRedisService } from './redis-connection';
import type {
  PushNotification,
  PushSubscription,
  DriverId,
  TenantId,
} from './types-2026';
import { PUSH_NOTIFICATION_MAX_RETRIES } from './types-2026';

// ============================================
// Configuration
// ============================================

/**
 * Configure web-push with VAPID keys
 */
export function configurePushService(): void {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@parkpos.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('VAPID keys not configured. Push notifications will not work.');
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

// Initialize on module load
configurePushService();

// ============================================
// Subscription Management
// ============================================

/**
 * Store push subscription for a driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID (employee ID)
 * @param subscription - Web Push API subscription object
 */
export async function subscribe(
  tenantId: TenantId,
  driverId: DriverId,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  }
): Promise<void> {
  await prisma.push_subscriptions.upsert({
    where: {
      tenant_id_employee_id_endpoint: {
        tenant_id: tenantId,
        employee_id: driverId,
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
      employee_id: driverId,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
  });
}

/**
 * Remove push subscription for a driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID
 * @param endpoint - Subscription endpoint to remove
 */
export async function unsubscribe(
  tenantId: TenantId,
  driverId: DriverId,
  endpoint: string
): Promise<void> {
  await prisma.push_subscriptions.deleteMany({
    where: {
      tenant_id: tenantId,
      employee_id: driverId,
      endpoint,
    },
  });
}

/**
 * Get all push subscriptions for a driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID
 * @returns Array of push subscriptions
 */
export async function getSubscriptions(
  tenantId: TenantId,
  driverId: DriverId
): Promise<PushSubscription[]> {
  const subs = await prisma.push_subscriptions.findMany({
    where: {
      tenant_id: tenantId,
      employee_id: driverId,
    },
  });

  return subs.map(sub => ({
    id: sub.id,
    driverId: driverId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh_key,
    auth: sub.auth_key,
    createdAt: sub.created_at,
    updatedAt: sub.last_used_at,
  }));
}

/**
 * Get a single subscription by ID
 * 
 * @param subscriptionId - Subscription ID
 * @returns Push subscription or null
 */
export async function getSubscription(
  subscriptionId: string
): Promise<PushSubscription | null> {
  const sub = await prisma.push_subscriptions.findUnique({
    where: { id: subscriptionId },
  });

  if (!sub) return null;

  return {
    id: sub.id,
    driverId: sub.employee_id as DriverId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh_key,
    auth: sub.auth_key,
    createdAt: sub.created_at,
    updatedAt: sub.last_used_at,
  };
}

// ============================================
// Notification Sending
// ============================================

/**
 * Send push notification to a driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID
 * @param notification - Notification payload
 */
export async function sendNotification(
  tenantId: TenantId,
  driverId: DriverId,
  notification: PushNotification
): Promise<void> {
  const subscriptions = await getSubscriptions(tenantId, driverId);

  if (subscriptions.length === 0) {
    // No subscriptions - queue notification for when driver reconnects
    await queueNotification(tenantId, driverId, notification);
    return;
  }

  // Send to all subscriptions (driver may have multiple devices)
  const sendPromises = subscriptions.map(sub =>
    sendToSubscription(sub, notification)
  );

  await Promise.allSettled(sendPromises);
}

/**
 * Send notification to a specific subscription
 * 
 * @param subscription - Push subscription
 * @param notification - Notification payload
 */
async function sendToSubscription(
  subscription: PushSubscription,
  notification: PushNotification
): Promise<void> {
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon,
    badge: notification.badge,
    data: notification.data,
    actions: notification.actions,
    tag: notification.priority === 'urgent' ? 'urgent' : 'normal',
    requireInteraction: notification.priority === 'urgent',
  });

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, payload);

    // Update last_used_at
    await prisma.push_subscriptions.update({
      where: { id: subscription.id },
      data: { last_used_at: new Date() },
    });
  } catch (error: unknown) {
    // Handle specific errors
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode;
      
      // 410 Gone - subscription expired, remove it
      if (statusCode === 410) {
        await prisma.push_subscriptions.delete({
          where: { id: subscription.id },
        });
        return;
      }
    }

    // For other errors, retry with exponential backoff
    await retryNotification(subscription, notification, 1);
  }
}

/**
 * Retry sending notification with exponential backoff
 * 
 * @param subscription - Push subscription
 * @param notification - Notification payload
 * @param attempt - Current attempt number (1-based)
 */
async function retryNotification(
  subscription: PushSubscription,
  notification: PushNotification,
  attempt: number
): Promise<void> {
  if (attempt > PUSH_NOTIFICATION_MAX_RETRIES) {
    console.error(`Failed to send notification after ${PUSH_NOTIFICATION_MAX_RETRIES} attempts`, {
      subscriptionId: subscription.id,
      driverId: subscription.driverId,
    });
    return;
  }

  // Exponential backoff: 1s, 2s, 4s
  const delayMs = Math.pow(2, attempt - 1) * 1000;
  await new Promise(resolve => setTimeout(resolve, delayMs));

  try {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      data: notification.data,
      actions: notification.actions,
      tag: notification.priority === 'urgent' ? 'urgent' : 'normal',
      requireInteraction: notification.priority === 'urgent',
    });

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    await webpush.sendNotification(pushSubscription, payload);

    // Update last_used_at
    await prisma.push_subscriptions.update({
      where: { id: subscription.id },
      data: { last_used_at: new Date() },
    });
  } catch (error) {
    // Retry again
    await retryNotification(subscription, notification, attempt + 1);
  }
}

/**
 * Send bulk notifications to multiple drivers
 * 
 * @param notifications - Array of driver IDs and notifications
 */
export async function sendBulkNotifications(
  notifications: Array<{
    tenantId: TenantId;
    driverId: DriverId;
    notification: PushNotification;
  }>
): Promise<void> {
  const sendPromises = notifications.map(({ tenantId, driverId, notification }) =>
    sendNotification(tenantId, driverId, notification)
  );

  await Promise.allSettled(sendPromises);
}

// ============================================
// Notification Queueing
// ============================================

/**
 * Queue notification for offline driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID
 * @param notification - Notification payload
 */
export async function queueNotification(
  tenantId: TenantId,
  driverId: DriverId,
  notification: PushNotification
): Promise<void> {
  const redis = deliveryRedisService;
  const queueKey = `push:queue:${tenantId}:${driverId}`;

  const queueItem = {
    notification,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  await redis.rpush(queueKey, JSON.stringify(queueItem));

  // Set expiration if notification has expiresAt
  if (notification.expiresAt) {
    const ttl = Math.floor((notification.expiresAt.getTime() - Date.now()) / 1000);
    if (ttl > 0) {
      await redis.expire(queueKey, ttl);
    }
  }
}

/**
 * Process notification queue for a driver
 * 
 * @param tenantId - Tenant ID
 * @param driverId - Driver ID
 */
export async function processQueue(
  tenantId: TenantId,
  driverId: DriverId
): Promise<void> {
  const redis = deliveryRedisService;
  const queueKey = `push:queue:${tenantId}:${driverId}`;

  // Get all queued notifications
  const items = await redis.lrange(queueKey, 0, -1);

  if (!items || items.length === 0) return;

  // Process each notification
  for (const item of items) {
    try {
      const queueItem = JSON.parse(item);
      const notification = queueItem.notification as PushNotification;

      // Check if notification expired
      if (notification.expiresAt && new Date(notification.expiresAt) < new Date()) {
        continue; // Skip expired notification
      }

      // Try to send
      await sendNotification(tenantId, driverId, notification);

      // Remove from queue if successful
      await redis.lrem(queueKey, 1, item);
    } catch (error) {
      console.error('Error processing queued notification', { error, driverId });
      // Keep in queue for next attempt
    }
  }
}

/**
 * Process all notification queues (background worker)
 * 
 * This should be called periodically (e.g., every 10 seconds)
 */
export async function processAllQueues(): Promise<void> {
  const redis = deliveryRedisService;

  // Get all queue keys
  const keys = await redis.keys('push:queue:*');

  for (const key of keys) {
    // Extract tenantId and driverId from key
    const parts = key.split(':');
    if (parts.length !== 4) continue;

    const tenantId = parts[2] as TenantId;
    const driverId = parts[3] as DriverId;

    await processQueue(tenantId, driverId);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Create notification for new order assignment
 * 
 * @param orderNumber - Order number
 * @param customerName - Customer name
 * @param deliveryAddress - Delivery address
 * @returns Push notification
 */
export function createAssignmentNotification(
  orderNumber: number,
  customerName: string,
  deliveryAddress: string
): PushNotification {
  return {
    title: 'Nueva Orden Asignada',
    body: `Orden #${orderNumber} para ${customerName}`,
    icon: '/icons/delivery-icon.png',
    badge: '/icons/badge-icon.png',
    data: {
      type: 'order_assigned',
      orderNumber,
      customerName,
      deliveryAddress,
    },
    actions: [
      { action: 'accept', title: 'Aceptar' },
      { action: 'reject', title: 'Rechazar' },
    ],
    priority: 'urgent',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  };
}

/**
 * Create notification for order update
 * 
 * @param orderNumber - Order number
 * @param message - Update message
 * @returns Push notification
 */
export function createUpdateNotification(
  orderNumber: number,
  message: string
): PushNotification {
  return {
    title: 'Actualización de Orden',
    body: `Orden #${orderNumber}: ${message}`,
    icon: '/icons/delivery-icon.png',
    data: {
      type: 'order_update',
      orderNumber,
      message,
    },
    priority: 'normal',
  };
}

/**
 * Create notification for customer message
 * 
 * @param orderNumber - Order number
 * @param message - Customer message
 * @returns Push notification
 */
export function createCustomerMessageNotification(
  orderNumber: number,
  message: string
): PushNotification {
  return {
    title: 'Mensaje del Cliente',
    body: `Orden #${orderNumber}: ${message}`,
    icon: '/icons/delivery-icon.png',
    data: {
      type: 'customer_message',
      orderNumber,
      message,
    },
    priority: 'normal',
  };
}

/**
 * Create notification for system alert
 * 
 * @param message - Alert message
 * @returns Push notification
 */
export function createSystemAlertNotification(
  message: string
): PushNotification {
  return {
    title: 'Alerta del Sistema',
    body: message,
    icon: '/icons/alert-icon.png',
    badge: '/icons/badge-icon.png',
    data: {
      type: 'system_alert',
      message,
    },
    priority: 'urgent',
  };
}
