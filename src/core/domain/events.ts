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
export const OrderStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "CONFIRMED", "CANCELLED"]);
export const FulfillmentStatusSchema = z.enum(["COOKING", "READY", "DELIVERED"]);
export const ItemStatusSchema = z.enum(["PENDING", "COOKING", "READY", "DONE", "VOIDED"]);
export const PaymentMethodSchema = z.enum(["CASH", "YAPE", "PLIN", "CARD", "TRANSFER"]);
export const PaymentStatusSchema = z.enum(["UNPAID", "PARTIAL", "PAID"]);
export const InvoiceTypeSchema = z.enum(["BOLETA", "FACTURA"]);
export const TaxCategorySchema = z.enum(["GRAVADO", "EXONERADO", "INAFECTO"]);
export const SplitModeSchema = z.enum(["ITEMS", "PERCENT"]);

export type OrderType = z.infer<typeof OrderTypeSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type ItemStatus = z.infer<typeof ItemStatusSchema>;
export type TaxCategory = z.infer<typeof TaxCategorySchema>;

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

export const AggregateTypeSchema = z.enum(["ORDER", "SHIFT", "INVOICE", "CATALOG", "COUPON", "SAGA", "INVENTORY", "HR", "RESERVATION"]);

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
    tax_category: TaxCategorySchema.default("GRAVADO"), // SUNAT: GRAVADO(18%), EXONERADO(0%), INAFECTO(0%)
    mods: z.array(z.string()).default([]),
    notes: z.string().optional(),
    // Course fire control
    course: z.number().int().positive().optional(), // 1=entrada, 2=fondo, 3=postre
    held: z.boolean().optional(), // Retenido por course (no entra a COOKING hasta fire)
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

