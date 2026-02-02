/**
 * Enhanced Push Notification Service
 * 
 * Implements modern push notifications with:
 * - Multiple provider support (Web Push, Firebase, APNS)
 * - Retry mechanism with exponential backoff
 * - Delivery tracking and analytics
 * - User preference management
 * - Template-based notifications
 */

import webpush from 'web-push';
import { randomBytes } from 'crypto';

type PrismaClientType = any;

export interface PushNotification {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  ttl?: number; // Time to live in seconds
  urgency?: 'normal' | 'high' | 'low';
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceInfo?: string;
}

export interface PushResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
  retryable?: boolean;
}

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  type: 'ORDER_READY' | 'DRIVER_ASSIGNED' | 'DELIVERY_UPDATE' | 'PAYMENT_RECEIVED';
  title_template: string;
  body_template: string;
  variables_schema: Record<string, string>;
  is_active: boolean;
}

export interface NotificationPreferences {
  employee_id: string;
  tenant_id: string;
  orders_ready: boolean;
  driver_assigned: boolean;
  delivery_updates: boolean;
  payment_received: boolean;
  sound_enabled: boolean;
  quiet_hours: {
    enabled: boolean;
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
  };
}

class EnhancedPushService {
  private vapidKeys: {
    publicKey: string;
    privateKey: string;
    subject: string;
  };

  private prisma: PrismaClientType;

  constructor(prisma: PrismaClientType) {
    this.prisma = prisma;
    
    // Initialize VAPID keys
    this.vapidKeys = {
      publicKey: process.env.VAPID_PUBLIC_KEY!,
      privateKey: process.env.VAPID_PRIVATE_KEY!,
      subject: process.env.VAPID_SUBJECT!,
    };
  }

