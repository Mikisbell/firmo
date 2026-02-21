/**
 * LlamaFood Adapter
 *
 * Implements the PlatformAdapter interface for LlamaFood integration.
 * Commission rate: 20-25%.
 *
 * @module core/integrations/platforms/llamafood-adapter
 */

import { createHmac } from 'crypto';
import type { PlatformName, ParsedPlatformOrder } from '@/src/core/types/platform';
import type { PlatformAdapter, WebhookValidationResult } from './platform-adapter';

interface LlamaFoodItem {
  producto: string;
  cantidad: number;
  precio_unitario: number; // in centavos
  observaciones?: string;
}

interface LlamaFoodPayload {
  pedido_id: string;
  cliente?: {
    nombre?: string;
    telefono?: string;
  };
  direccion?: string;
  productos?: LlamaFoodItem[];
  total_centavos?: number;
  hora_recojo_estimada?: string;
  notas?: string;
  tipo_evento?: string;
}

export class LlamaFoodAdapter implements PlatformAdapter {
  readonly platform: PlatformName = 'LLAMAFOOD';

  validateWebhook(payload: string, signature: string, secret: string): WebhookValidationResult {
    if (!payload || !signature || !secret) {
      return { valid: false };
    }

    const expectedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    // LlamaFood uses "sha256=" prefix
    const normalizedSig = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    const valid = expectedSignature === normalizedSig;

    let eventType: string | undefined;
    if (valid) {
      try {
        const parsed = JSON.parse(payload);
        eventType = parsed.tipo_evento || 'NUEVO_PEDIDO';
      } catch {
        eventType = 'NUEVO_PEDIDO';
      }
    }

    return { valid, eventType };
  }

  parseOrder(rawPayload: unknown): ParsedPlatformOrder {
    const data = rawPayload as LlamaFoodPayload;

    if (!data || !data.pedido_id) {
      throw new Error('Invalid LlamaFood payload: missing pedido_id');
    }

    const items = (data.productos || []).map((item) => ({
      name: item.producto || 'Desconocido',
      quantity: item.cantidad || 1,
      unitPriceCents: item.precio_unitario || 0,
      notes: item.observaciones || undefined,
    }));

    const platformTotalCents = data.total_centavos
      ?? items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

    return {
      platformOrderId: data.pedido_id,
      customerName: data.cliente?.nombre ?? null,
      customerPhone: data.cliente?.telefono ?? null,
      deliveryAddress: data.direccion ?? null,
      items,
      platformTotalCents,
      estimatedPickup: data.hora_recojo_estimada ?? null,
      notes: data.notas ?? null,
    };
  }

  async acceptOrder(
    config: { apiKey: string; storeId: string },
    platformOrderId: string,
  ): Promise<boolean> {
    try {
      const res = await fetch(
        `https://api.llamafood.pe/v1/tiendas/${config.storeId}/pedidos/${platformOrderId}/aceptar`,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': config.apiKey,
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
        `https://api.llamafood.pe/v1/tiendas/${config.storeId}/pedidos/${platformOrderId}/rechazar`,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ motivo: reason }),
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
        `https://api.llamafood.pe/v1/tiendas/${config.storeId}/pedidos/${platformOrderId}/estado`,
        {
          method: 'PUT',
          headers: {
            'X-Api-Key': config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ estado: status }),
        },
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
