/**
 * GET /api/admin/notifications/status - Get subscription status for all employees
 * 
 * Requirements: 7.1, 7.2
 * - Returns subscription status for all WAITER and CASHIER employees
 * - Includes days_inactive calculation
 * - Requires ADMIN or OWNER role
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';

export async function GET(request: NextRequest) {
  try {
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

    const status = await notificationService.getSubscriptionStatus(session.tenantId);

    // Add warning flag for inactive subscriptions (> 7 days)
    const statusWithWarnings = status.map(s => ({
      ...s,
      needs_attention: s.has_subscription && s.days_inactive > 7,
    }));

    return NextResponse.json({
      employees: statusWithWarnings,
      summary: {
        total: status.length,
        subscribed: status.filter(s => s.has_subscription).length,
        not_subscribed: status.filter(s => !s.has_subscription).length,
        inactive_warning: status.filter(s => s.has_subscription && s.days_inactive > 7).length,
      },
      vapid_configured: !!notificationService.getVapidPublicKey(),
    });
  } catch (error) {
    console.error('[API] Notification status error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification status' },
      { status: 500 }
    );
  }
}