// ORDER_COURSE_FIRED - Course released for cooking
const OrderCourseFiredPayload = z.object({
    order_id: uuidSchema,
    course: z.number().int().positive(),
    fired_at: isoDateSchema,
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
    idempotency_key: z.string().min(1),
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
// PROMOTION Events (P1)
// ============================================================================

const PromotionAppliedTentativePayload = z.object({
    order_id: uuidSchema,
    promotion_id: uuidSchema,
    source: z.enum(["ORDER_SCREEN", "CATALOG", "MANUAL"]),
    applied_at: isoDateSchema,
});

const PromotionValidatedAppliedPayload = z.object({
    order_id: uuidSchema,
    promotion_id: uuidSchema,
    promotion_snapshot: z.object({
        id: uuidSchema,
        name: z.string(),
        type: z.enum(["PERCENT", "FIXED", "HAPPY_HOUR", "2X1", "COMBO"]),
        value: z.number().int(),
    }),
    recalculated_totals: z.object({
        subtotal_cents: positiveCentsSchema,
        discount_cents: positiveCentsSchema,
        total_cents: positiveCentsSchema,
    }),
    validated_at: isoDateSchema,
    validated_by: uuidSchema,
});

const PromotionRemovedPayload = z.object({
    order_id: uuidSchema,
    promotion_id: uuidSchema,
    reason: z.enum(["USER_REQUEST", "EXPIRED", "INVALID", "STACKING_NOT_ALLOWED"]),
    previous_totals: z.object({
        subtotal_cents: positiveCentsSchema,
        discount_cents: positiveCentsSchema,
        total_cents: positiveCentsSchema,
    }),
    removed_at: isoDateSchema,
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

const CreditNoteIssuedPayload = z.object({
    credit_note_id: uuidSchema,
    invoice_id: uuidSchema,
    series: z.string().min(1),
    number: z.string().min(1),
    total_cents: positiveCentsSchema,
    reason: z.string().min(1),
});

const CreditNoteVoidedPayload = z.object({
    credit_note_id: uuidSchema,
    invoice_id: uuidSchema,
    reason: z.string().min(1),
    voided_by: uuidSchema,
});

// ============================================================================
// REFUND Events (P1)
// ============================================================================

const RefundIssuedPayload = z.object({
    refund_id: uuidSchema,
    order_id: uuidSchema,
    check_id: z.string().min(1),
    invoice_id: uuidSchema.nullish(),
    type: z.enum(["FULL", "PARTIAL", "ITEM"]),
    reason_code: z.enum(["CUSTOMER_REQUEST", "ORDER_ERROR", "QUALITY_ISSUE", "LATE_DELIVERY", "WRONG_ITEM", "OTHER"]),
    reason_detail: z.string().nullish(),
    original_amount: positiveCentsSchema,
    refund_amount: positiveCentsSchema,
    refund_method: PaymentMethodSchema,
    items: z.array(z.object({
        line_id: z.string().min(1),
        product_id: z.string().min(1),
        name: z.string(),
        qty: z.number().int().positive(),
        unit_price_cents: positiveCentsSchema,
        refund_cents: positiveCentsSchema,
    })).nullish(),
    issued_by: uuidSchema,
    issued_at: isoDateSchema,
});

// ============================================================================
// DELIVERY Events (P1)
// ============================================================================

const DeliveryAssignedPayload = z.object({
    order_id: uuidSchema,
    driver_id: uuidSchema.nullish(),
    courier_type: z.enum(["OWN", "APP"]),
    app_name: z.string().nullish(),
    assigned_at: isoDateSchema,
});

const DeliveryStatusChangedPayload = z.object({
    order_id: uuidSchema,
    from: z.enum(["PENDING_ASSIGN", "ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED"]),
    to: z.enum(["PENDING_ASSIGN", "ASSIGNED", "PICKED_UP", "DELIVERED", "FAILED"]),
    changed_at: isoDateSchema,
    location: z.object({
        lat: z.number(),
        lng: z.number(),
    }).nullish(),
});

const HandoffStatusChangedPayload = z.object({
    order_id: uuidSchema,
    from: z.enum(["WAITING", "PACKING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"]),
    to: z.enum(["WAITING", "PACKING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"]),
    changed_at: isoDateSchema,
});

// ============================================================================
// CATALOG Events (P0)
// ============================================================================

const CatalogVersionBumpedPayload = z.object({
    catalog_version: z.number().int().positive(),
    reason: z.string().optional(),
});

// Eventos de Disponibilidad de Producto (Auto-86)
const ProductMarkedUnavailablePayload = z.object({
    product_id: uuidSchema,
    reason: z.enum(["MANUAL", "LOW_STOCK", "INGREDIENT_OUT"]),
    disabled_by: uuidSchema.nullish(),
    disabled_at: isoDateSchema,
});

const ProductMarkedAvailablePayload = z.object({
    product_id: uuidSchema,
    enabled_by: uuidSchema.nullish(),
    enabled_at: isoDateSchema,
});

// ============================================================================
// INVENTORY Events (P1)
// ============================================================================

// Import inventory event payloads from inventory-events module
import {
    PurchaseOrderCreatedPayload,
    PurchaseOrderStatusChangedPayload,
    GoodsReceivedPayload,
    InventoryAdjustedPayload,
    WasteRecordedPayload,
    InventoryCountCompletedPayload,
    InventoryDeductedPayload,
} from "./inventory-events";

// ============================================================================
// PROFITABILITY Events (P2)
// ============================================================================

// COGS_CALCULATED - COGS calculado para un producto
const COGSCalculatedPayload = z.object({
    product_id: uuidSchema,
    cogs_cents: positiveCentsSchema,
    recipe_id: uuidSchema.nullish(),
    ingredient_count: z.number().int().nonnegative().optional(),
    calculated_at: isoDateSchema,
});

// INGREDIENT_COST_CHANGED - Costo de ingrediente cambió
const IngredientCostChangedPayload = z.object({
    inventory_code: z.string().min(1),
    inventory_item_id: uuidSchema.nullish(),
    old_cost_cents: positiveCentsSchema,
    new_cost_cents: positiveCentsSchema,
    affected_products: z.array(uuidSchema).optional(),
    changed_by: uuidSchema.nullish(),
    changed_at: isoDateSchema,
});

// PROFITABILITY_REPORT_GENERATED - Reporte de rentabilidad generado
const ProfitabilityReportGeneratedPayload = z.object({
    report_id: uuidSchema,
    report_type: z.enum(['FULL', 'BY_PRODUCT', 'BY_CATEGORY', 'MARGIN_ANALYSIS']),
    period_start: isoDateSchema,
    period_end: isoDateSchema,
    product_count: z.number().int().nonnegative(),
    total_revenue_cents: positiveCentsSchema,
    total_profit_cents: centsSchema, // Can be negative
    average_margin_percent: z.number(), // Can be negative
    generated_by: uuidSchema.nullish(),
    generated_at: isoDateSchema,
    filters: z.object({
        product_ids: z.array(uuidSchema).optional(),
        category_ids: z.array(z.string()).optional(),
    }).optional(),
});

// ============================================================================
// SAGA Events (P2)
// ============================================================================

// Saga status enum
export const SagaStatusSchema = z.enum(["IN_PROGRESS", "COMPLETED", "COMPENSATED", "FAILED"]);
export type SagaStatus = z.infer<typeof SagaStatusSchema>;

// Saga step status enum
export const SagaStepStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED", "COMPENSATED"]);
export type SagaStepStatus = z.infer<typeof SagaStepStatusSchema>;

// SAGA_STARTED - Saga execution begins
const SagaStartedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1), // e.g., "COMPLETE_SALE", "VOID_SALE", "APPLY_PROMOTION"
    context: z.record(z.unknown()), // Saga-specific context data
    timeout_ms: z.number().int().positive().optional(),
});

// SAGA_STEP_COMPLETED - Individual saga step succeeds
const SagaStepCompletedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    step_name: z.string().min(1),
    step_index: z.number().int().nonnegative(),
    result: z.record(z.unknown()).optional(), // Step result data
    attempts: z.number().int().positive().default(1),
});

