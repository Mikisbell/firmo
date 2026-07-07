/**
 * FIRMO POS Domain Module
 *
 * Barrel export for core domain types, events, and value objects.
 * Import from '@/src/core/domain' instead of individual files.
 *
 * Note: Some modules have overlapping type names (TaxCategory, GoodsReceiptStatus).
 * For those, import directly from the specific file.
 */

// Core events (primary source for event types)
export * from './events';
export * from './event-versions';

// Identity types
export * from './ids';

// Money types (primary source for Cents, formatCents)
export * from './money';

// Database enums (excludes names that overlap with inventory-events)
export {
  OrderStatus,
  ORDER_STATUS_VALUES,
  FulfillmentStatus,
  FULFILLMENT_STATUS_VALUES,
  HandoffStatus,
  HANDOFF_STATUS_VALUES,
  ShiftStatus,
  SHIFT_STATUS_VALUES,
  InvoiceStatus,
  INVOICE_STATUS_VALUES,
  CreditNoteStatus,
  CREDIT_NOTE_STATUS_VALUES,
  SunatStatus,
  SUNAT_STATUS_VALUES,
  RefundStatus,
} from './db-enums';

// Stations
export * from './stations';

// Item status machine
export { canTransition, getNextValidStates, isTerminalState, getNextNormalState } from './item-status-machine';

// Event migrator
export { EventMigratorService } from './event-migrator';

// Profitability (excludes formatCents which conflicts with money.ts)
export {
  calculateProfit,
  calculateMargin,
  calculateProfitAndMargin,
  formatMargin,
  formatCOGS,
  formatProfit,
  validatePrice,
  validateCOGS,
  validateMargin,
  validateQuantity,
} from './profitability';
