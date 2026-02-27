/**
 * Push Notification Send API Endpoint
 * 
 * POST /api/push/send
 * 
 * Sends a push notification to a driver (for admin testing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/src/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/src/core/delivery/types-2026';
import type { PushNotification } from '@/src/core/delivery/types-2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenantId || !body.driverId || !body.notification) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, driverId, notification' },
        { status: 400 }
      );
    }

    // Validate notification format
    const { notification } = body;
    if (!notification.title || !notification.body || !notification.priority) {
      return NextResponse.json(
        { error: 'Invalid notification format. Must include title, body, and priority' },
        { status: 400 }
      );
    }

    // Validate priority
    if (notification.priority !== 'urgent' && notification.priority !== 'normal') {
      return NextResponse.json(
        { error: 'Invalid priority. Must be "urgent" or "normal"' },
        { status: 400 }
      );
    }

    // Parse expiresAt if provided
    const pushNotification: PushNotification = {
      ...notification,
      expiresAt: notification.expiresAt ? new Date(notification.expiresAt) : undefined,
    };

    // Send notification
    await sendNotification(
      toTenantId(body.tenantId),
      toDriverId(body.driverId),
      pushNotification
    );

    return NextResponse.json({
      success: true,
      message: 'Push notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending push notification:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to send push notification' },
      { status: 500 }
    );
  }
}
