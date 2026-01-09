// src/core/domain/events.ts
// Event Schemas with Zod - Aligned with docs/EVENTS.md
import { z } from "zod";

// ============================================================================
// Base Schemas
// ============================================================================

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z.string().datetime({ offset: true }).or(z.string().datetime());

// Money is always in cents (integer) - NEVER use float
export const centsSchema = z.number().int();
export const positiveCentsSchema = z.number().int().nonnegative();

// ============================================================================
// Enums (from docs/SPECS.md)
// ============================================================================

export const OrderTypeSchema = z.enum(["DINE_IN", "TAKEOUT", "DELIVERY"]);
export const OrderStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"]);
export const FulfillmentStatusSchema = z.enum(["COOKING", "PARTIAL_READY", "ALL_READY"]);
export const ItemStatusSchema = z.enum(["PENDING", "COOKING", "READY", "DONE", "VOIDED"]);
export const PaymentMethodSchema = z.enum(["CASH", "YAPE", "PLIN", "CARD", "TRANSFER"]);
export const PaymentStatusSchema = z.enum(["UNPAID", "PARTIAL", "PAID"]);
export const InvoiceTypeSchema = z.enum(["BOLETA", "FACTURA"]);
export const SplitModeSchema = z.enum(["ITEMS", "PERCENT"]);

export type OrderType = z.infer<typeof OrderTypeSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;

// Export inferred types for UI
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type Check = z.infer<typeof CheckSchema>;
// OrderCreatedPayload typically represents the full Order state in our event sourcing model (snapshot)
// But wait, the Order entity might be structured slightly differently than the payload if we have computed fields?
// For MVP, lets assume the OrderCreatedPayload structure roughly matches the entity state, 
// OR we can export `OrderCreatedEvent["payload"]` as `Order` for simplicity, 
// but we need to include ALL fields (id, etc).
// Actually, `OrderCreatedPayload` has `order_id` etc.
// Let's rely on `OrderCreatedPayload` structure for `Order` type for now.
// Wait, `OrderCreatedPayload` is not exported purely.
// Let's define:
export type Order = z.infer<typeof OrderCreatedPayload>;

// ============================================================================
// Aggregate Types
// ============================================================================

export const AggregateTypeSchema = z.enum(["ORDER", "SHIFT", "INVOICE", "CATALOG", "COUPON"]);

// ============================================================================
// Base Envelope (all events have this structure)
// ============================================================================

export const BaseEnvelopeSchema = z.object({
    // Identity
    event_id: uuidSchema,
    tenant_id: uuidSchema,

    // Terminal info
    terminal_id: z.string().min(1),
    terminal_sequence: z.number().int().nonnegative(),

    // Time
    occurred_at: isoDateSchema,

    // Aggregate
    aggregate_type: AggregateTypeSchema,
    aggregate_id: uuidSchema,

    // Tracing
    correlation_id: z.string().min(1),
    causation_id: uuidSchema.nullish(),

    // Actor
    actor_id: uuidSchema.nullish(),
    actor_role_snapshot: z.string().nullish(),

    // Version
    schema_version: z.number().int().positive().default(1),
    payload_version: z.number().int().positive().default(1), // Version of the payload schema

    // Context (added for schema completeness)
    shift_id: uuidSchema.nullish(),
    business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(), // YYYY-MM-DD format
});

// ============================================================================
// SHIFT Events (P0)
// ============================================================================

const ShiftOpenedPayload = z.object({
    shift_id: uuidSchema,
    cash_opening_cents: positiveCentsSchema,
});

const ShiftClosedPayload = z.object({
    shift_id: uuidSchema,
    cash_counted_cents: positiveCentsSchema,
    notes: z.string().optional(),
});

const CashAdjustedPayload = z.object({
    shift_id: uuidSchema,
    delta_cents: centsSchema, // Can be negative
    reason: z.string().min(1),
});

