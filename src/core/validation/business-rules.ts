/**
 * Server-Side Business Rules Validation
 * 
 * Valida eventos ANTES de proyectarlos para evitar:
 * - Pagos insuficientes
 * - Facturas sin pago
 * - Items inválidos
 * - Voids sin autorización
 * - Eventos emitidos por roles no autorizados
 * - Status inválidos
 */

import { Prisma } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";
import { LIMITS } from "@/src/core/constants/limits";
import { 
    canRoleEmitEvent,
    requiresManagerApproval,
    canApproveManagerActions
} from "./role-permissions";
// Status VIVO del item desde la proyección (única fuente, ADR-010). Para la defensa
// server-side de ORDER_ITEM_VOIDED: no anular items en estado terminal (DONE/VOIDED).
import { getItemStatuses } from "@/src/core/projections/order-items.read";
import {
    isValidStatus,
    ORDER_STATUS_VALUES,
    FULFILLMENT_STATUS_VALUES,
    PAYMENT_STATUS_VALUES,
    CHECK_STATUS_VALUES,
    DELIVERY_ORDER_STATUS_VALUES,
} from "@/src/core/domain/db-enums";

// Re-export para compatibilidad
export { LIMITS } from "@/src/core/constants/limits";
export { canRoleEmitEvent, getAllowedEventsForRole } from "./role-permissions";

export interface ValidationResult {
    valid: boolean;
    error?: string;
    details?: Record<string, unknown>;
}

type OrderCheck = {
    check_id: string;
    total_cents: number;
    status: string;
};

type OrderData = {
    id: string;
    tenant_id: string;
    items: unknown[];
    checks: OrderCheck[];
    total_cents: number;
};

/**
 * Valida un evento según reglas de negocio
 */
export async function validateEvent(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    // 1. ROLE-BASED VALIDATION (primero)
    const roleValidation = canRoleEmitEvent(
        event.actor_role_snapshot,
        event.event_type
    );
    
    if (!roleValidation.allowed) {
        return {
            valid: false,
            error: roleValidation.error,
            details: roleValidation.details,
        };
    }

    // 2. MANAGER APPROVAL CHECK
    if (requiresManagerApproval(event.event_type)) {
        // Verificar si el actor puede aprobar o si hay approved_by
        const payload = event.payload as { approved_by?: string };
        
        if (!canApproveManagerActions(event.actor_role_snapshot)) {
            // Si el actor no es manager, debe haber un approved_by
            if (!payload.approved_by) {
                return {
                    valid: false,
                    error: "MANAGER_APPROVAL_REQUIRED",
                    details: {
                        event_type: event.event_type,
                        actor_role: event.actor_role_snapshot,
                    },
                };
            }
            
            // Verificar que approved_by sea un manager/admin
            const approver = await tx.employees.findUnique({
                where: { id: payload.approved_by },
                select: { role: true, is_active: true },
            });
            
            if (!approver || !approver.is_active) {
                return { valid: false, error: "APPROVER_NOT_FOUND" };
            }
            
            if (!canApproveManagerActions(approver.role)) {
                return {
                    valid: false,
                    error: "APPROVER_NOT_AUTHORIZED",
                    details: { approver_role: approver.role },
                };
            }
        }
    }

    // 3. EVENT-SPECIFIC VALIDATION
    switch (event.event_type) {
        case "ORDER_CREATED":
            return validateOrderCreated(tx, event);

        case "CHECK_MARKED_PAID":
            return validateCheckMarkedPaid(tx, event);

        case "INVOICE_ISSUED":
            return validateInvoiceIssued(tx, event);

        case "ORDER_ITEM_ADDED":
            return validateOrderItemAdded(tx, event);

        case "ORDER_ITEM_VOIDED":
            return validateItemVoided(tx, event);

        case "CHECK_PAYMENT_ADDED":
            return validateCheckPaymentAdded(tx, event);

        case "REQUEST_CHECK":
            return validateRequestCheck(tx, event);

        case "ORDER_SUBMITTED":
            return validateOrderSubmitted(tx, event);

        case "ORDER_CANCELLED":
            return validateOrderCancelled(tx, event);

        case "REFUND_ISSUED":
            return validateRefundIssued(tx, event);

        // RESERVATION events are audit-only (state-of-record is the reservations table)
        // Business rule validation happens in the reservation service layer, not here
        case "RESERVATION_CREATED":
        case "RESERVATION_CONFIRMED":
        case "RESERVATION_CANCELLED":
        case "RESERVATION_ARRIVED":
        case "RESERVATION_SEATED":
        case "RESERVATION_NO_SHOW":
            return { valid: true };

        default:
            return { valid: true };
    }
}

