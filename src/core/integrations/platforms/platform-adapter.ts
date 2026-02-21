/**
 * Platform Adapter Interface
 *
 * Abstract interface for external delivery platform integrations.
 * Each platform (PedidosYa, LlamaFood, Rappi) implements this interface.
 *
 * @module core/integrations/platforms/platform-adapter
 */

import type { PlatformName, ParsedPlatformOrder } from '@/src/core/types/platform';

export interface WebhookValidationResult {
  valid: boolean;
  eventType?: string;
}

export interface PlatformAdapter {
  readonly platform: PlatformName;

  /** Validate incoming webhook signature (HMAC-SHA256) */
  validateWebhook(payload: string, signature: string, secret: string): WebhookValidationResult;

  /** Parse raw webhook payload into a normalized order */
  parseOrder(rawPayload: unknown): ParsedPlatformOrder;

  /** Notify platform that order was accepted */
  acceptOrder(config: { apiKey: string; storeId: string }, platformOrderId: string): Promise<boolean>;

  /** Notify platform that order was rejected */
  rejectOrder(config: { apiKey: string; storeId: string }, platformOrderId: string, reason: string): Promise<boolean>;

  /** Update order status on the platform */
  updateOrderStatus(config: { apiKey: string; storeId: string }, platformOrderId: string, status: string): Promise<boolean>;
}