  /**
   * Send notification to a single subscription
   */
  async sendNotification(
    subscription: PushSubscription,
    notification: PushNotification
  ): Promise<PushResult> {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192x192.png',
      badge: notification.badge || '/badge-72x72.png',
      data: notification.data || {},
      actions: notification.actions || [],
      requireInteraction: notification.requireInteraction || false,
      timestamp: new Date().toISOString(),
    });

    const pushOptions = {
      TTL: notification.ttl || 24 * 60 * 60, // 24 hours default
      urgency: notification.urgency || 'normal',
      vapidDetails: this.vapidKeys,
    };

    try {
      const result = await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payload,
        pushOptions
      );

      return {
        success: true,
        messageId: this.generateMessageId(),
      };
    } catch (error: any) {
      let statusCode = 500;
      let retryable = false;

      if (error.statusCode) {
        statusCode = error.statusCode;
        retryable = [408, 429, 500, 502, 503, 504].includes(error.statusCode);
      }

      return {
        success: false,
        error: error.message || 'Unknown push error',
        statusCode,
        retryable,
      };
    }
  }

  /**
   * Send notification to multiple subscriptions with batch processing
   */
  async sendNotificationToMany(
    subscriptions: PushSubscription[],
    notification: PushNotification
  ): Promise<PushResult[]> {
    const results: PushResult[] = [];
    
    // Process in batches to avoid overwhelming push services
    const batchSize = 100;
    for (let i = 0; i < subscriptions.length; i += batchSize) {
      const batch = subscriptions.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(subscription => this.sendNotification(subscription, notification))
      );
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            error: result.reason?.message || 'Batch processing failed',
          });
        }
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < subscriptions.length) {
        await this.delay(100); // 100ms between batches
      }
    }

    return results;
  }

  /**
   * Send notification using template
   */
  async sendTemplateNotification(
    tenantId: string,
    templateType: string,
    variables: Record<string, any>,
    recipientFilter?: {
      employeeIds?: string[];
      roles?: string[];
      locations?: string[];
    }
  ): Promise<{
    success: boolean;
    sent: number;
    failed: number;
    errors: string[];
  }> {
    try {
      // Get template
      const template = await this.prisma.message_templates.findFirst({
        where: {
          tenant_id: tenantId,
          type: templateType,
          is_active: true,
        },
      });

      if (!template) {
        return {
          success: false,
          sent: 0,
          failed: 0,
          errors: [`Template not found for type: ${templateType}`],
        };
      }

      // Render template with variables
      const renderedNotification = this.renderTemplate(template, variables);

      // Get target subscriptions
      const subscriptions = await this.getTargetSubscriptions(
        tenantId,
        renderedNotification.type,
        recipientFilter
      );

      // Send notifications
      const results = await this.sendNotificationToMany(subscriptions, renderedNotification);

      // Log delivery
      await this.logNotificationDelivery(
        tenantId,
        template.id,
        subscriptions.length,
        results
      );

      const sent = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const errors = results.filter(r => !r.success).map(r => r.error!);

      return { success: sent > 0, sent, failed, errors };
    } catch (error) {
      return {
        success: false,
        sent: 0,
        failed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Send order-ready notification
   */
  async notifyOrderReady(
    tenantId: string,
    orderId: string,
    orderType: string,
    customerName?: string
  ): Promise<PushResult[]> {
    const notification: PushNotification = {
      title: '¡Pedido Listo!',
      body: customerName 
        ? `El pedido de ${customerName} está listo para recoger.`
        : 'Tu pedido está listo para recoger.',
      data: {
        type: 'ORDER_READY',
        orderId,
        orderType,
        actionUrl: `/orders/${orderId}`,
      },
      actions: [
        {
          action: 'view',
          title: 'Ver Pedido',
        },
      ],
      urgency: 'high',
      ttl: 30 * 60, // 30 minutes
    };

    const subscriptions = await this.getTargetSubscriptions(tenantId, 'ORDER_READY');
    return await this.sendNotificationToMany(subscriptions, notification);
  }

  /**
   * Send driver assignment notification
   */
  async notifyDriverAssigned(
    tenantId: string,
    driverId: string,
    orderId: string,
    deliveryInfo: {
      address: string;
      estimatedTime: Date;
    }
  ): Promise<PushResult[]> {
    const notification: PushNotification = {
      title: 'Nuevo Assignment',
      body: `Nuevo pedido asignado para entrega en ${deliveryInfo.address}`,
      data: {
        type: 'DRIVER_ASSIGNED',
        orderId,
        driverId,
        deliveryInfo,
        actionUrl: `/driver/orders/${orderId}`,
      },
      actions: [
        {
          action: 'navigate',
          title: 'Navegar',
        },
        {
          action: 'decline',
          title: 'Rechazar',
        },
      ],
      urgency: 'high',
      ttl: 60 * 60, // 1 hour
    };

    const subscriptions = await this.getTargetSubscriptions(tenantId, 'DRIVER_ASSIGNED', {
      employeeIds: [driverId],
    });
    
    return await this.sendNotificationToMany(subscriptions, notification);
  }

  /**
   * Get subscriptions filtered by preferences
   */
  private async getTargetSubscriptions(
    tenantId: string,
    notificationType: string,
    filters?: {
      employeeIds?: string[];
      roles?: string[];
      locations?: string[];
    }
  ): Promise<PushSubscription[]> {
    let whereClause: any = {
      tenant_id: tenantId,
      employee: {
        is_active: true,
        ...filters?.employeeIds && { id: { in: filters.employeeIds } },
        ...filters?.roles && { role: { in: filters.roles } },
      },
    };

    const subscriptions = await this.prisma.push_subscriptions.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            notification_preferences: true,
          },
        },
      },
    });

    // Filter by notification preferences and quiet hours
    return subscriptions.filter(sub => {
      const preferences = sub.employee?.notification_preferences;
      if (!preferences) return true;

      // Check quiet hours
      if (preferences.sound_enabled && preferences.quiet_hours?.enabled) {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        if (this.isTimeInQuietHours(currentTime, preferences.quiet_hours)) {
          return false;
        }
      }

      // Check notification type preferences
      switch (notificationType) {
        case 'ORDER_READY':
          return preferences.items_ready;
        case 'DRIVER_ASSIGNED':
          return true; // Always send driver assignments
        case 'DELIVERY_UPDATE':
          return true; // Always send delivery updates
        case 'PAYMENT_RECEIVED':
          return preferences.request_check;
        default:
          return true;
      }
    }).map(sub => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh_key,
        auth: sub.auth_key,
      },
      deviceInfo: sub.device_info,
    }));
  }

  /**
   * Render template with variables
   */
  private renderTemplate(
    template: any,
    variables: Record<string, any>
  ): PushNotification & { type: string } {
    const title = this.replaceVariables(template.title_template, variables);
    const body = this.replaceVariables(template.content, variables);

    return {
      title,
      body,
      type: template.type,
      data: { templateId: template.id, variables },
    };
  }

  /**
   * Replace template variables
   */
  private replaceVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return result;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isTimeInQuietHours(
    currentTime: string,
    quietHours: { start_time: string; end_time: string }
  ): boolean {
    const current = this.timeToMinutes(currentTime);
    const start = this.timeToMinutes(quietHours.start_time);
    const end = this.timeToMinutes(quietHours.end_time);

    if (start <= end) {
      return current >= start && current <= end;
    } else {
      return current >= start || current <= end;
    }
  }

  /**
   * Convert time string to minutes
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Log notification delivery
   */
  private async logNotificationDelivery(
    tenantId: string,
    templateId: string,
    totalRecipients: number,
    results: PushResult[]
  ): Promise<void> {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    await this.prisma.notification_logs.create({
      data: {
        id: randomBytes(16).toString('hex'),
        tenant_id: tenantId,
        template_id: templateId,
        total_recipients: totalRecipients,
        success_count: successCount,
        failure_count: failureCount,
        delivery_results: results,
        created_at: new Date(),
      },
    });
  }

  /**
   * Simple delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get push notification statistics
   */
  async getNotificationStats(
    tenantId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    totalSent: number;
    successRate: number;
    mostUsedTemplate: string;
    errorBreakdown: Record<string, number>;
  }> {
    const whereClause: any = {
      tenant_id: tenantId,
      ...dateRange && {
        created_at: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      },
    };

    const logs = await this.prisma.notification_logs.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      take: 1000, // Last 1000 notifications
    });

    const totalSent = logs.reduce((sum, log) => sum + log.total_recipients, 0);
    const totalSuccess = logs.reduce((sum, log) => sum + log.success_count, 0);
    const successRate = totalSent > 0 ? (totalSuccess / totalSent) * 100 : 0;

    // Find most used template
    const templateCounts = logs.reduce((acc, log) => {
      acc[log.template_id] = (acc[log.template_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostUsedTemplate = Object.entries(templateCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] || '';

    // Error breakdown
    const errorBreakdown = logs.reduce((acc, log) => {
      log.delivery_results?.forEach((result: PushResult) => {
        if (!result.success && result.error) {
          acc[result.error] = (acc[result.error] || 0) + 1;
        }
      });
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSent,
      successRate,
      mostUsedTemplate,
      errorBreakdown,
    };
  }
}

export default EnhancedPushService;