/**
 * Valida ORDER_CREATED
 * - Debe haber un turno OPEN en la terminal
 * - Terminal debe tener rango asignado
 * - order_number debe estar dentro del rango del terminal
 *
 * **Requirement 4.3:** Validación de order_number en rango asignado
 * **Requirement C2:** Turno obligatorio para crear órdenes
 */
async function validateOrderCreated(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_number: number;
    };

    // C2: Verificar turno abierto en la terminal
    const openShift = await tx.shifts.findFirst({
        where: {
            tenant_id: event.tenant_id,
            terminal_id: event.terminal_id,
            status: "OPEN",
        },
        select: { id: true },
    });

    if (!openShift) {
        return {
            valid: false,
            error: "NO_OPEN_SHIFT",
            details: {
                terminal_id: event.terminal_id,
                message: "No hay turno abierto en esta terminal. Abra un turno antes de crear órdenes.",
            },
        };
    }

    // Obtener rango del terminal
    const range = await tx.terminal_number_ranges.findUnique({
        where: { 
            tenant_id_terminal_id: {
                tenant_id: event.tenant_id,
                terminal_id: event.terminal_id
            }
        }
    });

    if (!range) {
        return { 
            valid: false, 
            error: "NO_RANGE_ALLOCATED",
            details: { terminal_id: event.terminal_id }
        };
    }

    // Validar que order_number esté en el rango
    if (payload.order_number < range.range_start || 
        payload.order_number > range.range_end) {
        return {
            valid: false,
            error: "ORDER_NUMBER_OUT_OF_RANGE",
            details: {
                order_number: payload.order_number,
                range_start: range.range_start,
                range_end: range.range_end,
                terminal_id: event.terminal_id
            }
        };
    }

    return { valid: true };
}

/**
 * Valida CHECK_MARKED_PAID
 * - Check debe existir
 * - Pagos acumulados en el check deben ser >= total
 * - Cambio no puede ser mayor al esperado
 * 
 * NOTA: El evento CHECK_MARKED_PAID no tiene payment.payments en su schema.
 * Los pagos se agregan previamente via CHECK_PAYMENT_ADDED.
 * Esta validación verifica que los pagos acumulados sean suficientes.
 */
async function validateCheckMarkedPaid(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        change_cents?: number;
    };

    const order = await tx.orders.findUnique({
        where: { id: payload.order_id }
    }) as OrderData | null;

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    const checks = order.checks || [];
    const check = checks.find((c) => c.check_id === payload.check_id) as {
        check_id: string;
        total_cents: number;
        payment?: {
            status: string;
            payments: Array<{ amount_cents: number }>;
        };
    } | undefined;

    if (!check) {
        return { valid: false, error: "CHECK_NOT_FOUND" };
    }

    // Validar que los pagos acumulados en el check sean >= total
    const totalPaid = check.payment?.payments?.reduce(
        (sum, p) => sum + (p.amount_cents || 0),
        0
    ) || 0;

    if (totalPaid < check.total_cents) {
        return {
            valid: false,
            error: "INSUFFICIENT_PAYMENT",
            details: {
                required: check.total_cents,
                received: totalPaid,
                missing: check.total_cents - totalPaid,
            },
        };
    }

    // Validar cambio
    const expectedChange = totalPaid - check.total_cents;
    if (payload.change_cents && payload.change_cents > expectedChange) {
        return {
            valid: false,
            error: "INVALID_CHANGE",
            details: {
                expected: expectedChange,
                claimed: payload.change_cents,
            },
        };
    }

    return { valid: true };
}

