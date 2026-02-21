/**
 * Platform Order Service
 *
 * Manages orders from external delivery platforms (PedidosYa, LlamaFood, Rappi).
 * Handles incoming webhooks, order acceptance/rejection, commission calculation,
 * and deduplication.
 *
 * @module core/services/platform-order.service
 */

import type { PlatformName, PlatformOrderStatus } from '@/src/core/types/platform';
import { createPlatformAdapter } from '@/src/core/integrations/platforms/adapter-factory';
import { randomUUID } from 'crypto';

type Result<T> = { success: true; data: T } | { success: false; error: { message: string } };

export interface PlatformOrderRecord {
  id: string;
  tenantId: string;
  platform: PlatformName;
  platformOrderId: string;
  orderId: string | null;
  status: PlatformOrderStatus;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  platformTotalCents: number;
  restaurantTotalCents: number;
  commissionCents: number;
  items: Array<{ name: string; quantity: number; unitPriceCents: number; notes?: string }>;
  notes: string | null;
  estimatedPickup: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

// Default commission rates by platform
const DEFAULT_COMMISSION_RATES: Record<string, number> = {
  PEDIDOSYA: 0.27,
  LLAMAFOOD: 0.22,
  RAPPI: 0.30,
};

function mapRecord(row: any): PlatformOrderRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    platform: row.platform,
    platformOrderId: row.platform_order_id,
    orderId: row.order_id,
    status: row.status,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    platformTotalCents: row.platform_total_cents,
    restaurantTotalCents: row.restaurant_total_cents,
    commissionCents: row.commission_cents,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    notes: row.notes,
    estimatedPickup: row.estimated_pickup ? new Date(row.estimated_pickup).toISOString() : null,
    acceptedAt: row.accepted_at ? new Date(row.accepted_at).toISOString() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class PlatformOrderService {
  constructor(private prisma: any) {}

  /**
   * Handle an incoming order from an external platform webhook.
   * Validates, parses, deduplicates, calculates commission, and stores.
   */
  async handleIncomingOrder(
    tenantId: string,
    platform: PlatformName,
    rawPayload: unknown,
    webhookSignature?: string,
  ): Promise<Result<PlatformOrderRecord>> {
    try {
      const adapter = createPlatformAdapter(platform);

      // Get platform config
      const config = await this.prisma.platform_configs.findFirst({
        where: { tenant_id: tenantId, platform, is_active: true },
      });

      if (!config) {
        return { success: false, error: { message: `Platform ${platform} not configured or inactive` } };
      }

      // Validate webhook signature if provided
      if (webhookSignature && config.webhook_secret) {
        const rawBody = typeof rawPayload === 'string' ? rawPayload : JSON.stringify(rawPayload);
        const validation = adapter.validateWebhook(rawBody, webhookSignature, config.webhook_secret);
        if (!validation.valid) {
          return { success: false, error: { message: 'Invalid webhook signature' } };
        }
      }

      // Parse order
      const parsed = adapter.parseOrder(rawPayload);

      // Dedup check
      const existing = await this.prisma.platform_orders.findFirst({
        where: {
          tenant_id: tenantId,
          platform,
          platform_order_id: parsed.platformOrderId,
        },
      });

      if (existing) {
        return { success: true, data: mapRecord(existing) };
      }

      // Calculate commission
      const commissionRate = Number(config.commission_rate) || DEFAULT_COMMISSION_RATES[platform] || 0.25;
      const commissionCents = Math.round(parsed.platformTotalCents * commissionRate);
      const restaurantTotalCents = parsed.platformTotalCents - commissionCents;

      // Store
      const id = randomUUID();
      const record = await this.prisma.platform_orders.create({
        data: {
          id,
          tenant_id: tenantId,
          platform,
          platform_order_id: parsed.platformOrderId,
          status: 'RECEIVED',
          raw_payload: rawPayload,
          customer_name: parsed.customerName,
          customer_phone: parsed.customerPhone,
          delivery_address: parsed.deliveryAddress,
          platform_total_cents: parsed.platformTotalCents,
          restaurant_total_cents: restaurantTotalCents,
          commission_cents: commissionCents,
          items: parsed.items,
          notes: parsed.notes,
          estimated_pickup: parsed.estimatedPickup ? new Date(parsed.estimatedPickup) : null,
        },
      });

      const result = mapRecord(record);

      // Auto-accept if configured
      if (config.auto_accept) {
        return this.acceptOrder(tenantId, id);
      }

      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: { message: error.message || 'Error processing platform order' } };
    }
  }

  /**
   * Accept a platform order. Creates an internal order and notifies the platform.
   */
  async acceptOrder(tenantId: string, platformOrderId: string): Promise<Result<PlatformOrderRecord>> {
    const record = await this.prisma.platform_orders.findFirst({
      where: { id: platformOrderId, tenant_id: tenantId },
    });

    if (!record) {
      return { success: false, error: { message: 'Platform order not found' } };
    }

    if (record.status !== 'RECEIVED') {
      return { success: false, error: { message: `Cannot accept order with status ${record.status}` } };
    }

    const now = new Date();
    const orderId = randomUUID();

    const updated = await this.prisma.platform_orders.update({
      where: { id: platformOrderId },
      data: {
        status: 'ACCEPTED',
        order_id: orderId,
        accepted_at: now,
      },
    });

    // Notify platform (best-effort)
    try {
      const config = await this.prisma.platform_configs.findFirst({
        where: { tenant_id: tenantId, platform: record.platform, is_active: true },
      });
      if (config?.api_key && config?.store_id) {
        const adapter = createPlatformAdapter(record.platform);
        await adapter.acceptOrder(
          { apiKey: config.api_key, storeId: config.store_id },
          record.platform_order_id,
        );
      }
    } catch {
      // Best-effort notification
    }

    return { success: true, data: mapRecord(updated) };
  }

