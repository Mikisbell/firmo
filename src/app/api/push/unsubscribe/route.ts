/**
 * Push Notification Unsubscribe API Endpoint
 * 
 * POST /api/push/unsubscribe
 * 
 * Removes a Web Push API subscription for a driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { unsubscribe } from '@/core/delivery/push.service';
import { toDriverId, toTenantId } from '@/core/delivery/types-2026';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.tenantId || !body.driverId || !body.endpoint) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, driverId, endpoint' },
        { status: 400 }
      );
    }

    // Remove subscription
    await unsubscribe(
      toTenantId(body.tenantId),
      toDriverId(body.driverId),
      body.endpoint
    );

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed successfully',
    });
  } catch (error) {
    console.error('Error removing push subscription:', error);
    return NextResponse.json(
      { error: 'Failed to remove push subscription' },
      { status: 500 }
    );
  }
}