/**
 * Valida INVOICE_ISSUED
 * - Check debe estar PAID (check.payment.status === "PAID")
 * - No debe existir factura previa
 */
async function validateInvoiceIssued(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        series?: string;
        invoice_number?: string;
    };

    const order = await tx.orders.findUnique({
        where: { id: payload.order_id }
    }) as OrderData | null;

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    const checks = order.checks || [];
    const check = checks.find((c) => c.check_id === payload.check_id) as {
        check_id: string;
        total_cents: number;
        payment?: {
            status: string;
            payments: Array<{ amount_cents: number }>;
        };
    } | undefined;

    if (!check) {
        return { valid: false, error: "CHECK_NOT_FOUND" };
    }

    // Check debe estar PAID (status está dentro de payment)
    if (check.payment?.status !== "PAID") {
        return { valid: false, error: "CHECK_NOT_PAID" };
    }

    // No debe existir factura previa
    const existingInvoice = await tx.invoices.findFirst({
        where: {
            tenant_id: order.tenant_id,
            order_id: payload.order_id,
            check_id: payload.check_id,
            status: { not: "VOIDED" },
        },
    });

    if (existingInvoice) {
        return { valid: false, error: "INVOICE_ALREADY_EXISTS" };
    }

    return { valid: true };
}

/**
 * Valida ORDER_ITEM_ADDED
 * - Producto debe existir y estar activo
 * - C4: Precio del cliente debe coincidir con catálogo (server-side price validation)
 * - Precio no negativo
 * - Cantidad válida
 * - No exceder límites
 */
async function validateOrderItemAdded(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        line: {
            product_id?: string;
            sku?: string;
            unit_price_cents: number;
            quantity?: number;
            qty?: number;
        };
    };

    const quantity = payload.line.quantity || payload.line.qty || 1;

    // Validar cantidad
    if (quantity <= 0 || quantity > LIMITS.MAX_QUANTITY_PER_LINE) {
        return {
            valid: false,
            error: "INVALID_QUANTITY",
            details: { quantity, max: LIMITS.MAX_QUANTITY_PER_LINE },
        };
    }

    // Validar precio
    if (payload.line.unit_price_cents < 0) {
        return { valid: false, error: "INVALID_PRICE" };
    }

    // Validar precio máximo por item
    const lineTotal = quantity * payload.line.unit_price_cents;
    if (lineTotal > LIMITS.MAX_SINGLE_ITEM_CENTS) {
        return {
            valid: false,
            error: "ITEM_PRICE_TOO_HIGH",
            details: { lineTotal, max: LIMITS.MAX_SINGLE_ITEM_CENTS },
        };
    }

    // UUID regex pattern
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Validar producto si tiene product_id o sku
    if (payload.line.product_id || payload.line.sku) {
        // Validate product_id is a valid UUID before querying
        if (payload.line.product_id && !UUID_REGEX.test(payload.line.product_id)) {
            return { 
                valid: false, 
                error: "INVALID_PRODUCT_ID",
                details: { product_id: payload.line.product_id, reason: "UUID no válido" }
            };
        }

        const product = await tx.products.findFirst({
            where: payload.line.product_id
                ? { id: payload.line.product_id }
                : { sku: payload.line.sku, tenant_id: event.tenant_id },
        });

        if (!product || !product.is_active) {
            return { valid: false, error: "PRODUCT_NOT_FOUND" };
        }

        // C4: Server-side price validation — reject if client price differs from catalog
        if (product.price_cents !== undefined && product.price_cents !== null) {
            const catalogPrice = Number(product.price_cents);
            const clientPrice = payload.line.unit_price_cents;
            if (clientPrice !== catalogPrice) {
                return {
                    valid: false,
                    error: "PRICE_MISMATCH",
                    details: {
                        product_id: product.id,
                        catalog_price_cents: catalogPrice,
                        client_price_cents: clientPrice,
                        message: "El precio del cliente no coincide con el catálogo. Posible manipulación de precio.",
                    },
                };
            }
        }
    }

    // Validar límite de items por orden
    const order = await tx.orders.findUnique({
        where: { id: payload.order_id }
    }) as OrderData | null;

    if (order) {
        const items = order.items as unknown[] || [];
        if (items.length >= LIMITS.MAX_ITEMS_PER_ORDER) {
            return {
                valid: false,
                error: "MAX_ITEMS_EXCEEDED",
                details: { current: items.length, max: LIMITS.MAX_ITEMS_PER_ORDER },
            };
        }

        // Validar total de orden
        const newTotal = order.total_cents + lineTotal;
        if (newTotal > LIMITS.MAX_ORDER_TOTAL_CENTS) {
            return {
                valid: false,
                error: "ORDER_TOTAL_TOO_HIGH",
                details: { newTotal, max: LIMITS.MAX_ORDER_TOTAL_CENTS },
            };
        }
    }

    return { valid: true };
}

