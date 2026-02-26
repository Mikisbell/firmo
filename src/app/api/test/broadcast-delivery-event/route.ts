/**
 * Test API Endpoint - Broadcast Delivery Event
 * 
 * Manually trigger a delivery event broadcast for testing SSE.
 * This endpoint is for testing purposes only.
 * 
 * POST /api/test/broadcast-delivery-event
 */

import { NextRequest, NextResponse } from 'next/server';
import { broadcastDeliveryEvent } from '@/src/core/delivery/sse-broadcaster';
import { logger } from '@/src/core/observability/logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const body = await request.json();
    
    const { type, data, restaurantId, driverId } = body;
    
    if (!type) {
      return NextResponse.json(
        { error: 'Event type is required' },
        { status: 400 }
      );
    }
    
    if (!data) {
      return NextResponse.json(
        { error: 'Event data is required' },
        { status: 400 }
      );
    }
    
    // Broadcast the event
    await broadcastDeliveryEvent(
      type,
      data,
      restaurantId,
      driverId
    );
    
    logger.info('TEST_DELIVERY_EVENT_BROADCAST', 'Test delivery event broadcast', {
      type,
      restaurantId,
      driverId,
      dataKeys: Object.keys(data)
    });
    
    return NextResponse.json({
      success: true,
      message: 'Event broadcast successfully',
      event: {
        type,
        restaurantId,
        driverId,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('TEST_DELIVERY_EVENT_ERROR', 'Error broadcasting test delivery event', error instanceof Error ? error : undefined);
    
    return NextResponse.json(
      { 
        error: 'Failed to broadcast event',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