  /**
   * Reject a platform order with a reason.
   */
  async rejectOrder(
    tenantId: string,
    platformOrderId: string,
    reason: string,
  ): Promise<Result<PlatformOrderRecord>> {
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: { message: 'Rejection reason is required' } };
    }

    const record = await this.prisma.platform_orders.findFirst({
      where: { id: platformOrderId, tenant_id: tenantId },
    });

    if (!record) {
      return { success: false, error: { message: 'Platform order not found' } };
    }

    if (record.status !== 'RECEIVED') {
      return { success: false, error: { message: `Cannot reject order with status ${record.status}` } };
    }

    const now = new Date();

    const updated = await this.prisma.platform_orders.update({
      where: { id: platformOrderId },
      data: {
        status: 'REJECTED',
        rejected_at: now,
        rejection_reason: reason,
      },
    });

    // Notify platform (best-effort)
    try {
      const config = await this.prisma.platform_configs.findFirst({
        where: { tenant_id: tenantId, platform: record.platform, is_active: true },
      });
      if (config?.api_key && config?.store_id) {
        const adapter = createPlatformAdapter(record.platform);
        await adapter.rejectOrder(
          { apiKey: config.api_key, storeId: config.store_id },
          record.platform_order_id,
          reason,
        );
      }
    } catch {
      // Best-effort notification
    }

    return { success: true, data: mapRecord(updated) };
  }

  /**
   * Get platform orders with optional filters.
   */
  async getOrders(
    tenantId: string,
    filters?: { platform?: PlatformName; status?: PlatformOrderStatus; limit?: number },
  ): Promise<Result<PlatformOrderRecord[]>> {
    const where: any = { tenant_id: tenantId };
    if (filters?.platform) where.platform = filters.platform;
    if (filters?.status) where.status = filters.status;

    const records = await this.prisma.platform_orders.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: filters?.limit || 50,
    });

    return { success: true, data: records.map(mapRecord) };
  }

  /**
   * Get a single platform order by id.
   */
  async getOrder(tenantId: string, id: string): Promise<Result<PlatformOrderRecord>> {
    const record = await this.prisma.platform_orders.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!record) {
      return { success: false, error: { message: 'Platform order not found' } };
    }

    return { success: true, data: mapRecord(record) };
  }

  /**
   * Get or update platform config.
   */
  async getConfig(tenantId: string, platform?: PlatformName): Promise<Result<any[]>> {
    const where: any = { tenant_id: tenantId };
    if (platform) where.platform = platform;

    const configs = await this.prisma.platform_configs.findMany({ where });

    return {
      success: true,
      data: configs.map((c: any) => ({
        id: c.id,
        tenantId: c.tenant_id,
        platform: c.platform,
        isActive: c.is_active,
        apiKey: c.api_key ? '***' : null,
        storeId: c.store_id,
        commissionRate: Number(c.commission_rate),
        markupRate: Number(c.markup_rate),
        autoAccept: c.auto_accept,
        createdAt: new Date(c.created_at).toISOString(),
        updatedAt: new Date(c.updated_at).toISOString(),
      })),
    };
  }

  /**
   * Update platform config.
   */
  async updateConfig(
    tenantId: string,
    platform: PlatformName,
    updates: {
      isActive?: boolean;
      apiKey?: string;
      storeId?: string;
      webhookSecret?: string;
      commissionRate?: number;
      markupRate?: number;
      autoAccept?: boolean;
    },
  ): Promise<Result<any>> {
    const existing = await this.prisma.platform_configs.findFirst({
      where: { tenant_id: tenantId, platform },
    });

    const data: any = { updated_at: new Date() };
    if (updates.isActive !== undefined) data.is_active = updates.isActive;
    if (updates.apiKey !== undefined) data.api_key = updates.apiKey;
    if (updates.storeId !== undefined) data.store_id = updates.storeId;
    if (updates.webhookSecret !== undefined) data.webhook_secret = updates.webhookSecret;
    if (updates.commissionRate !== undefined) data.commission_rate = updates.commissionRate;
    if (updates.markupRate !== undefined) data.markup_rate = updates.markupRate;
    if (updates.autoAccept !== undefined) data.auto_accept = updates.autoAccept;

    if (existing) {
      const updated = await this.prisma.platform_configs.update({
        where: { id: existing.id },
        data,
      });

      return {
        success: true,
        data: {
          id: updated.id,
          platform: updated.platform,
          isActive: updated.is_active,
          commissionRate: Number(updated.commission_rate),
          autoAccept: updated.auto_accept,
        },
      };
    }

    // Create new config
    const id = randomUUID();
    const created = await this.prisma.platform_configs.create({
      data: {
        id,
        tenant_id: tenantId,
        platform,
        commission_rate: updates.commissionRate || DEFAULT_COMMISSION_RATES[platform] || 0.25,
        markup_rate: updates.markupRate || 0.20,
        auto_accept: updates.autoAccept || false,
        is_active: updates.isActive ?? true,
        api_key: updates.apiKey || null,
        store_id: updates.storeId || null,
        webhook_secret: updates.webhookSecret || null,
        ...data,
      },
    });

    return {
      success: true,
      data: {
        id: created.id,
        platform: created.platform,
        isActive: created.is_active,
        commissionRate: Number(created.commission_rate),
        autoAccept: created.auto_accept,
      },
    };
  }
}