// ============================================================================
// ORDER Events (P0)
// ============================================================================

// Order Item structure (embedded in ORDER_CREATED and ORDER_ITEM_ADDED)
export const OrderLineSchema = z.object({
    line_id: z.string().min(1),
    product_id: z.string().min(1), // Relaxed from uuidSchema to support 'prod_001' style IDs
    sku: z.string().min(1),
    name: z.string().min(1),
    short_name: z.string().optional(),
    qty: z.number().int().positive(),
    unit_price_cents: positiveCentsSchema,
    station: z.string().min(1),
    status: ItemStatusSchema.default("PENDING"),
    mods: z.array(z.string()).default([]),
    notes: z.string().optional(),
    // Timestamps for item lifecycle tracking
    created_at: isoDateSchema.optional(),
    started_cooking_at: isoDateSchema.nullish(),
    ready_at: isoDateSchema.nullish(),
    served_at: isoDateSchema.nullish(),
});

// Check structure (for split bill)
export const CheckSchema = z.object({
    check_id: z.string().min(1),
    name: z.string().optional(),
    mode: SplitModeSchema.default("ITEMS"),
    lines: z.array(z.object({
        line_id: z.string().min(1),
        qty: z.number().int().positive(),
    })).default([]),
    subtotal_cents: positiveCentsSchema.default(0),
    discount_cents: positiveCentsSchema.default(0),
    tip_cents: positiveCentsSchema.default(0),
    total_cents: positiveCentsSchema.default(0),
    payment: z.object({
        status: PaymentStatusSchema.default("UNPAID"),
        payments: z.array(z.object({
            method: PaymentMethodSchema,
            amount_cents: positiveCentsSchema,
            ref: z.string().optional(),
        })).default([]),
    }).default({ status: "UNPAID", payments: [] }),
});

// Fulfillment info
export const FulfillmentSchema = z.object({
    table_number: z.string().optional(),
    guest_count: z.number().int().positive().optional(),
    pickup_name: z.string().optional(),
    pickup_phone: z.string().optional(),
});

// Delivery info
export const DeliverySchema = z.object({
    courier_type: z.enum(["OWN", "APP"]).optional(),
    delivery_fee_cents: positiveCentsSchema.default(0),
    assigned_driver_id: uuidSchema.optional(),
    payment_expectation: z.enum(["PREPAID", "COD"]).default("PREPAID"),
    address_snapshot: z.object({
        address_text: z.string(),
        reference: z.string().optional(),
    }).optional(),
});

const OrderCreatedPayload = z.object({
    order_id: uuidSchema,
    order_number: z.number().int().positive(),
    order_type: OrderTypeSchema,
    items: z.array(OrderLineSchema).default([]),
    checks: z.array(CheckSchema).default([]),
    fulfillment: FulfillmentSchema.optional(),
    delivery: DeliverySchema.optional(),
    promotion_id: uuidSchema.nullish(),
});

const OrderItemAddedPayload = z.object({
    order_id: uuidSchema,
    line: OrderLineSchema,
});

const OrderItemQtyChangedPayload = z.object({
    order_id: uuidSchema,
    line_id: z.string().min(1),
    from_qty: z.number().int().positive(),
    to_qty: z.number().int().positive(),
});

const OrderItemStatusChangedPayload = z.object({
    order_id: uuidSchema,
    line_id: z.string().min(1),
    from: ItemStatusSchema,
    to: ItemStatusSchema,
    station: z.string().min(1),
});

const OrderItemVoidedPayload = z.object({
    order_id: uuidSchema,
    line_id: z.string().min(1),
    reason: z.string().min(1),
    voided_at: isoDateSchema,
    approved_by: uuidSchema.optional(),
});

const OrderCancelledPayload = z.object({
    order_id: uuidSchema,
    reason: z.string().min(1),
    approved_by: uuidSchema.optional(),
});

