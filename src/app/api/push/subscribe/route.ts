/**
 * Push Notification Subscribe API Endpoint
 * 
 * POST /api/push/subscribe
 * 
 * Stores a Web Push API subscription for a driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/src/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/src/core/delivery/types-2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenantId || !body.driverId || !body.subscription) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, driverId, subscription' },
        { status: 400 }
      );
    }

    // Validate subscription format
    const { subscription } = body;
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json(
        { error: 'Invalid subscription format. Must include endpoint and keys (p256dh, auth)' },
        { status: 400 }
      );
    }

    // Store subscription
    await subscribe(
      toTenantId(body.tenantId),
      toDriverId(body.driverId),
      subscription
    );

    return NextResponse.json({
      success: true,
      message: 'Push subscription stored successfully',
    });
  } catch (error) {
    console.error('Error storing push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to store push subscription' },
      { status: 500 }
    );
  }
}
