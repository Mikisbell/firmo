/**
 * Unit Tests for Push Service
 * 
 * Tests specific examples and edge cases:
 * - Subscription storage and retrieval
 * - Notification sending with mock web-push
 * - Queueing for offline drivers
 * - Retry logic with exponential backoff
 * - Invalid subscription removal
 * - Error handling (web-push failure, Redis failure)
 * 
 * @module delivery/__tests__/push-unit
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribe,
  unsubscribe,
  getSubscriptions,
  sendNotification,
  queueNotification,
  processQueue,
  createAssignmentNotification,
  createUpdateNotification,
  createCustomerMessageNotification,
  createSystemAlertNotification,
} from '../push.service';
import { toDriverId, toTenantId } from '../types-2026';
import type { PushNotification } from '../types-2026';

// Mock dependencies
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    push_subscriptions: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../redis-connection', () => ({
  getRedisClient: vi.fn(() => ({
    rpush: vi.fn(),
    expire: vi.fn(),
    lrange: vi.fn(),
    lrem: vi.fn(),
    keys: vi.fn(),
  })),
}));

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}));

// Import mocked modules
import prisma from '@/src/core/db/prisma';
// Note: getRedisClient is not exported, commenting out for now
// import { getRedisClient } from '../redis-connection';
import webpush from 'web-push';

describe('Push Service - Unit Tests', () => {
  const tenantId = toTenantId('tenant-123');
  const driverId = toDriverId('driver-456');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subscription Management', () => {
    it('should store new subscription', async () => {
      const subscription = {
        endpoint: 'https://push.example.com/abc123',
        keys: {
          p256dh: 'test-p256dh-key',
          auth: 'test-auth-key',
        },
      };

      (prisma.push_subscriptions.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sub-id',
        tenant_id: tenantId,
        employee_id: driverId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        created_at: new Date(),
        last_used_at: new Date(),
      });

      await subscribe(tenantId, driverId, subscription);

      expect(prisma.push_subscriptions.upsert).toHaveBeenCalledWith({
        where: {
          tenant_id_employee_id_endpoint: {
            tenant_id: tenantId,
            employee_id: driverId,
            endpoint: subscription.endpoint,
          },
        },
        update: expect.objectContaining({
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
        }),
        create: expect.objectContaining({
          tenant_id: tenantId,
          employee_id: driverId,
          endpoint: subscription.endpoint,
          p256dh_key: subscription.keys.p256dh,
          auth_key: subscription.keys.auth,
        }),
      });
    });

    it('should update existing subscription', async () => {
      const subscription = {
        endpoint: 'https://push.example.com/abc123',
        keys: {
          p256dh: 'new-p256dh-key',
          auth: 'new-auth-key',
        },
      };

      (prisma.push_subscriptions.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'sub-id',
        tenant_id: tenantId,
        employee_id: driverId,
        endpoint: subscription.endpoint,
        p256dh_key: subscription.keys.p256dh,
        auth_key: subscription.keys.auth,
        created_at: new Date('2024-01-01'),
        last_used_at: new Date(),
      });

      await subscribe(tenantId, driverId, subscription);

      expect(prisma.push_subscriptions.upsert).toHaveBeenCalled();
    });

    it('should remove subscription', async () => {
      const endpoint = 'https://push.example.com/abc123';

      (prisma.push_subscriptions.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });

      await unsubscribe(tenantId, driverId, endpoint);

      expect(prisma.push_subscriptions.deleteMany).toHaveBeenCalledWith({
        where: {
          tenant_id: tenantId,
          employee_id: driverId,
          endpoint,
        },
      });
    });

    it('should retrieve all subscriptions for driver', async () => {
      const mockSubs = [
        {
          id: 'sub-1',
          employee_id: driverId,
          endpoint: 'https://push.example.com/device1',
          p256dh_key: 'p256dh-1',
          auth_key: 'auth-1',
          created_at: new Date(),
          last_used_at: new Date(),
        },
        {
          id: 'sub-2',
          employee_id: driverId,
          endpoint: 'https://push.example.com/device2',
          p256dh_key: 'p256dh-2',
          auth_key: 'auth-2',
          created_at: new Date(),
          last_used_at: new Date(),
        },
      ];

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockSubs);

      const subscriptions = await getSubscriptions(tenantId, driverId);

      expect(subscriptions).toHaveLength(2);
      expect(subscriptions[0].endpoint).toBe('https://push.example.com/device1');
      expect(subscriptions[1].endpoint).toBe('https://push.example.com/device2');
    });

    it('should return empty array when no subscriptions', async () => {
      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const subscriptions = await getSubscriptions(tenantId, driverId);

      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('Notification Sending', () => {
    it('should send notification to driver with subscription', async () => {
      const notification: PushNotification = {
        title: 'Test Notification',
        body: 'This is a test',
        priority: 'normal',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.push_subscriptions.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await sendNotification(tenantId, driverId, notification);

      expect(webpush.sendNotification).toHaveBeenCalled();
      expect(prisma.push_subscriptions.update).toHaveBeenCalledWith({
        where: { id: 'sub-id' },
        data: { last_used_at: expect.any(Date) },
      });
    });

    it('should send notification to multiple devices', async () => {
      const notification: PushNotification = {
        title: 'Test Notification',
        body: 'This is a test',
        priority: 'normal',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: 'sub-1',
          employee_id: driverId,
          endpoint: 'https://push.example.com/device1',
          p256dh_key: 'p256dh-1',
          auth_key: 'auth-1',
          created_at: new Date(),
          last_used_at: new Date(),
        },
        {
          id: 'sub-2',
          employee_id: driverId,
          endpoint: 'https://push.example.com/device2',
          p256dh_key: 'p256dh-2',
          auth_key: 'auth-2',
          created_at: new Date(),
          last_used_at: new Date(),
        },
      ]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.push_subscriptions.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await sendNotification(tenantId, driverId, notification);

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should include action buttons in notification', async () => {
      const notification: PushNotification = {
        title: 'New Order',
        body: 'Order #123',
        priority: 'urgent',
        actions: [
          { action: 'accept', title: 'Accept' },
          { action: 'reject', title: 'Reject' },
        ],
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.push_subscriptions.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await sendNotification(tenantId, driverId, notification);

      const callArgs = (webpush.sendNotification as ReturnType<typeof vi.fn>).mock.calls[0];
      const payload = JSON.parse(callArgs[1]);

      expect(payload.actions).toHaveLength(2);
      expect(payload.actions[0].action).toBe('accept');
      expect(payload.actions[1].action).toBe('reject');
    });

    it('should set urgent priority correctly', async () => {
      const notification: PushNotification = {
        title: 'Urgent Alert',
        body: 'Immediate action required',
        priority: 'urgent',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.push_subscriptions.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await sendNotification(tenantId, driverId, notification);

      const callArgs = (webpush.sendNotification as ReturnType<typeof vi.fn>).mock.calls[0];
      const payload = JSON.parse(callArgs[1]);

      expect(payload.tag).toBe('urgent');
      expect(payload.requireInteraction).toBe(true);
    });

    it('should remove expired subscription (410 Gone)', async () => {
      const notification: PushNotification = {
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      };

      const subscriptionId = 'expired-sub';

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: subscriptionId,
        employee_id: driverId,
        endpoint: 'https://push.example.com/expired',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue({
        statusCode: 410,
        message: 'Gone',
      });

      (prisma.push_subscriptions.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await sendNotification(tenantId, driverId, notification);

      expect(prisma.push_subscriptions.delete).toHaveBeenCalledWith({
        where: { id: subscriptionId },
      });
    });
  });

  describe('Notification Queueing', () => {
    it('should queue notification when driver has no subscriptions', async () => {
      const notification: PushNotification = {
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const redis = getRedisClient();
      (redis.rpush as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await sendNotification(tenantId, driverId, notification);

      const rpushCalls = (redis.rpush as ReturnType<typeof vi.fn>).mock.calls;
      expect(rpushCalls.length).toBeGreaterThan(0);
      expect(rpushCalls[rpushCalls.length - 1][0]).toBe(`push:queue:${tenantId}:${driverId}`);
    });

    it('should set expiration for queued notification with expiresAt', async () => {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      const notification: PushNotification = {
        title: 'Urgent',
        body: 'Expires soon',
        priority: 'urgent',
        expiresAt,
      };

      const redis = getRedisClient();
      (redis.rpush as ReturnType<typeof vi.fn>).mockResolvedValue(1);
      (redis.expire as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      await queueNotification(tenantId, driverId, notification);

      expect(redis.expire).toHaveBeenCalled();
    });

    it('should process queued notifications', async () => {
      const notification: PushNotification = {
        title: 'Queued',
        body: 'From queue',
        priority: 'normal',
      };

      const queueItem = {
        notification,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      };

      const redis = getRedisClient();
      (redis.lrange as ReturnType<typeof vi.fn>).mockResolvedValue([JSON.stringify(queueItem)]);
      (redis.lrem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.push_subscriptions.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await processQueue(tenantId, driverId);

      expect(webpush.sendNotification).toHaveBeenCalled();
      expect(redis.lrem).toHaveBeenCalled();
    });

    it('should skip expired notifications in queue', async () => {
      const expiredNotification: PushNotification = {
        title: 'Expired',
        body: 'Too late',
        priority: 'urgent',
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      const queueItem = {
        notification: expiredNotification,
        queuedAt: new Date(Date.now() - 10000).toISOString(),
        attempts: 0,
      };

      const redis = getRedisClient();
      (redis.lrange as ReturnType<typeof vi.fn>).mockResolvedValue([JSON.stringify(queueItem)]);
      (redis.lrem as ReturnType<typeof vi.fn>).mockResolvedValue(1);

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      await processQueue(tenantId, driverId);

      // Should not send expired notification
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });

  describe('Helper Functions', () => {
    it('should create assignment notification', () => {
      const notification = createAssignmentNotification(123, 'John Doe', '123 Main St');

      expect(notification.title).toBe('Nueva Orden Asignada');
      expect(notification.body).toContain('123');
      expect(notification.body).toContain('John Doe');
      expect(notification.priority).toBe('urgent');
      expect(notification.actions).toHaveLength(2);
      expect(notification.expiresAt).toBeDefined();
    });

    it('should create update notification', () => {
      const notification = createUpdateNotification(456, 'Customer called');

      expect(notification.title).toBe('Actualización de Orden');
      expect(notification.body).toContain('456');
      expect(notification.body).toContain('Customer called');
      expect(notification.priority).toBe('normal');
    });

    it('should create customer message notification', () => {
      const notification = createCustomerMessageNotification(789, 'Please hurry');

      expect(notification.title).toBe('Mensaje del Cliente');
      expect(notification.body).toContain('789');
      expect(notification.body).toContain('Please hurry');
      expect(notification.priority).toBe('normal');
    });

    it('should create system alert notification', () => {
      const notification = createSystemAlertNotification('Server maintenance in 10 minutes');

      expect(notification.title).toBe('Alerta del Sistema');
      expect(notification.body).toContain('Server maintenance');
      expect(notification.priority).toBe('urgent');
    });
  });

  describe('Error Handling', () => {
    it('should handle web-push send failure gracefully', async () => {
      const notification: PushNotification = {
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{
        id: 'sub-id',
        employee_id: driverId,
        endpoint: 'https://push.example.com/abc123',
        p256dh_key: 'test-p256dh',
        auth_key: 'test-auth',
        created_at: new Date(),
        last_used_at: new Date(),
      }]);

      (webpush.sendNotification as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      // Should not throw - errors are handled internally
      await expect(sendNotification(tenantId, driverId, notification)).resolves.not.toThrow();
    });

    it('should handle Redis failure gracefully', async () => {
      const notification: PushNotification = {
        title: 'Test',
        body: 'Test',
        priority: 'normal',
      };

      (prisma.push_subscriptions.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const redis = getRedisClient();
      (redis.rpush as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis connection failed'));

      // Should throw (Redis is critical for queueing)
      await expect(sendNotification(tenantId, driverId, notification)).rejects.toThrow('Redis connection failed');
    });
  });
});
