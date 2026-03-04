/**
 * Analytics Types
 * Tipos para el servicio de analytics en tiempo real
 */

import type { PaymentMethod, Centavos } from '@/src/core/types/shared';

// Re-export for convenience (single source of truth is shared.ts)
export type { PaymentMethod, Centavos };

export interface StationMetrics {
  station: string;  // COCINA, HORNO, BAR, PARRILLA
  avg_prep_time_minutes: number;
  pending_items: number;
  oldest_item_minutes: number | null;
  has_alert: boolean;  // > 10 items pendientes
  efficiency: number;  // 0-100%, orders completed within estimated_time
  load: number;        // 0-100%, current capacity utilization
}

export interface RealtimeMetrics {
  // Ventas
  total_sales_cents: Centavos;
  orders_count: number;
  avg_ticket_cents: Centavos;
  sales_by_payment_method: Record<PaymentMethod, Centavos>;
  
  // Mesas
  tables_occupied: number;
  tables_free: number;
  table_turnover: number;
  
  // Tiempos
  avg_service_time_minutes: number;
  orders_per_hour: number;
  
  // Estaciones KDS
  stations: StationMetrics[];
  
  // Metadata
  shift_id: string | null;
  business_date: string;
  last_updated: string;
}

export interface ComparisonMetrics {
  current: RealtimeMetrics;
  previous: RealtimeMetrics;
  delta_percent: {
    total_sales: number;
    orders_count: number;
    avg_ticket: number;
  };
}

export interface TopProduct {
  product_id: string;
  sku: string;
  name: string;
  qty_sold: number;
  revenue_cents: Centavos;
}

export interface HourlySales {
  hour: number;  // 0-23
  sales_cents: Centavos;
  orders_count: number;
}

export interface DateRangeFilter {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
}

// Error codes
export enum AnalyticsErrorCode {
  SHIFT_NOT_FOUND = 'ANALYTICS_001',
  INVALID_DATE_RANGE = 'ANALYTICS_002',
  CACHE_STALE = 'ANALYTICS_003',
  CALCULATION_ERROR = 'ANALYTICS_004',
}
