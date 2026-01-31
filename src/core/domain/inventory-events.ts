// src/core/domain/inventory-events.ts
// Inventory Event Schemas - Schema Completeness Fase 2-5
import { z } from "zod";

const uuidSchema = z.string().uuid();
const positiveCentsSchema = z.number().int().nonnegative();
const centsSchema = z.number().int();

// ============================================================================
// Purchase Order Events (Fase 2)
// ============================================================================

export const PurchaseOrderStatusSchema = z.enum([
  "DRAFT", "SENT", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"
]);

export const PurchaseOrderCreatedPayload = z.object({
  purchase_order_id: uuidSchema,
  supplier_id: uuidSchema,
  location_id: uuidSchema,
  order_number: z.number().int().positive(),
  items: z.array(z.object({
    inventory_code: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().min(1),
    unit_cost_cents: positiveCentsSchema,
  })),
  subtotal_cents: positiveCentsSchema,
  tax_cents: positiveCentsSchema.default(0),
  total_cents: positiveCentsSchema,
  expected_delivery_date: z.string().nullish(), // YYYY-MM-DD
  notes: z.string().nullish(),
});

export const PurchaseOrderStatusChangedPayload = z.object({
  purchase_order_id: uuidSchema,
  from_status: PurchaseOrderStatusSchema,
  to_status: PurchaseOrderStatusSchema,
});

// ============================================================================
// Goods Receipt Events (Fase 3)
// ============================================================================

export const GoodsReceiptStatusSchema = z.enum(["DRAFT", "CONFIRMED", "CANCELLED"]);

export const GoodsReceivedPayload = z.object({
  goods_receipt_id: uuidSchema,
  purchase_order_id: uuidSchema.nullish(),
  location_id: uuidSchema,
  receipt_number: z.string().min(1),
  items: z.array(z.object({
    inventory_code: z.string().min(1),
    quantity_ordered: z.number().nonnegative(),
    quantity_received: z.number().nonnegative(),
    quantity_rejected: z.number().nonnegative().default(0),
    rejection_reason: z.string().nullish(),
    unit_cost_cents: positiveCentsSchema,
    lot_number: z.string().nullish(),
    expiry_date: z.string().nullish(), // YYYY-MM-DD
  })),
  received_by: uuidSchema,
  notes: z.string().nullish(),
});

// ============================================================================
// Inventory Control Events (Fase 4)
// ============================================================================

export const WasteReasonCodeSchema = z.enum([
  "EXPIRED", "DAMAGED", "THEFT", "PRODUCTION_LOSS",
  "REJECTED_ON_RECEIPT", "COUNT_ADJUSTMENT", "OTHER"
]);

export const InventoryAdjustedPayload = z.object({
  inventory_code: z.string().min(1),
  location_id: uuidSchema,
  from_qty: z.number(),
  to_qty: z.number(),
  reason: z.string().min(1),
  reference_type: z.enum(["INVENTORY_COUNT", "MANUAL"]).nullish(),
  reference_id: uuidSchema.nullish(),
});

export const WasteRecordedPayload = z.object({
  waste_log_id: uuidSchema,
  inventory_code: z.string().min(1),
  location_id: uuidSchema,
  quantity: z.number().positive(),
  unit: z.string().min(1),
  reason_code: WasteReasonCodeSchema,
  reason_detail: z.string().nullish(),
  cost_cents: positiveCentsSchema,
  reported_by: uuidSchema,
  reference_type: z.string().nullish(),
  reference_id: uuidSchema.nullish(),
});

export const InventoryCountCompletedPayload = z.object({
  inventory_count_id: uuidSchema,
  location_id: uuidSchema,
  count_date: z.string(), // YYYY-MM-DD
  count_type: z.enum(["FULL", "PARTIAL", "SPOT"]),
  items: z.array(z.object({
    inventory_code: z.string().min(1),
    expected_qty: z.number(),
    counted_qty: z.number(),
    difference_qty: z.number(),
    unit_cost_cents: positiveCentsSchema,
    notes: z.string().nullish(),
  })),
  total_difference_cents: centsSchema,
  counted_by: uuidSchema,
  approved_by: uuidSchema.nullish(),
});

// ============================================================================
// Inventory Deduction Events (Fase 5)
// ============================================================================

export const InventoryDeductedPayload = z.object({
  order_id: uuidSchema,
  line_id: z.string().min(1),
  product_id: z.string().min(1),
  location_id: uuidSchema,
  ingredients: z.array(z.object({
    inventory_code: z.string().min(1),
    quantity_deducted: z.number().positive(),
    new_stock: z.number(),
  })),
});

// ============================================================================
// Type Exports
// ============================================================================

export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>;
export type GoodsReceiptStatus = z.infer<typeof GoodsReceiptStatusSchema>;
export type WasteReasonCode = z.infer<typeof WasteReasonCodeSchema>;

export type PurchaseOrderCreated = z.infer<typeof PurchaseOrderCreatedPayload>;
export type PurchaseOrderStatusChanged = z.infer<typeof PurchaseOrderStatusChangedPayload>;
export type GoodsReceived = z.infer<typeof GoodsReceivedPayload>;
export type InventoryAdjusted = z.infer<typeof InventoryAdjustedPayload>;
export type WasteRecorded = z.infer<typeof WasteRecordedPayload>;
export type InventoryCountCompleted = z.infer<typeof InventoryCountCompletedPayload>;
export type InventoryDeducted = z.infer<typeof InventoryDeductedPayload>;

// ============================================================================
// Status Transition Validation
// ============================================================================

const VALID_PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIAL_RECEIVED: ["RECEIVED", "CANCELLED"],
  RECEIVED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

export function isValidPurchaseOrderTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus
): boolean {
  return VALID_PO_TRANSITIONS[from]?.includes(to) ?? false;
}
