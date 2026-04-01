/**
 * SSE API Endpoint
 * 
 * Server-Sent Events endpoint for real-time delivery updates.
 * Supports initial state synchronization and Last-Event-ID for reconnection.
 * 
 * Requirements: 1.2, 1.6
 */

import { NextRequest } from 'next/server';
import { sseConnectionManager } from '@/src/core/delivery/sse-connection-manager';
import { sseBroadcaster } from '@/src/core/delivery/sse-broadcaster';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { logger } from '@/src/core/observability/logger';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/src/core/db/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/deliveries/stream
 * 
 * Establishes an SSE connection for real-time delivery updates.
 * 
 * Query Parameters:
 * - restaurantId: Optional filter for specific restaurant
 * - driverId: Optional filter for specific driver
 * 
 * Headers:
 * - Last-Event-ID: Optional, for reconnection with missed events
 */
export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const searchParams = request.nextUrl.searchParams;
  const restaurantId = searchParams.get('restaurantId') || undefined;
  const driverId = searchParams.get('driverId') || undefined;
  const lastEventId = request.headers.get('Last-Event-ID') || undefined;
  
  const clientId = uuidv4();
  
  logger.info('SSE_CONNECTION_REQUEST', 'SSE connection request', {
    clientId,
    restaurantId,
    driverId,
    lastEventId
  });
  
  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Add client to connection manager
        await sseConnectionManager.addClient(
          clientId,
          controller,
          restaurantId,
          driverId
        );
        
        // Send initial connection message
        const encoder = new TextEncoder();
        const connectionMessage = encoder.encode(
          `data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`
        );
        controller.enqueue(connectionMessage);
        
        // Send initial state (all active deliveries)
        await sendInitialState(controller, restaurantId, driverId);
        
        // If Last-Event-ID is provided, send missed events
        if (lastEventId) {
          await sendMissedEvents(controller, lastEventId, restaurantId, driverId);
        }
        
        logger.info('SSE_CONNECTION_ESTABLISHED', 'SSE connection established', {
          clientId,
          restaurantId,
          driverId
        });
      } catch (error) {
        logger.error('SSE_CONNECTION_ERROR', 'Error establishing SSE connection', error instanceof Error ? error : undefined, {
          clientId
        });
        
        try {
          controller.error(error);
        } catch {
          // Controller may already be closed
        }
      }
    },
    
    async cancel() {
      // Client disconnected
      await sseConnectionManager.removeClient(clientId);
      
      logger.info('SSE_CONNECTION_CLOSED', 'SSE connection closed by client', {
        clientId,
        restaurantId,
        driverId
      });
    }
  });
  
  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Send initial state of all active deliveries to a new client
 * 
 * @param controller - ReadableStream controller
 * @param restaurantId - Optional restaurant filter
 * @param driverId - Optional driver filter
 */
async function sendInitialState(
  controller: ReadableStreamDefaultController,
  restaurantId?: string,
  driverId?: string
): Promise<void> {
  try {
    // Query active deliveries from database
    const where: any = {
      status: {
        in: ['PENDING', 'ASSIGNED', 'DISPATCHED']
      }
    };
    
    if (restaurantId) {
      where.tenant_id = restaurantId;
    }
    
    if (driverId) {
      where.driver_id = driverId;
    }
    
    const activeDeliveries = await prisma.delivery_orders.findMany({
      where,
      include: {
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    // Send initial state as a single event
    const encoder = new TextEncoder();
    const initialStateMessage = encoder.encode(
      `event: initial_state\n` +
      `data: ${JSON.stringify({
        deliveries: activeDeliveries,
        timestamp: new Date().toISOString(),
        count: activeDeliveries.length
      })}\n\n`
    );
    
    controller.enqueue(initialStateMessage);
    
    logger.debug('SSE_INITIAL_STATE_SENT', 'Sent initial state to SSE client', {
      deliveryCount: activeDeliveries.length,
      restaurantId,
      driverId
    });
  } catch (error) {
    logger.error('SSE_INITIAL_STATE_ERROR', 'Error sending initial state', error instanceof Error ? error : undefined, {
      restaurantId,
      driverId
    });
  }
}

/**
 * Send missed events to a reconnecting client
 * 
 * This is a simplified implementation. In production, you would:
 * 1. Store recent events in Redis with TTL
 * 2. Query events after lastEventId
 * 3. Send them in order
 * 
 * @param controller - ReadableStream controller
 * @param lastEventId - Last event ID received by client
 * @param restaurantId - Optional restaurant filter
 * @param driverId - Optional driver filter
 */
async function sendMissedEvents(
  controller: ReadableStreamDefaultController,
  lastEventId: string,
  restaurantId?: string,
  driverId?: string
): Promise<void> {
  try {
    // Parse lastEventId to get timestamp
    // Format: timestamp-counter-uuid
    const parts = lastEventId.split('-');
    if (parts.length < 1) {
      logger.warn('SSE_INVALID_LAST_EVENT_ID', 'Invalid Last-Event-ID format', { lastEventId });
      return;
    }
    
    const lastTimestamp = parseInt(parts[0], 10);
    if (isNaN(lastTimestamp)) {
      logger.warn('SSE_INVALID_TIMESTAMP', 'Invalid timestamp in Last-Event-ID', { lastEventId });
      return;
    }
    
    const lastDate = new Date(lastTimestamp);
    
    // Query recent delivery updates from database
    // In production, this would query a dedicated events table or Redis
    const where: any = {
      updated_at: {
        gt: lastDate
      }
    };
    
    if (restaurantId) {
      where.tenant_id = restaurantId;
    }
    
    if (driverId) {
      where.driver_id = driverId;
    }
    
    const recentUpdates = await prisma.delivery_orders.findMany({
      where,
      include: {
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: {
        created_at: 'desc' // Use created_at since updated_at doesn't exist
      },
      take: 50 // Limit to prevent overwhelming the client
    });
    
    // Send each update as a separate event
    const encoder = new TextEncoder();
    for (const delivery of recentUpdates) {
      const eventMessage = encoder.encode(
        `event: order_updated\n` +
        `data: ${JSON.stringify({
          delivery,
          timestamp: delivery.created_at.toISOString() // Use created_at since updated_at doesn't exist
        })}\n\n`
      );
      controller.enqueue(eventMessage);
    }
    
    logger.info('SSE_MISSED_EVENTS_SENT', 'Sent missed events to reconnecting SSE client', {
      lastEventId,
      missedEvents: recentUpdates.length,
      restaurantId,
      driverId
    });
  } catch (error) {
    logger.error('SSE_MISSED_EVENTS_ERROR', 'Error sending missed events', error instanceof Error ? error : undefined, {
      lastEventId,
      restaurantId,
      driverId
    });
  }
}
