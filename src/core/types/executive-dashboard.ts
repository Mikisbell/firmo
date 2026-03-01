import type { Centavos } from './shared';
import type { COGS, Profit, Margin } from './profitability';

// --- Period selector ---

export type PeriodPreset = 'today' | 'week' | 'month' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

// --- Data source status (partial failure support) ---

export type DataSourceState = 'ok' | 'error' | 'timeout';

export interface DataSourceStatus {
  dailyKpis: DataSourceState;
  pnl: DataSourceState;
  profitability: DataSourceState;
}

// --- KPI cards ---

export interface KPICard {
  label: string;
  valueCents: number;
  isPercentage?: boolean;  // true for margin fields
  delta: number | null;    // % change vs prior period, null if unavailable
}

// --- Top product ---

export interface TopProfitableProduct {
  productId: string;
  productName: string;
  category: string;
  priceCents: Centavos;
  cogsCents: COGS;
  profitCents: Profit;
  marginPercent: Margin;
  unitsSold: number;
  totalProfitCents: Profit;
}

// --- Payment breakdown ---

export interface PaymentMethodSummary {
  method: string;
  count: number;
  totalCents: number;
}

// --- Alerts ---

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface OperationalAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: string;
}

// --- Main response ---

export interface ExecutiveDashboardData {
  period: PeriodRange;

  // Hero KPIs
  netSalesCents: number;
  grossProfitCents: number;
  grossMarginPercent: number;
  operatingExpensesCents: number;
  netIncomeCents: number;
  netMarginPercent: number;
  ordersCount: number;
  avgTicketCents: number;

  // Deltas vs prior period (null = unavailable)
  comparison: {
    netSalesDelta: number | null;
    grossProfitDelta: number | null;
    netIncomeDelta: number | null;
    ordersCountDelta: number | null;
  } | null;

  // Charts
  hourlySales: number[];                 // 24 buckets, cents per hour (today only for multi-day)
  paymentBreakdown: PaymentMethodSummary[];
  topProducts: TopProfitableProduct[];   // top 5 by totalProfitCents

  // Operational
  alerts: OperationalAlert[];

  // Metadata
  sources: DataSourceStatus;
  generatedAt: string;                   // ISO timestamp
}