// SAGA_STEP_FAILED - Individual saga step fails
const SagaStepFailedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    step_name: z.string().min(1),
    step_index: z.number().int().nonnegative(),
    error_code: z.string().min(1),
    error_message: z.string().min(1),
    error_transient: z.boolean(), // true if error is retryable
    attempts: z.number().int().positive(),
});

// SAGA_STEP_COMPENSATED - Compensating transaction executes
const SagaStepCompensatedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    step_name: z.string().min(1),
    step_index: z.number().int().nonnegative(),
    compensation_attempts: z.number().int().positive().default(1),
});

// SAGA_COMPLETED - All saga steps complete successfully
const SagaCompletedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    completed_steps: z.array(z.string()).min(1),
    duration_ms: z.number().int().nonnegative(),
});

// SAGA_COMPENSATED - Saga rolled back successfully
const SagaCompensatedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    failed_step: z.string().min(1),
    compensated_steps: z.array(z.string()),
    duration_ms: z.number().int().nonnegative(),
});

// SAGA_FAILED - Saga failed and compensation failed
const SagaFailedPayload = z.object({
    saga_id: uuidSchema,
    saga_type: z.string().min(1),
    failed_step: z.string().min(1),
    error_code: z.string().min(1),
    error_message: z.string().min(1),
    requires_manual_intervention: z.boolean().default(false),
    duration_ms: z.number().int().nonnegative(),
});

// ============================================================================
// HR Events (P2 - RRHH)
// ============================================================================

// EMPLOYEE events
const EmployeeCreatedPayload = z.object({
    employee_id: uuidSchema,
    name: z.string().min(1),
    dni: z.string().optional(),
    role: z.enum(["OWNER", "ADMIN", "MANAGER", "SUPERVISOR", "CASHIER", "WAITER", "KITCHEN", "COOK", "PACKER", "BAR", "DRIVER"]),
    hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    base_salary_cents: positiveCentsSchema,
    contract_type: z.string().min(1),
    location_id: uuidSchema.optional(),
});

const EmployeeProfileUpdatedPayload = z.object({
    employee_id: uuidSchema,
    changes: z.record(z.unknown()),
    updated_by: uuidSchema,
});

const EmployeeDeactivatedPayload = z.object({
    employee_id: uuidSchema,
    reason: z.string().min(1),
    deactivated_by: uuidSchema,
});

// ATTENDANCE events
const AttendanceClockedInPayload = z.object({
    attendance_id: uuidSchema,
    employee_id: uuidSchema,
    clock_in: isoDateSchema,
    scheduled_start: isoDateSchema.optional(),
    late_minutes: z.number().int().nonnegative(),
});

const AttendanceClockedOutPayload = z.object({
    attendance_id: uuidSchema,
    employee_id: uuidSchema,
    clock_out: isoDateSchema,
    worked_minutes: z.number().int().nonnegative(),
    overtime_minutes: z.number().int().nonnegative(),
});

const AttendanceAbsenceDetectedPayload = z.object({
    attendance_id: uuidSchema,
    employee_id: uuidSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    scheduled_start: isoDateSchema,
});

const AttendanceJustifiedPayload = z.object({
    attendance_id: uuidSchema,
    employee_id: uuidSchema,
    justification: z.string().min(1),
    certificate_url: z.string().optional(),
});

// LEAVE REQUEST events
const LeaveRequestCreatedPayload = z.object({
    request_id: uuidSchema,
    employee_id: uuidSchema,
    leave_type: z.string().min(1),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days_requested: z.number().int().positive(),
});

