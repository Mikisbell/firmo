/**
 * Database Enums
 * 
 * Valores válidos para campos de status en la base de datos.
 * Usar estos enums para validación en business-rules.ts
 */

// ============================================
// Order Status
// ============================================

/**
 * Order Status - Alineado con events.ts y sale.reducer.ts
 * 
 * OPEN: Orden activa, aceptando items/pagos
 * IN_PROGRESS: Orden enviada a cocina (ORDER_SUBMITTED)
 * CONFIRMED: Orden pagada y facturada (INVOICE_ISSUED)
 * CANCELLED: Orden cancelada (ORDER_CANCELLED)
 */
export const OrderStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const ORDER_STATUS_VALUES = Object.values(OrderStatus);

// ============================================
// Fulfillment Status
// ============================================

export const FulfillmentStatus = {
  COOKING: 'COOKING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
} as const;

export type FulfillmentStatus = typeof FulfillmentStatus[keyof typeof FulfillmentStatus];

export const FULFILLMENT_STATUS_VALUES = Object.values(FulfillmentStatus);

// ============================================
// Handoff Status
// ============================================

export const HandoffStatus = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  PICKED_UP: 'PICKED_UP',
} as const;

export type HandoffStatus = typeof HandoffStatus[keyof typeof HandoffStatus];

export const HANDOFF_STATUS_VALUES = Object.values(HandoffStatus);

// ============================================
// Shift Status
// ============================================

export const ShiftStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type ShiftStatus = typeof ShiftStatus[keyof typeof ShiftStatus];

export const SHIFT_STATUS_VALUES = Object.values(ShiftStatus);

// ============================================
// Invoice Status
// ============================================

export const InvoiceStatus = {
  ISSUED: 'ISSUED',
  VOIDED: 'VOIDED',
} as const;

export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const INVOICE_STATUS_VALUES = Object.values(InvoiceStatus);

// ============================================
// Credit Note Status
// ============================================

export const CreditNoteStatus = {
  ISSUED: 'ISSUED',
  VOIDED: 'VOIDED',
} as const;

export type CreditNoteStatus = typeof CreditNoteStatus[keyof typeof CreditNoteStatus];

export const CREDIT_NOTE_STATUS_VALUES = Object.values(CreditNoteStatus);

// ============================================
// SUNAT Status
// ============================================

export const SunatStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;

export type SunatStatus = typeof SunatStatus[keyof typeof SunatStatus];

export const SUNAT_STATUS_VALUES = Object.values(SunatStatus);

// ============================================
// Refund Status
// ============================================

export const RefundStatus = {
  REQUESTED: 'REQUESTED',
  AUTHORIZED: 'AUTHORIZED',
  ISSUED: 'ISSUED',
  REJECTED: 'REJECTED',
} as const;

export type RefundStatus = typeof RefundStatus[keyof typeof RefundStatus];

export const REFUND_STATUS_VALUES = Object.values(RefundStatus);

// ============================================
// Delivery Order Status
// ============================================

export const DeliveryOrderStatus = {
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  DISPATCHED: 'DISPATCHED',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type DeliveryOrderStatus = typeof DeliveryOrderStatus[keyof typeof DeliveryOrderStatus];

export const DELIVERY_ORDER_STATUS_VALUES = Object.values(DeliveryOrderStatus);

// ============================================
// Check Status
// ============================================

export const CheckStatus = {
  OPEN: 'OPEN',
  PAID: 'PAID',
  VOIDED: 'VOIDED',
} as const;

export type CheckStatus = typeof CheckStatus[keyof typeof CheckStatus];

export const CHECK_STATUS_VALUES = Object.values(CheckStatus);

// ============================================
// Payment Status
// ============================================

export const PaymentStatus = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;

export type PaymentStatus = typeof PaymentStatus[keyof typeof PaymentStatus];

export const PAYMENT_STATUS_VALUES = Object.values(PaymentStatus);

// ============================================
// Tip Status
// ============================================

export const TipStatus = {
  RECEIVED: 'RECEIVED',
  SETTLED: 'SETTLED',
} as const;

export type TipStatus = typeof TipStatus[keyof typeof TipStatus];

export const TIP_STATUS_VALUES = Object.values(TipStatus);

// ============================================
// Validation Helper
// ============================================

/**
 * Valida que un valor esté en la lista de valores válidos
 */
export function isValidStatus<T extends string>(
  value: string,
  validValues: readonly T[]
): value is T {
  return validValues.includes(value as T);
}

// ============================================
// Additional Status Enums (Fase 2)
// ============================================

// Coupon Status
export const CouponStatus = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  REDEEMED: 'REDEEMED',
  EXPIRED: 'EXPIRED',
  VOIDED: 'VOIDED',
} as const;

