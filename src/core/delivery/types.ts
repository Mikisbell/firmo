/**
 * Delivery Module Types
 * Tipos para el módulo de delivery con flota propia
 */

import type { Centavos } from '@/src/core/types/shared';

export type DeliveryStatus = 
  | 'PENDING'    // Esperando asignación de motorizado
  | 'ASSIGNED'   // Motorizado asignado, esperando despacho
  | 'DISPATCHED' // En camino al cliente
  | 'DELIVERED'  // Entregado exitosamente
  | 'FAILED'     // No se pudo entregar
  | 'CANCELLED'; // Cancelado antes de despacho

export type DriverStatus = 'available' | 'on_delivery' | 'inactive';

export interface DeliveryOrder {
  id: string;
  tenant_id: string;
  order_id: string;
  driver_id: string | null;
  address_id: string | null;
  address_text: string;
  address_reference: string | null;
  customer_phone: string;
  delivery_fee: Centavos;
  estimated_delivery_at: Date | null;
  assigned_at: Date | null;
  dispatched_at: Date | null;
  delivered_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;
  delivery_time_mins: number | null;
  signature_url: string | null;
  status: DeliveryStatus;
  tracking_code: string | null;
  created_at: Date;
}

export interface Driver {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  is_active: boolean;
}

export interface DriverWithStatus extends Driver {
  status: DriverStatus;
  currentDelivery: DeliveryOrder | null;
}

export interface CreateDeliveryInput {
  tenantId: string;
  orderId: string;
  addressText: string;
  addressReference?: string;
  customerPhone: string;
  deliveryFee: Centavos;
  estimatedDeliveryAt?: Date;
  addressId?: string;
}

export interface ZoneFeeResult {
  zoneId: string | null;
  zoneName: string | null;
  fee: Centavos;
  estimatedMins: number;
  isOutsideZones: boolean;
}

// Valid status transitions
export const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['DISPATCHED', 'FAILED', 'CANCELLED'],
  DISPATCHED: ['DELIVERED', 'FAILED'],
  DELIVERED: [], // Terminal state
  FAILED: [],    // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