const LeaveRequestApprovedPayload = z.object({
    request_id: uuidSchema,
    employee_id: uuidSchema,
    approved_by: uuidSchema,
    days_deducted: z.number().int().positive(),
});

const LeaveRequestRejectedPayload = z.object({
    request_id: uuidSchema,
    employee_id: uuidSchema,
    rejected_by: uuidSchema,
    reason: z.string().min(1),
});

// ADVANCE events
const AdvanceRequestedPayload = z.object({
    advance_id: uuidSchema,
    employee_id: uuidSchema,
    amount_cents: positiveCentsSchema,
    reason: z.string().min(1),
});

const AdvanceApprovedPayload = z.object({
    advance_id: uuidSchema,
    employee_id: uuidSchema,
    approved_by: uuidSchema,
    amount_cents: positiveCentsSchema,
});

// PAYROLL events
const PayrollCalculatedPayload = z.object({
    payroll_id: uuidSchema,
    employee_id: uuidSchema,
    period_month: z.string().regex(/^\d{4}-\d{2}$/),
    gross_salary_cents: positiveCentsSchema,
    net_salary_cents: positiveCentsSchema,
    components: z.object({
        base_salary_cents: positiveCentsSchema,
        commission_cents: positiveCentsSchema,
        tips_cents: positiveCentsSchema,
        overtime_cents: positiveCentsSchema,
        advances_cents: positiveCentsSchema,
        essalud_cents: positiveCentsSchema,
        pension_cents: positiveCentsSchema,
    }),
});

// EVALUATION events
const EvaluationCreatedPayload = z.object({
    evaluation_id: uuidSchema,
    employee_id: uuidSchema,
    evaluator_id: uuidSchema,
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// TRAINING events
const TrainingCompletedPayload = z.object({
    training_id: uuidSchema,
    employee_id: uuidSchema,
    training_name: z.string().min(1),
    completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    certificate_url: z.string().optional(),
});

// ============================================================================
// PLATFORM Events (P2)
// ============================================================================

const PlatformOrderReceivedPayload = z.object({
    platform_order_id: z.string().min(1),
    platform: z.enum(["PEDIDOSYA", "LLAMAFOOD", "RAPPI"]),
    external_id: z.string().min(1),
    customer_name: z.string().nullish(),
    customer_phone: z.string().nullish(),
    delivery_address: z.string().nullish(),
    items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        unit_price_cents: positiveCentsSchema,
        notes: z.string().optional(),
    })),
    platform_total_cents: positiveCentsSchema,
    restaurant_total_cents: positiveCentsSchema,
    commission_cents: positiveCentsSchema,
    estimated_pickup: isoDateSchema.nullish(),
    notes: z.string().nullish(),
    received_at: isoDateSchema,
});

const PlatformOrderAcceptedPayload = z.object({
    platform_order_id: z.string().min(1),
    order_id: uuidSchema,
    accepted_at: isoDateSchema,
});

const PlatformOrderRejectedPayload = z.object({
    platform_order_id: z.string().min(1),
    reason: z.string().min(1),
    rejected_at: isoDateSchema,
});

// ============================================================================
// RESERVATION Events (Audit Trail)
// ============================================================================

const ReservationCreatedPayload = z.object({
    reservation_id: uuidSchema,
    customer_name: z.string().min(1),
    customer_phone: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    party_size: z.number().int().positive(),
    confirmation_code: z.string().min(1),
    zone_preference: z.string().nullish(),
    special_requests: z.string().nullish(),
});

const ReservationConfirmedPayload = z.object({
    reservation_id: uuidSchema,
    confirmed_by: uuidSchema,
    table_id: uuidSchema.nullish(),
});

const ReservationCancelledPayload = z.object({
    reservation_id: uuidSchema,
    cancelled_by: z.string().min(1), // "CUSTOMER" or admin user UUID
    reason: z.string().nullish(),
});

const ReservationArrivedPayload = z.object({
    reservation_id: uuidSchema,
    arrived_at: isoDateSchema,
});

const ReservationSeatedPayload = z.object({
    reservation_id: uuidSchema,
    table_id: uuidSchema,
    seated_at: isoDateSchema,
});

const ReservationNoShowPayload = z.object({
    reservation_id: uuidSchema,
    marked_by: uuidSchema,
});

// ============================================================================
// SUNAT Electronic Invoicing Events (F1 - Facturacion Electronica)
// ============================================================================

// INVOICE_SENT_TO_SUNAT - Invoice dispatched to SUNAT via queue worker
const InvoiceSentToSunatPayload = z.object({
    invoice_id: uuidSchema,
    queue_item_id: uuidSchema,
    provider: z.enum(["sunat-direct", "nubefact", "mock"]),
    attempt: z.number().int().positive(),
    success: z.boolean(),
});

