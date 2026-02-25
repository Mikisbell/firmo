/**
 * SSE Broadcasting System
 * 
 * Broadcasts delivery events to connected SSE clients.
 * Supports Redis Pub/Sub for multi-instance broadcasting.
 * Includes event IDs for client-side deduplication.
 * 
 * Requirements: 1.1, 1.4, 1.8
 */

import { deliveryRedisService } from './redis-connection';
import { sseConnectionManager, SSEClient } from './sse-connection-manager';
import { DeliveryEvent, TenantId, DriverId } from './types-2026';
import { logger } from '@/src/core/observability/logger';
import { v4 as uuidv4 } from 'uuid';

export class SSEBroadcaster {
  private readonly REDIS_CHANNEL = 'delivery:events';
  private subscriptionActive = false;
  private eventCounter = 0;
  
  constructor() {
    this.startRedisSubscription();
  }
  
  /**
   * Broadcast an event to all connected clients
   * 
   * @param event - Delivery event to broadcast
   * @returns Promise that resolves when broadcast is complete
   */
  async broadcast(event: DeliveryEvent): Promise<void> {
    const startTime = Date.now();
    
    // Ensure event has an ID for deduplication
    if (!event.id) {
      event.id = this.generateEventId();
    }
    
    // Get filtered clients based on event metadata
    const clients = sseConnectionManager.getFilteredClients(
      event.restaurantId,
      event.driverId
    );
    
    if (clients.length === 0) {
      logger.debug('SSE_NO_CLIENTS', 'No clients to broadcast to', { 
        restaurantId: event.restaurantId,
        driverId: event.driverId,
        eventType: event.type
      });
      return;
    }
    
    // Broadcast to local clients
    const results = await Promise.allSettled(
      clients.map(client => this.sendToClient(client.id, event))
    );
    
    // Count successes and failures
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    // Publish to Redis for other server instances
    try {
      await deliveryRedisService.publish(
        this.REDIS_CHANNEL,
        JSON.stringify(event)
      );
    } catch (error) {
      logger.error('SSE_REDIS_PUBLISH_ERROR', 'Failed to publish event to Redis', error as Error, {
        restaurantId: event.restaurantId,
        driverId: event.driverId,
        eventType: event.type
      });
    }
    
    const latency = Date.now() - startTime;
    
    logger.info('SSE_BROADCAST_COMPLETE', 'Broadcast event to SSE clients', {
      eventId: event.id,
      eventType: event.type,
      totalClients: clients.length,
      successful,
      failed,
      latencyMs: latency,
      restaurantId: event.restaurantId,
      driverId: event.driverId
    });
    
    // Validate latency requirement (< 500ms)
    if (latency > 500) {
      logger.warn('SSE_LATENCY_EXCEEDED', 'SSE broadcast latency exceeded 500ms threshold', {
        eventId: event.id,
        latencyMs: latency,
        threshold: 500
      });
    }
  }
  
  /**
   * Send an event to a specific client
   * 
   * @param clientId - Client identifier
   * @param event - Delivery event to send
   * @returns Promise that resolves when event is sent
   */
  async sendToClient(clientId: string, event: DeliveryEvent): Promise<void> {
    const client = sseConnectionManager.getClient(clientId);
    
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }
    
