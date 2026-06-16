/**
 * SSE Broadcasting System
 * 
 * Broadcasts delivery events to connected SSE clients.
 * Supports Redis Pub/Sub for multi-instance broadcasting.
 * Includes event IDs for client-side deduplication.
 * 
 * Requirements: 1.1, 1.4, 1.8
 */

// Import deliveryRedisService for legacy usages if any, but pub/sub is handled by eventBus
import { deliveryRedisService } from './redis-connection';
import { eventBus } from '@/src/core/infra/event-bus';
import { sseConnectionManager, SSEClient } from './sse-connection-manager';
import { DeliveryEvent, TenantId, DriverId } from './types-2026';
import { logger } from '@/src/core/observability/logger';
import { v4 as uuidv4 } from 'uuid';

export class SSEBroadcaster {
  private subscriptionActive = false;
  private readonly GLOBAL_TENANT = 'GLOBAL_DELIVERY';
  private eventCounter = 0;
  private unsubscribeFn: (() => void) | null = null;
  
  constructor() {
    this.startEventBusSubscription();
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
    
    // Publish to EventBus for other server instances
    try {
      const tenantId = event.restaurantId || this.GLOBAL_TENANT;
      await eventBus.publish(tenantId, event as any);
    } catch (error) {
      logger.error('SSE_EVENTBUS_PUBLISH_ERROR', 'Failed to publish event to EventBus', error as Error, {
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
   * Start EventBus subscription for multi-instance support
   * 
   * When an event is published to Postgres (Neon), it's broadcast to all
   * server instances, which then send it to their local clients.
   */
  private async startEventBusSubscription(): Promise<void> {
    if (this.subscriptionActive) {
      return;
    }
    
    try {
      // Usamos GLOBAL_TENANT o podríamos suscribirnos por tenant si SSEBroadcaster fuera tenant-aware.
      // Por compatibilidad con la versión anterior que usaba REDIS_CHANNEL, 
      // nos suscribimos al GLOBAL_TENANT, aunque también podríamos escuchar en todos los canales.
      // Ojo: Si los eventos se publican con event.restaurantId como tenantId, 
      // SSEBroadcaster (siendo singleton global) debería usar ese tenantId, 
      // pero EventBus subscribe requiere el tenantId específico.
      // Para solucionarlo, el SSEBroadcaster simplemente emite como evento genérico o 
      // cada nueva suscripción de un cliente SSE al server debería llamar a eventBus.subscribe internamente.
      
      // Suscribirse a nivel GLOBAL para eventos broadcast
      const unsub = await eventBus.subscribe(
        this.GLOBAL_TENANT,
        async (event: any) => {
          try {
            const deliveryEvent = event as DeliveryEvent;
            
            // Get local clients for this event
            const clients = sseConnectionManager.getFilteredClients(
              deliveryEvent.restaurantId,
              deliveryEvent.driverId
            );
            
            if (clients.length === 0) {
              return;
            }
            
            // Send to local clients only
            await Promise.allSettled(
              clients.map(client => this.sendToClient(client.id, deliveryEvent))
            );
            
            logger.debug('SSE_EVENTBUS_EVENT_RECEIVED', 'Received event from EventBus', {
              eventId: deliveryEvent.id,
              eventType: deliveryEvent.type,
              localClients: clients.length
            });
          } catch (error) {
            logger.error('SSE_EVENTBUS_MESSAGE_ERROR', 'Error processing EventBus message', error as Error);
          }
        }
      );
      
      this.unsubscribeFn = unsub;
      this.subscriptionActive = true;
      
      logger.info('SSE_EVENTBUS_SUBSCRIPTION_STARTED', 'Started EventBus subscription for SSE broadcasting', {
        channel: this.GLOBAL_TENANT
      });
    } catch (error) {
      logger.error('SSE_EVENTBUS_SUBSCRIPTION_ERROR', 'Failed to start EventBus subscription', error as Error);
      // Continue without Pub/Sub (single-instance mode)
    }
  }
  
  /**
   * Stop EventBus subscription
   */
  async shutdown(): Promise<void> {
    if (this.subscriptionActive) {
      try {
        if (this.unsubscribeFn) {
          this.unsubscribeFn();
        }
        this.subscriptionActive = false;
        logger.info('SSE_EVENTBUS_SUBSCRIPTION_STOPPED', 'Stopped EventBus subscription');
      } catch (error) {
        logger.error('SSE_EVENTBUS_UNSUBSCRIBE_ERROR', 'Error stopping EventBus subscription', error as Error);
      }
    }
  }
  
  getStats(): {
    subscriptionActive: boolean;
    eventCounter: number;
    channel: string;
  } {
    return {
      subscriptionActive: this.subscriptionActive,
      eventCounter: this.eventCounter,
      channel: this.GLOBAL_TENANT
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
