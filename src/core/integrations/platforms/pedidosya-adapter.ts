/**
 * PedidosYa Adapter
 *
 * Implements the PlatformAdapter interface for PedidosYa integration.
 * Commission rate: 25-30%.
 *
 * @module core/integrations/platforms/pedidosya-adapter
 */

import { createHmac } from 'crypto';
import type { PlatformName, ParsedPlatformOrder } from '@/src/core/types/platform';
import type { PlatformAdapter, WebhookValidationResult } from './platform-adapter';

interface PedidosYaItem {
  name: string;
  quantity: number;
  unitPrice: number; // in currency units (soles)
  comments?: string;
}

interface PedidosYaPayload {
  id: string;
  code?: string;
  customer?: {
    name?: string;
    phone?: string;
  };
  address?: {
    description?: string;
  };
  details?: PedidosYaItem[];
  totalAmount?: number;
  estimatedPickupTime?: string;
  comments?: string;
}

export class PedidosYaAdapter implements PlatformAdapter {
  readonly platform: PlatformName = 'PEDIDOSYA';

  validateWebhook(payload: string, signature: string, secret: string): WebhookValidationResult {
    if (!payload || !signature || !secret) {
      return { valid: false };
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const valid = expectedSignature === signature;
    return {
      valid,
      eventType: valid ? 'NEW_ORDER' : undefined,
    };
  }

  parseOrder(rawPayload: unknown): ParsedPlatformOrder {
    const data = rawPayload as PedidosYaPayload;

    if (!data || !data.id) {
      throw new Error('Invalid PedidosYa payload: missing id');
    }

    const items = (data.details || []).map((item) => ({
      name: item.name || 'Unknown',
      quantity: item.quantity || 1,
      unitPriceCents: Math.round((item.unitPrice || 0) * 100),
      notes: item.comments || undefined,
    }));

    const platformTotalCents = data.totalAmount
      ? Math.round(data.totalAmount * 100)
      : items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

    return {
      platformOrderId: data.id,
      customerName: data.customer?.name ?? null,
      customerPhone: data.customer?.phone ?? null,
      deliveryAddress: data.address?.description ?? null,
      items,
      platformTotalCents,
      estimatedPickup: data.estimatedPickupTime ?? null,
      notes: data.comments ?? null,
    };
  }

  async acceptOrder(
    config: { apiKey: string; storeId: string },
    platformOrderId: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.pedidosya.com/v3/stores/${config.storeId}/orders/${platformOrderId}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async rejectOrder(
    config: { apiKey: string; storeId: string },
    platformOrderId: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.pedidosya.com/v3/stores/${config.storeId}/orders/${platformOrderId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async updateOrderStatus(
    config: { apiKey: string; storeId: string },
    platformOrderId: string,
    status: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.pedidosya.com/v3/stores/${config.storeId}/orders/${platformOrderId}/status`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
