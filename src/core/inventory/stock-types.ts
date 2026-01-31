/**
 * Stock Types and Utilities
 * Shared types for inventory stock management
 */

import type { Centavos } from '@/src/core/types/shared';

export type StockStatus = 'OK' | 'LOW' | 'CRITICAL';

// Tipo de urgencia de vencimiento
export type ExpiryUrgency = 'EXPIRED' | 'TODAY' | 'TOMORROW' | 'SOON_3D' | 'SOON_7D' | 'OK';

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  costCents: Centavos;
  status: StockStatus;
  expiringLots: number;
  locationId: string | null;
  expiryDate: string | null;
  lotNumber: string | null;
  // FEFO fields (Task 11)
  expiryUrgency: ExpiryUrgency;
  daysUntilExpiry: number | null;
}

export interface StockSummary {
  lowStockCount: number;
  expiringCount: number;
  totalValueCents: Centavos;
}

export interface StockResponse {
  items: InventoryItem[];
  summary: StockSummary;
}

/**
 * Calcula el status del stock basado en stock actual vs minStock
 * - CRITICAL: stock < minStock
 * - LOW: minStock <= stock < 1.5 * minStock
 * - OK: stock >= 1.5 * minStock
 */
export function calculateStatus(stock: number, minStock: number): StockStatus {
  if (minStock <= 0) return 'OK';
  if (stock < minStock) return 'CRITICAL';
  if (stock < minStock * 1.5) return 'LOW';
  return 'OK';
}

/**
 * Calcula la urgencia de vencimiento basado en fecha de expiración
 * - EXPIRED: ya venció
 * - TODAY: vence hoy
 * - TOMORROW: vence mañana
 * - SOON_3D: vence en 2-3 días
 * - SOON_7D: vence en 4-7 días
 * - OK: vence en más de 7 días o no tiene fecha
 */
export function calculateExpiryUrgency(expiryDate: Date | null): { urgency: ExpiryUrgency; daysUntilExpiry: number | null } {
  if (!expiryDate) {
    return { urgency: 'OK', daysUntilExpiry: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { urgency: 'EXPIRED', daysUntilExpiry: diffDays };
  }
  if (diffDays === 0) {
    return { urgency: 'TODAY', daysUntilExpiry: 0 };
  }
  if (diffDays === 1) {
    return { urgency: 'TOMORROW', daysUntilExpiry: 1 };
  }
  if (diffDays <= 3) {
    return { urgency: 'SOON_3D', daysUntilExpiry: diffDays };
  }
  if (diffDays <= 7) {
    return { urgency: 'SOON_7D', daysUntilExpiry: diffDays };
  }
  
  return { urgency: 'OK', daysUntilExpiry: diffDays };
}