    try {
      const sseMessage = this.formatSSEMessage(event);
      const encoder = new TextEncoder();
      const encoded = encoder.encode(sseMessage);
      
      client.controller.enqueue(encoded);
      
      logger.debug('SSE_CLIENT_SENT', 'Sent event to SSE client', {
        clientId,
        eventId: event.id,
        eventType: event.type
      });
    } catch (error) {
      logger.error('SSE_CLIENT_SEND_ERROR', 'Failed to send event to SSE client', error as Error, {
        clientId,
        eventId: event.id
      });
      
      // Remove failed client
      await sseConnectionManager.removeClient(clientId);
      
      throw error;
    }
  }
  
  /**
   * Format a delivery event as an SSE message
   * 
   * SSE format:
   * id: <event-id>
   * event: <event-type>
   * data: <json-data>
   * \n\n
   * 
   * @param event - Delivery event
   * @returns Formatted SSE message string
   */
  private formatSSEMessage(event: DeliveryEvent): string {
    const lines: string[] = [];
    
    // Event ID for client-side deduplication
    if (event.id) {
      lines.push(`id: ${event.id}`);
    }
    
    // Event type
    lines.push(`event: ${event.type}`);
    
    // Event data (JSON) — guard against invalid Date (e.g. new Date(NaN))
    const tsMs = event.timestamp instanceof Date ? event.timestamp.getTime() : NaN;
    const timestampStr = isNaN(tsMs) ? new Date().toISOString() : event.timestamp.toISOString();
    const data = JSON.stringify({
      ...event.data,
      timestamp: timestampStr,
      restaurantId: event.restaurantId,
      driverId: event.driverId
    });
    lines.push(`data: ${data}`);
    
    // SSE messages end with double newline
    return lines.join('\n') + '\n\n';
  }
  
  /**
   * Generate a unique event ID
   * 
   * Format: timestamp-counter-uuid
   * This ensures uniqueness and sortability
   * 
   * @returns Unique event ID
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const counter = ++this.eventCounter;
    const uuid = uuidv4().split('-')[0]; // First segment for brevity
    return `${timestamp}-${counter}-${uuid}`;
  }
  
  /**
   * Start Redis Pub/Sub subscription for multi-instance support
   * 
   * When an event is published to Redis, it's broadcast to all
   * server instances, which then send it to their local clients.
   */
  private async startRedisSubscription(): Promise<void> {
    if (this.subscriptionActive) {
      return;
    }
    
    try {
      await deliveryRedisService.subscribe(
        this.REDIS_CHANNEL,
        async (message: string) => {
          try {
            const event = JSON.parse(message) as DeliveryEvent;
            
            // Convert timestamp string back to Date
            if (typeof event.timestamp === 'string') {
              event.timestamp = new Date(event.timestamp);
            }
            
            // Get local clients for this event
            const clients = sseConnectionManager.getFilteredClients(
              event.restaurantId,
              event.driverId
            );
            
            if (clients.length === 0) {
              return;
            }
            
            // Send to local clients only (don't re-publish to Redis)
            await Promise.allSettled(
              clients.map(client => this.sendToClient(client.id, event))
            );
            
            logger.debug('SSE_REDIS_EVENT_RECEIVED', 'Received event from Redis Pub/Sub', {
              eventId: event.id,
              eventType: event.type,
              localClients: clients.length
            });
          } catch (error) {
            logger.error('SSE_REDIS_MESSAGE_ERROR', 'Error processing Redis Pub/Sub message', error as Error, {
              message
            });
          }
        }
      );
      
      this.subscriptionActive = true;
      
      logger.info('SSE_REDIS_SUBSCRIPTION_STARTED', 'Started Redis Pub/Sub subscription for SSE broadcasting', {
        channel: this.REDIS_CHANNEL
      });
    } catch (error) {
      logger.error('SSE_REDIS_SUBSCRIPTION_ERROR', 'Failed to start Redis Pub/Sub subscription', error as Error);
      // Continue without Redis Pub/Sub (single-instance mode)
    }
  }
  
  /**
   * Stop Redis Pub/Sub subscription
   */
  async shutdown(): Promise<void> {
    if (this.subscriptionActive) {
      try {
        await deliveryRedisService.unsubscribe(this.REDIS_CHANNEL);
        this.subscriptionActive = false;
        logger.info('SSE_REDIS_SUBSCRIPTION_STOPPED', 'Stopped Redis Pub/Sub subscription');
      } catch (error) {
        logger.error('SSE_REDIS_UNSUBSCRIBE_ERROR', 'Error stopping Redis Pub/Sub subscription', error as Error);
      }
    }
  }
  
  /**
   * Get broadcasting statistics
   */
  getStats(): {
    subscriptionActive: boolean;
    eventCounter: number;
    redisChannel: string;
  } {
    return {
      subscriptionActive: this.subscriptionActive,
      eventCounter: this.eventCounter,
      redisChannel: this.REDIS_CHANNEL
    };
  }
}

// Singleton instance
export const sseBroadcaster = new SSEBroadcaster();

/**
 * Helper function to broadcast a delivery event
 * 
 * @param type - Event type
 * @param data - Event data
 * @param restaurantId - Optional restaurant filter
 * @param driverId - Optional driver filter
 */
export async function broadcastDeliveryEvent(
  type: DeliveryEvent['type'],
  data: Record<string, unknown>,
  restaurantId?: TenantId,
  driverId?: DriverId
): Promise<void> {
  const event: DeliveryEvent = {
    id: '', // Will be generated by broadcaster
    type,
    timestamp: new Date(),
    data,
    restaurantId,
    driverId
  };
  
  await sseBroadcaster.broadcast(event);
}