/**
 * Valida ITEM_VOIDED
 * - Debe tener razón
 * - Permisos ya validados en validateEvent()
 */
async function validateItemVoided(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id?: string;
        line_id?: string;
        reason?: string;
    };

    // Validar que tenga razón
    if (!payload.reason || payload.reason.length < 3) {
        return { valid: false, error: "VOID_REASON_REQUIRED" };
    }

    // Validar que la orden existe y el item existe
    if (payload.order_id && payload.line_id) {
        const order = await tx.orders.findUnique({
            where: { id: payload.order_id },
            select: { id: true, items: true, order_status: true },
        });

        if (!order) {
            return { valid: false, error: "ORDER_NOT_FOUND" };
        }

        if (order.order_status === "CANCELLED" || order.order_status === "CONFIRMED") {
            return {
                valid: false,
                error: "ORDER_NOT_MODIFIABLE",
                details: { status: order.order_status }
            };
        }

        // DEFENSA server-side (no confiar en el cliente): el item NO debe estar en un
        // estado TERMINAL. El front respeta canTransition (no ofrece VOID en DONE/VOIDED),
        // pero un evento offline/manipulado podría intentar anular un item DONE — que YA
        // dedujo inventario (ORDER_ITEM_STATUS_CHANGED->DONE en project-event) — y borrar la
        // proyección sin reversar el stock lo descuadraría. DONE/VOIDED son terminales
        // (item-status-machine). Leemos el status VIVO de la proyección (ADR-010).
        if (payload.line_id) {
            const statuses = await getItemStatuses(tx, event.tenant_id, payload.order_id);
            const itemStatus = statuses.get(payload.line_id)?.status;
            if (itemStatus === "DONE" || itemStatus === "VOIDED") {
                return {
                    valid: false,
                    error: "ITEM_NOT_VOIDABLE",
                    details: { line_id: payload.line_id, status: itemStatus },
                };
            }
        }
    }

    // Permisos de manager ya validados en validateEvent()
    return { valid: true };
}

/**
 * Valida CHECK_PAYMENT_ADDED
 * - Debe haber un turno OPEN en la terminal (C2)
 * - Monto debe ser positivo
 * - No exceder límites
 * - Guard de sobrepago (max 150% del total del check)
 * - Idempotency: rechazar duplicados por idempotency_key
 */