// INVOICE_SUNAT_ACCEPTED - SUNAT accepted the invoice (CDR code = "0")
const InvoiceSunatAcceptedPayload = z.object({
    invoice_id: uuidSchema,
    response_code: z.string().min(1),
    hash: z.string().min(1),
    cdr_received_at: isoDateSchema,
});

// INVOICE_SUNAT_REJECTED - SUNAT rejected the invoice (CDR code != "0")
const InvoiceSunatRejectedPayload = z.object({
    invoice_id: uuidSchema,
    response_code: z.string().min(1),
    error_message: z.string().min(1),
    attempts: z.number().int().nonnegative(),
});

// DAILY_SUMMARY_SENT - Resumen Diario de Boletas sent to SUNAT
const DailySummarySentPayload = z.object({
    summary_id: uuidSchema,
    tenant_id: uuidSchema,
    summary_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    boletas_count: z.number().int().nonnegative(),
    ticket_number: z.string().optional(),
});

// Loyalty events (store-only, no server-side projection)
const LoyaltyPointsEarnedPayload = z.object({
    customer_id: uuidSchema,
    invoice_id: uuidSchema.optional(),
    points_earned: z.number().int().nonnegative(),
    multiplier: z.number().positive(),
    new_balance: z.number().int().nonnegative(),
    tier: z.string(),
});

