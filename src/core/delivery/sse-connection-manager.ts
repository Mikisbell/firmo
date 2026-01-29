/**
 * SSE Connection Manager
 * 
 * Manages Server-Sent Events connections for real-time delivery updates.
 * Handles connection lifecycle, heartbeat, and cleanup.
 * 
 * Requirements: 1.2, 1.5, 1.7
 */

import { deliveryRedisService } from './redis-connection';
import { logger } from '@/src/core/observability/logger';

export interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  restaurantId?: string;
  driverId?: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export class SSEConnectionManager {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL_MS = 60000; // 1 minute
  private readonly CLIENT_TIMEOUT_MS = 120000; // 2 minutes
  private readonly REDIS_TTL_SECONDS = 300; // 5 minutes
  
  constructor() {
    this.startHeartbeat();
    this.startCleanup();
  }
  
  /**
   * Add a new SSE client connection
   * 
   * @param clientId - Unique client identifier
   * @param controller - ReadableStream controller for sending events
   * @param restaurantId - Optional restaurant filter
   * @param driverId - Optional driver filter
   */
  async addClient(
    clientId: string,
    controller: ReadableStreamDefaultController,
    restaurantId?: string,
    driverId?: string
  ): Promise<void> {
    const now = new Date();
    
    const client: SSEClient = {
      id: clientId,
      controller,
      restaurantId,
      driverId,
      connectedAt: now,
      lastHeartbeat: now
    };
    
    this.clients.set(clientId, client);
    
    // Store in Redis for multi-instance support
    const redisKey = this.getRedisKey(restaurantId);
    await deliveryRedisService.sadd(redisKey, clientId);
    await deliveryRedisService.expire(redisKey, this.REDIS_TTL_SECONDS);
    
    logger.info({
      clientId,
      restaurantId,
      driverId,
      totalClients: this.clients.size
    }, 'SSE client connected');
  }
  
  /**
   * Remove an SSE client connection
   * 
   * @param clientId - Client identifier to remove
   */
  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Close the stream
    try {
      client.controller.close();
    } catch (error) {
      // Stream may already be closed
      logger.debug({ clientId, error }, 'Error closing SSE stream');
    }
    
    // Remove from memory
    this.clients.delete(clientId);
    
    // Remove from Redis
    const redisKey = this.getRedisKey(client.restaurantId);
    await deliveryRedisService.srem(redisKey, clientId);
    
    logger.info({
      clientId,
      restaurantId: client.restaurantId,
      driverId: client.driverId,
      connectionDuration: Date.now() - client.connectedAt.getTime(),
      totalClients: this.clients.size
    }, 'SSE client disconnected');
  }
  
  /**
   * Get all active client IDs
   * 
   * @returns Array of active client IDs
   */
  getActiveClients(): string[] {
    return Array.from(this.clients.keys());
  }
  
  /**
   * Get a specific client by ID
   * 
   * @param clientId - Client identifier
   * @returns SSEClient or undefined
   */
  getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }
  
  /**
   * Get clients filtered by restaurant or driver
   * 
   * @param restaurantId - Optional restaurant filter
   * @param driverId - Optional driver filter
   * @returns Array of matching clients
   */
  getFilteredClients(restaurantId?: string, driverId?: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(client => {
      if (restaurantId && client.restaurantId !== restaurantId) {
        return false;
      }
      if (driverId && client.driverId !== driverId) {
        return false;
      }
      return true;
    });
  }
  
  /**
   * Send heartbeat to all connected clients
   * Removes clients that fail to receive heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    const now = new Date();
    const failedClients: string[] = [];
    
    for (const [clientId, client] of this.clients.entries()) {
      try {
        const encoder = new TextEncoder();
        const heartbeat = encoder.encode(': heartbeat\n\n');
        client.controller.enqueue(heartbeat);
        client.lastHeartbeat = now;
      } catch (error) {
        logger.warn({ clientId, error }, 'Failed to send heartbeat');
        failedClients.push(clientId);
      }
    }
    
    // Remove failed clients
    for (const clientId of failedClients) {
      await this.removeClient(clientId);
    }
    
    if (failedClients.length > 0) {
      logger.info({
        removedClients: failedClients.length,
        remainingClients: this.clients.size
      }, 'Removed failed clients after heartbeat');
    }
  }
  
  /**
   * Clean up stale connections
   * Removes clients that haven't received heartbeat in CLIENT_TIMEOUT_MS
   */
  private async cleanupStaleConnections(): Promise<void> {
    const now = Date.now();
    const staleClients: string[] = [];
    
    for (const [clientId, client] of this.clients.entries()) {
      const timeSinceHeartbeat = now - client.lastHeartbeat.getTime();
      if (timeSinceHeartbeat > this.CLIENT_TIMEOUT_MS) {
        staleClients.push(clientId);
      }
    }
    
    // Remove stale clients
    for (const clientId of staleClients) {
      await this.removeClient(clientId);
    }
    
    if (staleClients.length > 0) {
      logger.info({
        removedClients: staleClients.length,
        remainingClients: this.clients.size
      }, 'Cleaned up stale SSE connections');
    }
  }
  
  /**
   * Start heartbeat interval
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }
    
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        logger.error({ error }, 'Error in heartbeat interval');
      });
    }, this.HEARTBEAT_INTERVAL_MS);
    
    logger.info({
      intervalMs: this.HEARTBEAT_INTERVAL_MS
    }, 'Started SSE heartbeat interval');
  }
  
  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections().catch(error => {
        logger.error({ error }, 'Error in cleanup interval');
      });
    }, this.CLEANUP_INTERVAL_MS);
    
    logger.info({
      intervalMs: this.CLEANUP_INTERVAL_MS
    }, 'Started SSE cleanup interval');
  }
  
  /**
   * Stop all intervals (for testing or shutdown)
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Close all connections
    const clientIds = Array.from(this.clients.keys());
    for (const clientId of clientIds) {
      await this.removeClient(clientId);
    }
    
    logger.info('SSE connection manager shut down');
  }
  
  /**
   * Get Redis key for storing client IDs
   */
  private getRedisKey(restaurantId?: string): string {
    if (restaurantId) {
      return `sse:clients:${restaurantId}`;
    }
    return 'sse:clients:all';
  }
  
  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    clientsByRestaurant: Record<string, number>;
    clientsByDriver: Record<string, number>;
    averageConnectionDuration: number;
  } {
    const now = Date.now();
    const clientsByRestaurant: Record<string, number> = {};
    const clientsByDriver: Record<string, number> = {};
    let totalDuration = 0;
    
    for (const client of this.clients.values()) {
      if (client.restaurantId) {
        clientsByRestaurant[client.restaurantId] = 
          (clientsByRestaurant[client.restaurantId] || 0) + 1;
      }
      if (client.driverId) {
        clientsByDriver[client.driverId] = 
          (clientsByDriver[client.driverId] || 0) + 1;
      }
      totalDuration += now - client.connectedAt.getTime();
    }
    
    return {
      totalClients: this.clients.size,
      clientsByRestaurant,
      clientsByDriver,
      averageConnectionDuration: this.clients.size > 0 
        ? totalDuration / this.clients.size 
        : 0
    };
  }
}

// Singleton instance
export const sseConnectionManager = new SSEConnectionManager();
