/**
 * Platform Types
 *
 * Types for external delivery platform integrations
 * (PedidosYa, LlamaFood, Rappi).
 *
 * @module core/types/platform
 */

export type PlatformName = 'PEDIDOSYA' | 'LLAMAFOOD' | 'RAPPI';

export type PlatformOrderStatus =
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PREPARING'
  | 'READY'
  | 'DISPATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface PlatformConfig {
  id: string;
  tenantId: string;
  platform: PlatformName;
  isActive: boolean;
  apiKey: string | null;
  storeId: string | null;
  webhookSecret: string | null;
  commissionRate: number;
  markupRate: number;
  autoAccept: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOrder {
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
  items: PlatformOrderItem[];
  notes: string | null;
  estimatedPickup: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface PlatformOrderItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  notes?: string;
}

export interface ParsedPlatformOrder {
  platformOrderId: string;
  customerName: string | null;
  customerPhone: string | null;
  deliveryAddress: string | null;
  items: PlatformOrderItem[];
  platformTotalCents: number;
  estimatedPickup: string | null;
  notes: string | null;
}