// REQUEST_CHECK - Waiter requests bill for table
const RequestCheckPayload = z.object({
    order_id: uuidSchema,
    requested_by: uuidSchema,
    requested_at: isoDateSchema,
    table_number: z.string().optional(),
});

// ORDER_SUBMITTED - Order sent to kitchen
const OrderSubmittedPayload = z.object({
    order_id: uuidSchema,
    submitted_at: isoDateSchema,
    items_by_station: z.record(z.string(), z.array(z.object({
        line_id: z.string().min(1),
        product_id: z.string().min(1),
        name: z.string().min(1),
        qty: z.number().int().positive(),
        mods: z.array(z.string()).default([]),
        notes: z.string().optional(),
    }))),
});

// ============================================================================
// CHECK Events (Split Bill - P0)
// ============================================================================

const CheckCreatedPayload = z.object({
    order_id: uuidSchema,
    check: CheckSchema,
});

const CheckPaymentAddedPayload = z.object({
    order_id: uuidSchema,
    check_id: z.string().min(1),
    payment: z.object({
        method: PaymentMethodSchema,
        amount_cents: positiveCentsSchema,
        ref: z.string().optional(),
    }),
});

const CheckMarkedPaidPayload = z.object({
    order_id: uuidSchema,
    check_id: z.string().min(1),
    paid_at: isoDateSchema,
    change_cents: positiveCentsSchema.default(0),
});

const CheckTipSetPayload = z.object({
    order_id: uuidSchema,
    check_id: z.string().min(1),
    tip_cents: positiveCentsSchema,
});

const CheckItemsUpdatedPayload = z.object({
    order_id: uuidSchema,
    check_id: z.string().min(1),
    lines: z.array(z.object({
        line_id: z.string().min(1),
        qty: z.number().int().positive(),
    })),
});

// ============================================================================
// INVOICE Events (P0)
// ============================================================================

const InvoiceIssuedPayload = z.object({
    order_id: uuidSchema,
    check_id: z.string().min(1),
    invoice_id: uuidSchema,
    invoice_type: InvoiceTypeSchema,
    series: z.string().optional(),
    invoice_number: z.string().optional(),
    total_cents: positiveCentsSchema,
});

const InvoiceVoidedPayload = z.object({
    invoice_id: uuidSchema,
    reason: z.string().min(1),
    approved_by: uuidSchema,
});

// ============================================================================
// CATALOG Events (P0)
// ============================================================================

const CatalogVersionBumpedPayload = z.object({
    catalog_version: z.number().int().positive(),
    reason: z.string().optional(),
});

// ============================================================================
// Discriminated Union of All Events
// ============================================================================

export const EventSchema = z.discriminatedUnion("event_type", [
    // SHIFT events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SHIFT_OPENED"),
        aggregate_type: z.literal("SHIFT"),
        payload: ShiftOpenedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SHIFT_CLOSED"),
        aggregate_type: z.literal("SHIFT"),
        payload: ShiftClosedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CASH_ADJUSTED"),
        aggregate_type: z.literal("SHIFT"),
        payload: CashAdjustedPayload,
    }),

    // ORDER events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_CREATED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_ITEM_ADDED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderItemAddedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_ITEM_QTY_CHANGED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderItemQtyChangedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_ITEM_STATUS_CHANGED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderItemStatusChangedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_ITEM_VOIDED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderItemVoidedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_CANCELLED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderCancelledPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("REQUEST_CHECK"),
        aggregate_type: z.literal("ORDER"),
        payload: RequestCheckPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_SUBMITTED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderSubmittedPayload,
    }),

    // CHECK events (split bill)
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_CREATED"),
        aggregate_type: z.literal("ORDER"),
        payload: CheckCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_PAYMENT_ADDED"),
        aggregate_type: z.literal("ORDER"),
        payload: CheckPaymentAddedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_MARKED_PAID"),
        aggregate_type: z.literal("ORDER"),
        payload: CheckMarkedPaidPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_TIP_SET"),
        aggregate_type: z.literal("ORDER"),
        payload: CheckTipSetPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_ITEMS_UPDATED"),
        aggregate_type: z.literal("ORDER"),
        payload: CheckItemsUpdatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CHECK_ITEMS_MOVED"),
        aggregate_type: z.literal("ORDER"),
        payload: z.object({
            order_id: uuidSchema,
            from_check_id: z.string().min(1),
            to_check_id: z.string().min(1),
            lines: z.array(z.object({
                line_id: z.string().min(1),
                qty: z.number().int().positive(),
            })),
        }),
    }),

    // INVOICE events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVOICE_ISSUED"),
        aggregate_type: z.literal("INVOICE"),
        payload: InvoiceIssuedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVOICE_VOIDED"),
        aggregate_type: z.literal("INVOICE"),
        payload: InvoiceVoidedPayload,
    }),

    // CATALOG events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CATALOG_VERSION_BUMPED"),
        aggregate_type: z.literal("CATALOG"),
        payload: CatalogVersionBumpedPayload,
    }),
]);