export type CouponStatus = typeof CouponStatus[keyof typeof CouponStatus];
export const COUPON_STATUS_VALUES = Object.values(CouponStatus);

// Goods Receipt Status
export const GoodsReceiptStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export type GoodsReceiptStatus = typeof GoodsReceiptStatus[keyof typeof GoodsReceiptStatus];
export const GOODS_RECEIPT_STATUS_VALUES = Object.values(GoodsReceiptStatus);

// Inventory Count Status
export const InventoryCountStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type InventoryCountStatus = typeof InventoryCountStatus[keyof typeof InventoryCountStatus];
export const INVENTORY_COUNT_STATUS_VALUES = Object.values(InventoryCountStatus);

// Print Job Status
export const PrintJobStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  PRINTED: 'PRINTED',
  FAILED: 'FAILED',
} as const;

export type PrintJobStatus = typeof PrintJobStatus[keyof typeof PrintJobStatus];
export const PRINT_JOB_STATUS_VALUES = Object.values(PrintJobStatus);

// Purchase Order Status
export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PARTIAL: 'PARTIAL',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type PurchaseOrderStatus = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];
export const PURCHASE_ORDER_STATUS_VALUES = Object.values(PurchaseOrderStatus);

// Reservation Status
export const ReservationStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  SEATED: 'SEATED',
  COMPLETED: 'COMPLETED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;

export type ReservationStatus = typeof ReservationStatus[keyof typeof ReservationStatus];
export const RESERVATION_STATUS_VALUES = Object.values(ReservationStatus);

// Table Status
export const TableStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  CLEANING: 'CLEANING',
} as const;

export type TableStatus = typeof TableStatus[keyof typeof TableStatus];
export const TABLE_STATUS_VALUES = Object.values(TableStatus);

// Attendance Status
export const AttendanceStatus = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  EARLY_LEAVE: 'EARLY_LEAVE',
} as const;

export type AttendanceStatus = typeof AttendanceStatus[keyof typeof AttendanceStatus];
export const ATTENDANCE_STATUS_VALUES = Object.values(AttendanceStatus);

// Message Outbox Status
export const MessageOutboxStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;

export type MessageOutboxStatus = typeof MessageOutboxStatus[keyof typeof MessageOutboxStatus];
export const MESSAGE_OUTBOX_STATUS_VALUES = Object.values(MessageOutboxStatus);

// Invoice Queue Status
export const InvoiceQueueStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export type InvoiceQueueStatus = typeof InvoiceQueueStatus[keyof typeof InvoiceQueueStatus];
export const INVOICE_QUEUE_STATUS_VALUES = Object.values(InvoiceQueueStatus);

// Marketing Campaign Status
export const MarketingCampaignStatus = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
} as const;

export type MarketingCampaignStatus = typeof MarketingCampaignStatus[keyof typeof MarketingCampaignStatus];
export const MARKETING_CAMPAIGN_STATUS_VALUES = Object.values(MarketingCampaignStatus);

// Stock Transfer Status
export const StockTransferStatus = {
  PENDING: 'PENDING',
  SHIPPED: 'SHIPPED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;

export type StockTransferStatus = typeof StockTransferStatus[keyof typeof StockTransferStatus];
export const STOCK_TRANSFER_STATUS_VALUES = Object.values(StockTransferStatus);

// Time Off Request Status
export const TimeOffRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type TimeOffRequestStatus = typeof TimeOffRequestStatus[keyof typeof TimeOffRequestStatus];
export const TIME_OFF_REQUEST_STATUS_VALUES = Object.values(TimeOffRequestStatus);

// Waitlist Status
export const WaitlistStatus = {
  WAITING: 'WAITING',
  NOTIFIED: 'NOTIFIED',
  SEATED: 'SEATED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type WaitlistStatus = typeof WaitlistStatus[keyof typeof WaitlistStatus];
export const WAITLIST_STATUS_VALUES = Object.values(WaitlistStatus);

// AI Suggestion Status
export const AiSuggestionStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type AiSuggestionStatus = typeof AiSuggestionStatus[keyof typeof AiSuggestionStatus];
export const AI_SUGGESTION_STATUS_VALUES = Object.values(AiSuggestionStatus);

// Schedule Status
export const ScheduleStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  SWAPPED: 'SWAPPED',
  CANCELLED: 'CANCELLED',
} as const;

export type ScheduleStatus = typeof ScheduleStatus[keyof typeof ScheduleStatus];
export const SCHEDULE_STATUS_VALUES = Object.values(ScheduleStatus);
