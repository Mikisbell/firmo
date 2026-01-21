/**
 * GET /api/admin/notifications/status - Get subscription status for all employees
 * 
 * Requirements: 7.1, 7.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

async function handleGET(request: NextRequest) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const log = createRequestLogger(requestId);
  
  try {
    log.info({ operation: 'get_notification_status' }, 'Getting notification status');
    
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require ADMIN or OWNER role
    if (!['ADMIN', 'OWNER'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey('notifications:status', session.tenantId);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_notification_status_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Notification status retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get subscription status
    const serviceStart = Date.now();
    const status = await notificationService.getSubscriptionStatus(session.tenantId);
    logPerformance('service_get_notification_status', Date.now() - serviceStart);

    // Add warning flag for inactive subscriptions (> 7 days)
    const statusWithWarnings = status.map(s => ({
      ...s,
      needs_attention: s.has_subscription && s.days_inactive > 7,
    }));

    const response = {
      employees: statusWithWarnings,
      summary: {
        total: status.length,
        subscribed: status.filter(s => s.has_subscription).length,
        not_subscribed: status.filter(s => !s.has_subscription).length,
        inactive_warning: status.filter(s => s.has_subscription && s.days_inactive > 7).length,
      },
      vapid_configured: !!notificationService.getVapidPublicKey(),
    };

    // Cache for 2 minutes
    await cache.set(cacheKey, response, 120);

    // Record business metrics
    metrics.increment('notification_status_requests_total', {
      tenant_id: session.tenantId,
    });
    metrics.set('notification_subscriptions_total', response.summary.subscribed, {
      tenant_id: session.tenantId,
    });

    log.info({
      operation: 'get_notification_status_success',
      employeesCount: status.length,
      subscribedCount: response.summary.subscribed,
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Notification status retrieved successfully');

    return NextResponse.json(response);
  } catch (error) {
    log.error({
      operation: 'get_notification_status_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get notification status');
    
    return NextResponse.json(
      { error: 'Failed to get notification status' },
      { status: 500 }
    );
  }
}

export const GET = withRequestLogging(handleGET);