async function validateCheckPaymentAdded(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        idempotency_key?: string;
        payment: {
            amount_cents: number;
            method: string;
        };
    };

    // C2: Verificar turno abierto en la terminal
    const openShift = await tx.shifts.findFirst({
        where: {
            tenant_id: event.tenant_id,
            terminal_id: event.terminal_id,
            status: "OPEN",
        },
        select: { id: true },
    });

    if (!openShift) {
        return {
            valid: false,
            error: "NO_OPEN_SHIFT",
            details: {
                terminal_id: event.terminal_id,
                message: "No hay turno abierto en esta terminal. Abra un turno antes de registrar pagos.",
            },
        };
    }

    // Validar monto positivo
    if (!payload.payment?.amount_cents || payload.payment.amount_cents <= 0) {
        return { valid: false, error: "INVALID_PAYMENT_AMOUNT" };
    }

    // Validar método de pago (debe coincidir con PaymentMethodSchema en events.ts)
    const validMethods = ["CASH", "CARD", "YAPE", "PLIN", "TRANSFER"];
    if (!validMethods.includes(payload.payment.method)) {
        return {
            valid: false,
            error: "INVALID_PAYMENT_METHOD",
            details: { method: payload.payment.method, valid: validMethods },
        };
    }

    // Overpayment guard: check_total * 1.5 max (allows cash rounding)
    const order = await tx.orders.findUnique({
        where: { id: payload.order_id },
        select: { id: true, checks: true, order_status: true },
    });

    if (order && order.order_status === "CANCELLED") {
        return { valid: false, error: "ORDER_CANCELLED" };
    }

    if (order?.checks) {
        const checks = order.checks as any[];
        const check = checks.find((c: any) => c.check_id === payload.check_id);
        if (check && check.total_cents > 0) {
            const existingPaid = (check.payment?.payments || [])
                .reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0);
            const newTotal = existingPaid + payload.payment.amount_cents;
            const maxAllowed = Math.ceil(check.total_cents * 1.5);
            if (newTotal > maxAllowed) {
                return {
                    valid: false,
                    error: "OVERPAYMENT_DETECTED",
                    details: {
                        total_paid_after: newTotal,
                        check_total: check.total_cents,
                        max_allowed: maxAllowed,
                    },
                };
            }
        }
    }

    return { valid: true };
}

/**
 * Valida REQUEST_CHECK
 * - Order debe existir
 * - Order no debe estar cancelada
 */
async function validateRequestCheck(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
    };

    const order = await tx.orders.findUnique({
        where: { id: payload.order_id },
        select: { id: true, order_status: true },
    });

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    if (order.order_status === "CANCELLED") {
        return { valid: false, error: "ORDER_CANCELLED" };
    }

    return { valid: true };
}

/**
 * Valida ORDER_SUBMITTED
 * - Order debe existir
 * - Order debe tener items
 * - Order no debe estar cancelada
 */
async function validateOrderSubmitted(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        items_by_station: Record<string, unknown[]>;
    };

    const order = await tx.orders.findUnique({
        where: { id: payload.order_id },
        select: { id: true, order_status: true, items: true },
    });

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    if (order.order_status === "CANCELLED") {
        return { valid: false, error: "ORDER_CANCELLED" };
    }

    // Verificar que hay items en el payload
    const totalItems = Object.values(payload.items_by_station || {}).reduce(
        (sum, items) => sum + (items?.length || 0),
        0
    );

    if (totalItems === 0) {
        return { valid: false, error: "NO_ITEMS_TO_SUBMIT" };
    }

    return { valid: true };
}

/**
 * Valida ORDER_CANCELLED
 * - Order debe existir
 * - Order no debe estar ya cancelada o confirmada
 * - Debe tener razón
 * - Si hay pagos, advertir (pero permitir con manager approval)
 */
async function validateOrderCancelled(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        reason?: string;
    };

    // Validar razón
    if (!payload.reason || payload.reason.length < 3) {
        return { valid: false, error: "CANCEL_REASON_REQUIRED" };
    }

    const order = await tx.orders.findUnique({
        where: { id: payload.order_id },
        select: { 
            id: true, 
            order_status: true, 
            checks: true,
            total_cents: true 
        },
    }) as {
        id: string;
        order_status: string;
        checks: Array<{
            payment?: {
                status: string;
                payments: Array<{ amount_cents: number }>;
            };
        }>;
        total_cents: number;
    } | null;

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    // No se puede cancelar una orden ya cancelada
    if (order.order_status === "CANCELLED") {
        return { valid: false, error: "ORDER_ALREADY_CANCELLED" };
    }

    // No se puede cancelar una orden confirmada (facturada)
    if (order.order_status === "CONFIRMED") {
        return { 
            valid: false, 
            error: "ORDER_ALREADY_CONFIRMED",
            details: { 
                message: "Use INVOICE_VOIDED + nota de crédito para órdenes confirmadas" 
            }
        };
    }

    // Verificar si hay pagos - advertir pero permitir (manager approval ya validado)
    const checks = order.checks || [];
    const totalPaid = checks.reduce((sum, check) => {
        const payments = check.payment?.payments || [];
        return sum + payments.reduce((pSum, p) => pSum + (p.amount_cents || 0), 0);
    }, 0);

    if (totalPaid > 0) {
        // Pagos existen - esto requiere devolución manual
        // El manager approval ya fue validado en validateEvent()
        return { 
            valid: true,
            details: {
                warning: "ORDER_HAS_PAYMENTS",
                total_paid_cents: totalPaid,
                requires_refund: true
            }
        };
    }

    return { valid: true };
}