const LoyaltyPointsRedeemedPayload = z.object({
    customer_id: uuidSchema,
    order_id: uuidSchema.optional(),
    points_redeemed: z.number().int().positive(),
    discount_cents: centsSchema,
    new_balance: z.number().int().nonnegative(),
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
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ORDER_COURSE_FIRED"),
        aggregate_type: z.literal("ORDER"),
        payload: OrderCourseFiredPayload,
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

    // PROMOTION events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PROMOTION_APPLIED_TENTATIVE"),
        aggregate_type: z.literal("ORDER"),
        payload: PromotionAppliedTentativePayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PROMOTION_VALIDATED_APPLIED"),
        aggregate_type: z.literal("ORDER"),
        payload: PromotionValidatedAppliedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PROMOTION_REMOVED"),
        aggregate_type: z.literal("ORDER"),
        payload: PromotionRemovedPayload,
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

    // CREDIT NOTE events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CREDIT_NOTE_ISSUED"),
        aggregate_type: z.literal("CREDIT_NOTE"),
        payload: CreditNoteIssuedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CREDIT_NOTE_VOIDED"),
        aggregate_type: z.literal("CREDIT_NOTE"),
        payload: CreditNoteVoidedPayload,
    }),

    // REFUND events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("REFUND_ISSUED"),
        aggregate_type: z.literal("INVOICE"),
        payload: RefundIssuedPayload,
    }),

    // CATALOG events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("CATALOG_VERSION_BUMPED"),
        aggregate_type: z.literal("CATALOG"),
        payload: CatalogVersionBumpedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PRODUCT_MARKED_UNAVAILABLE"),
        aggregate_type: z.literal("CATALOG"),
        payload: ProductMarkedUnavailablePayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PRODUCT_MARKED_AVAILABLE"),
        aggregate_type: z.literal("CATALOG"),
        payload: ProductMarkedAvailablePayload,
    }),

    // SAGA events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_STARTED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaStartedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_STEP_COMPLETED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaStepCompletedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_STEP_FAILED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaStepFailedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_STEP_COMPENSATED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaStepCompensatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_COMPLETED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaCompletedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_COMPENSATED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaCompensatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("SAGA_FAILED"),
        aggregate_type: z.literal("SAGA"),
        payload: SagaFailedPayload,
    }),

    // INVENTORY events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PURCHASE_ORDER_CREATED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: PurchaseOrderCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PURCHASE_ORDER_STATUS_CHANGED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: PurchaseOrderStatusChangedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("GOODS_RECEIVED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: GoodsReceivedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVENTORY_ADJUSTED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: InventoryAdjustedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("WASTE_RECORDED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: WasteRecordedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVENTORY_COUNT_COMPLETED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: InventoryCountCompletedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVENTORY_DEDUCTED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: InventoryDeductedPayload,
    }),

    // PROFITABILITY events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("COGS_CALCULATED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: z.object({
            product_id: uuidSchema,
            cogs_cents: positiveCentsSchema,
            calculation_date: isoDateSchema,
            recipe_version: z.number().int().positive().optional(),
        }),
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INGREDIENT_COST_CHANGED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: z.object({
            inventory_item_id: uuidSchema.nullable(),
            ingredient_id: uuidSchema,
            old_cost_cents: positiveCentsSchema,
            new_cost_cents: positiveCentsSchema,
            changed_by: uuidSchema,
            reason: z.string().optional(),
        }),
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PROFITABILITY_REPORT_GENERATED"),
        aggregate_type: z.literal("INVENTORY"),
        payload: z.object({
            report_id: uuidSchema,
            generated_at: isoDateSchema,
            period_start: isoDateSchema,
            period_end: isoDateSchema,
            total_products: z.number().int().nonnegative(),
            generated_by: uuidSchema,
        }),
    }),

    // DELIVERY events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("DELIVERY_ASSIGNED"),
        aggregate_type: z.literal("ORDER"),
        payload: DeliveryAssignedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("DELIVERY_STATUS_CHANGED"),
        aggregate_type: z.literal("ORDER"),
        payload: DeliveryStatusChangedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("HANDOFF_STATUS_CHANGED"),
        aggregate_type: z.literal("ORDER"),
        payload: HandoffStatusChangedPayload,
    }),

    // PLATFORM events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PLATFORM_ORDER_RECEIVED"),
        aggregate_type: z.literal("ORDER"),
        payload: PlatformOrderReceivedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PLATFORM_ORDER_ACCEPTED"),
        aggregate_type: z.literal("ORDER"),
        payload: PlatformOrderAcceptedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PLATFORM_ORDER_REJECTED"),
        aggregate_type: z.literal("ORDER"),
        payload: PlatformOrderRejectedPayload,
    }),

    // HR events (RRHH)
    BaseEnvelopeSchema.extend({
        event_type: z.literal("EMPLOYEE_CREATED"),
        aggregate_type: z.literal("HR"),
        payload: EmployeeCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("EMPLOYEE_PROFILE_UPDATED"),
        aggregate_type: z.literal("HR"),
        payload: EmployeeProfileUpdatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("EMPLOYEE_DEACTIVATED"),
        aggregate_type: z.literal("HR"),
        payload: EmployeeDeactivatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ATTENDANCE_CLOCKED_IN"),
        aggregate_type: z.literal("HR"),
        payload: AttendanceClockedInPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ATTENDANCE_CLOCKED_OUT"),
        aggregate_type: z.literal("HR"),
        payload: AttendanceClockedOutPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ATTENDANCE_ABSENCE_DETECTED"),
        aggregate_type: z.literal("HR"),
        payload: AttendanceAbsenceDetectedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ATTENDANCE_JUSTIFIED"),
        aggregate_type: z.literal("HR"),
        payload: AttendanceJustifiedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("LEAVE_REQUEST_CREATED"),
        aggregate_type: z.literal("HR"),
        payload: LeaveRequestCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("LEAVE_REQUEST_APPROVED"),
        aggregate_type: z.literal("HR"),
        payload: LeaveRequestApprovedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("LEAVE_REQUEST_REJECTED"),
        aggregate_type: z.literal("HR"),
        payload: LeaveRequestRejectedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ADVANCE_REQUESTED"),
        aggregate_type: z.literal("HR"),
        payload: AdvanceRequestedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("ADVANCE_APPROVED"),
        aggregate_type: z.literal("HR"),
        payload: AdvanceApprovedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("PAYROLL_CALCULATED"),
        aggregate_type: z.literal("HR"),
        payload: PayrollCalculatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("EVALUATION_CREATED"),
        aggregate_type: z.literal("HR"),
        payload: EvaluationCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("TRAINING_COMPLETED"),
        aggregate_type: z.literal("HR"),
        payload: TrainingCompletedPayload,
    }),

    // RESERVATION events (audit trail)
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_CREATED"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationCreatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_CONFIRMED"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationConfirmedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_CANCELLED"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationCancelledPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_ARRIVED"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationArrivedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_SEATED"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationSeatedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("RESERVATION_NO_SHOW"),
        aggregate_type: z.literal("RESERVATION"),
        payload: ReservationNoShowPayload,
    }),

    // SUNAT Electronic Invoicing events
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVOICE_SENT_TO_SUNAT"),
        aggregate_type: z.literal("INVOICE"),
        payload: InvoiceSentToSunatPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVOICE_SUNAT_ACCEPTED"),
        aggregate_type: z.literal("INVOICE"),
        payload: InvoiceSunatAcceptedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("INVOICE_SUNAT_REJECTED"),
        aggregate_type: z.literal("INVOICE"),
        payload: InvoiceSunatRejectedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("DAILY_SUMMARY_SENT"),
        aggregate_type: z.literal("INVOICE"),
        payload: DailySummarySentPayload,
    }),

    // LOYALTY events (store-only)
    BaseEnvelopeSchema.extend({
        event_type: z.literal("LOYALTY_POINTS_EARNED"),
        aggregate_type: z.literal("CUSTOMER"),
        payload: LoyaltyPointsEarnedPayload,
    }),
    BaseEnvelopeSchema.extend({
        event_type: z.literal("LOYALTY_POINTS_REDEEMED"),
        aggregate_type: z.literal("CUSTOMER"),
        payload: LoyaltyPointsRedeemedPayload,
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
export type InvoiceVoidedEvent = Extract<ParkEvent, { event_type: "INVOICE_VOIDED" }>;
export type CreditNoteIssuedEvent = Extract<ParkEvent, { event_type: "CREDIT_NOTE_ISSUED" }>;
export type CreditNoteVoidedEvent = Extract<ParkEvent, { event_type: "CREDIT_NOTE_VOIDED" }>;
export type RefundIssuedEvent = Extract<ParkEvent, { event_type: "REFUND_ISSUED" }>;

// Saga event types
export type SagaStartedEvent = Extract<ParkEvent, { event_type: "SAGA_STARTED" }>;
export type SagaStepCompletedEvent = Extract<ParkEvent, { event_type: "SAGA_STEP_COMPLETED" }>;
export type SagaStepFailedEvent = Extract<ParkEvent, { event_type: "SAGA_STEP_FAILED" }>;
export type SagaStepCompensatedEvent = Extract<ParkEvent, { event_type: "SAGA_STEP_COMPENSATED" }>;
export type SagaCompletedEvent = Extract<ParkEvent, { event_type: "SAGA_COMPLETED" }>;
export type SagaCompensatedEvent = Extract<ParkEvent, { event_type: "SAGA_COMPENSATED" }>;
export type SagaFailedEvent = Extract<ParkEvent, { event_type: "SAGA_FAILED" }>;

// Promotion event types
export type PromotionAppliedTentativeEvent = Extract<ParkEvent, { event_type: "PROMOTION_APPLIED_TENTATIVE" }>;
export type PromotionValidatedAppliedEvent = Extract<ParkEvent, { event_type: "PROMOTION_VALIDATED_APPLIED" }>;
export type PromotionRemovedEvent = Extract<ParkEvent, { event_type: "PROMOTION_REMOVED" }>;

// Course fire event types
export type OrderCourseFiredEvent = Extract<ParkEvent, { event_type: "ORDER_COURSE_FIRED" }>;

// Catalog event types (Auto-86)
export type ProductMarkedUnavailableEvent = Extract<ParkEvent, { event_type: "PRODUCT_MARKED_UNAVAILABLE" }>;
export type ProductMarkedAvailableEvent = Extract<ParkEvent, { event_type: "PRODUCT_MARKED_AVAILABLE" }>;

// Inventory event types
export type PurchaseOrderCreatedEvent = Extract<ParkEvent, { event_type: "PURCHASE_ORDER_CREATED" }>;
export type PurchaseOrderStatusChangedEvent = Extract<ParkEvent, { event_type: "PURCHASE_ORDER_STATUS_CHANGED" }>;
export type GoodsReceivedEvent = Extract<ParkEvent, { event_type: "GOODS_RECEIVED" }>;
export type InventoryAdjustedEvent = Extract<ParkEvent, { event_type: "INVENTORY_ADJUSTED" }>;
export type WasteRecordedEvent = Extract<ParkEvent, { event_type: "WASTE_RECORDED" }>;
export type InventoryCountCompletedEvent = Extract<ParkEvent, { event_type: "INVENTORY_COUNT_COMPLETED" }>;
export type InventoryDeductedEvent = Extract<ParkEvent, { event_type: "INVENTORY_DEDUCTED" }>;

// Delivery event types
export type DeliveryAssignedEvent = Extract<ParkEvent, { event_type: "DELIVERY_ASSIGNED" }>;
export type DeliveryStatusChangedEvent = Extract<ParkEvent, { event_type: "DELIVERY_STATUS_CHANGED" }>;
export type HandoffStatusChangedEvent = Extract<ParkEvent, { event_type: "HANDOFF_STATUS_CHANGED" }>;
// Profitability event types
export type COGSCalculatedEvent = Extract<ParkEvent, { event_type: "COGS_CALCULATED" }>;
export type IngredientCostChangedEvent = Extract<ParkEvent, { event_type: "INGREDIENT_COST_CHANGED" }>;
export type ProfitabilityReportGeneratedEvent = Extract<ParkEvent, { event_type: "PROFITABILITY_REPORT_GENERATED" }>;

// Platform event types
export type PlatformOrderReceivedEvent = Extract<ParkEvent, { event_type: "PLATFORM_ORDER_RECEIVED" }>;
export type PlatformOrderAcceptedEvent = Extract<ParkEvent, { event_type: "PLATFORM_ORDER_ACCEPTED" }>;
export type PlatformOrderRejectedEvent = Extract<ParkEvent, { event_type: "PLATFORM_ORDER_REJECTED" }>;

// HR event types
export type EmployeeCreatedEvent = Extract<ParkEvent, { event_type: "EMPLOYEE_CREATED" }>;
export type EmployeeProfileUpdatedEvent = Extract<ParkEvent, { event_type: "EMPLOYEE_PROFILE_UPDATED" }>;
export type EmployeeDeactivatedEvent = Extract<ParkEvent, { event_type: "EMPLOYEE_DEACTIVATED" }>;
export type AttendanceClockedInEvent = Extract<ParkEvent, { event_type: "ATTENDANCE_CLOCKED_IN" }>;
export type AttendanceClockedOutEvent = Extract<ParkEvent, { event_type: "ATTENDANCE_CLOCKED_OUT" }>;
export type AttendanceAbsenceDetectedEvent = Extract<ParkEvent, { event_type: "ATTENDANCE_ABSENCE_DETECTED" }>;
export type AttendanceJustifiedEvent = Extract<ParkEvent, { event_type: "ATTENDANCE_JUSTIFIED" }>;
export type LeaveRequestCreatedEvent = Extract<ParkEvent, { event_type: "LEAVE_REQUEST_CREATED" }>;
export type LeaveRequestApprovedEvent = Extract<ParkEvent, { event_type: "LEAVE_REQUEST_APPROVED" }>;
export type LeaveRequestRejectedEvent = Extract<ParkEvent, { event_type: "LEAVE_REQUEST_REJECTED" }>;
export type AdvanceRequestedEvent = Extract<ParkEvent, { event_type: "ADVANCE_REQUESTED" }>;
export type AdvanceApprovedEvent = Extract<ParkEvent, { event_type: "ADVANCE_APPROVED" }>;
export type PayrollCalculatedEvent = Extract<ParkEvent, { event_type: "PAYROLL_CALCULATED" }>;
export type EvaluationCreatedEvent = Extract<ParkEvent, { event_type: "EVALUATION_CREATED" }>;
export type TrainingCompletedEvent = Extract<ParkEvent, { event_type: "TRAINING_COMPLETED" }>;

// Reservation event types
export type ReservationCreatedEvent = Extract<ParkEvent, { event_type: "RESERVATION_CREATED" }>;
export type ReservationConfirmedEvent = Extract<ParkEvent, { event_type: "RESERVATION_CONFIRMED" }>;
export type ReservationCancelledEvent = Extract<ParkEvent, { event_type: "RESERVATION_CANCELLED" }>;
export type ReservationArrivedEvent = Extract<ParkEvent, { event_type: "RESERVATION_ARRIVED" }>;
export type ReservationSeatedEvent = Extract<ParkEvent, { event_type: "RESERVATION_SEATED" }>;
export type ReservationNoShowEvent = Extract<ParkEvent, { event_type: "RESERVATION_NO_SHOW" }>;

// SUNAT Electronic Invoicing event types
export type InvoiceSentToSunatEvent = Extract<ParkEvent, { event_type: "INVOICE_SENT_TO_SUNAT" }>;
export type InvoiceSunatAcceptedEvent = Extract<ParkEvent, { event_type: "INVOICE_SUNAT_ACCEPTED" }>;
export type InvoiceSunatRejectedEvent = Extract<ParkEvent, { event_type: "INVOICE_SUNAT_REJECTED" }>;
export type DailySummarySentEvent = Extract<ParkEvent, { event_type: "DAILY_SUMMARY_SENT" }>;

// Loyalty event types
export type LoyaltyPointsEarnedEvent = Extract<ParkEvent, { event_type: "LOYALTY_POINTS_EARNED" }>;
export type LoyaltyPointsRedeemedEvent = Extract<ParkEvent, { event_type: "LOYALTY_POINTS_REDEEMED" }>;

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