// ============================================================================
// Types
// ============================================================================

export type ParkEvent = z.infer<typeof EventSchema>;
export type EventType = ParkEvent["event_type"];

// Extract specific event types
export type ShiftOpenedEvent = Extract<ParkEvent, { event_type: "SHIFT_OPENED" }>;
export type ShiftClosedEvent = Extract<ParkEvent, { event_type: "SHIFT_CLOSED" }>;
export type OrderCreatedEvent = Extract<ParkEvent, { event_type: "ORDER_CREATED" }>;
export type OrderItemAddedEvent = Extract<ParkEvent, { event_type: "ORDER_ITEM_ADDED" }>;
export type CheckCreatedEvent = Extract<ParkEvent, { event_type: "CHECK_CREATED" }>;
export type CheckItemsUpdatedEvent = Extract<ParkEvent, { event_type: "CHECK_ITEMS_UPDATED" }>;
export type CheckPaymentAddedEvent = Extract<ParkEvent, { event_type: "CHECK_PAYMENT_ADDED" }>;
export type CheckMarkedPaidEvent = Extract<ParkEvent, { event_type: "CHECK_MARKED_PAID" }>;
export type InvoiceIssuedEvent = Extract<ParkEvent, { event_type: "INVOICE_ISSUED" }>;
export type RequestCheckEvent = Extract<ParkEvent, { event_type: "REQUEST_CHECK" }>;
export type OrderSubmittedEvent = Extract<ParkEvent, { event_type: "ORDER_SUBMITTED" }>;
export type OrderItemQtyChangedEvent = Extract<ParkEvent, { event_type: "ORDER_ITEM_QTY_CHANGED" }>;
export type OrderItemVoidedEvent = Extract<ParkEvent, { event_type: "ORDER_ITEM_VOIDED" }>;

// ============================================================================
// Ingest Request Schema
// ============================================================================

export const IngestRequestSchema = z.object({
    tenant_id: uuidSchema,
    terminal_id: z.string().min(1),
    from_terminal_sequence: z.number().int().nonnegative(),
    to_terminal_sequence: z.number().int().nonnegative(),
    events: z.array(EventSchema).min(1).max(500),
}).strict();

export type IngestRequest = z.infer<typeof IngestRequestSchema>;

// Backward compatibility alias (lowercase)
export const ingestRequestSchema = IngestRequestSchema;
export const eventSchema = EventSchema;

// ============================================================================
// Helpers
// ============================================================================

export function parseEvent(input: unknown): ParkEvent {
    return EventSchema.parse(input);
}

export function safeParseEvent(input: unknown) {
    return EventSchema.safeParse(input);
}

// Type guard
export function isEventType<T extends EventType>(
    event: ParkEvent,
    type: T
): event is Extract<ParkEvent, { event_type: T }> {
    return event.event_type === type;
}