// ============================================
// Status Validation Helpers
// ============================================

/**
 * Valida que un status de orden sea válido
 */
export function validateOrderStatus(status: string): ValidationResult {
    if (!isValidStatus(status, ORDER_STATUS_VALUES)) {
        return {
            valid: false,
            error: "INVALID_ORDER_STATUS",
            details: { status, valid: ORDER_STATUS_VALUES },
        };
    }
    return { valid: true };
}

/**
 * Valida que un status de fulfillment sea válido
 */
export function validateFulfillmentStatus(status: string): ValidationResult {
    if (!isValidStatus(status, FULFILLMENT_STATUS_VALUES)) {
        return {
            valid: false,
            error: "INVALID_FULFILLMENT_STATUS",
            details: { status, valid: FULFILLMENT_STATUS_VALUES },
        };
    }
    return { valid: true };
}

/**
 * Valida que un status de pago sea válido
 */
export function validatePaymentStatus(status: string): ValidationResult {
    if (!isValidStatus(status, PAYMENT_STATUS_VALUES)) {
        return {
            valid: false,
            error: "INVALID_PAYMENT_STATUS",
            details: { status, valid: PAYMENT_STATUS_VALUES },
        };
    }
    return { valid: true };
}

/**
 * Valida que un status de check sea válido
 */
export function validateCheckStatus(status: string): ValidationResult {
    if (!isValidStatus(status, CHECK_STATUS_VALUES)) {
        return {
            valid: false,
            error: "INVALID_CHECK_STATUS",
            details: { status, valid: CHECK_STATUS_VALUES },
        };
    }
    return { valid: true };
}

/**
 * Valida REFUND_ISSUED
 * - La orden debe existir
 * - refund_amount no puede exceder original_amount
 * - La orden debe tener pagos (no se puede reembolsar sin pago)
 */
async function validateRefundIssued(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        original_amount: number;
        refund_amount: number;
    };

    // Verificar que la orden existe
    const order = await tx.orders.findUnique({
        where: { id: payload.order_id },
        select: { id: true, order_status: true },
    });

    if (!order) {
        return {
            valid: false,
            error: "ORDER_NOT_FOUND",
            details: { order_id: payload.order_id },
        };
    }

    // refund_amount no puede exceder original_amount
    if (payload.refund_amount > payload.original_amount) {
        return {
            valid: false,
            error: "REFUND_EXCEEDS_ORIGINAL",
            details: {
                refund_amount: payload.refund_amount,
                original_amount: payload.original_amount,
            },
        };
    }

    // Verificar que existen pagos para esta orden
    const paymentCount = await tx.payments.count({
        where: { tenant_id: event.tenant_id, order_id: payload.order_id },
    });

    if (paymentCount === 0) {
        return {
            valid: false,
            error: "NO_PAYMENTS_TO_REFUND",
            details: { order_id: payload.order_id },
        };
    }

    return { valid: true };
}

/**
 * Valida que un status de delivery order sea válido
 */
export function validateDeliveryOrderStatus(status: string): ValidationResult {
    if (!isValidStatus(status, DELIVERY_ORDER_STATUS_VALUES)) {
        return {
            valid: false,
            error: "INVALID_DELIVERY_STATUS",
            details: { status, valid: DELIVERY_ORDER_STATUS_VALUES },
        };
    }
    return { valid: true };
}
