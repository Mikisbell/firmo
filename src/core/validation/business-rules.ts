/**
 * Server-Side Business Rules Validation
 * 
 * Valida eventos ANTES de proyectarlos para evitar:
 * - Pagos insuficientes
 * - Facturas sin pago
 * - Items inválidos
 * - Voids sin autorización
 */

import { Prisma } from "@prisma/client";
import type { ParkEvent } from "@/src/core/domain/events";
import { LIMITS } from "@/src/core/constants/limits";

// Re-export para compatibilidad
export { LIMITS } from "@/src/core/constants/limits";

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
    switch (event.event_type) {
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

        default:
            return { valid: true };
    }
}

/**
 * Valida CHECK_MARKED_PAID
 * - Pago debe ser >= total del check
 * - Cambio no puede ser mayor al esperado
 */
async function validateCheckMarkedPaid(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        payment?: {
            payments: Array<{ amount_cents: number }>;
        };
        change_cents?: number;
    };

    const order = await tx.order.findUnique({
        where: { id: payload.order_id }
    }) as OrderData | null;

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    const checks = order.checks || [];
    const check = checks.find((c) => c.check_id === payload.check_id);

    if (!check) {
        return { valid: false, error: "CHECK_NOT_FOUND" };
    }

    // Validar que pago >= total
    if (payload.payment?.payments) {
        const totalPaid = payload.payment.payments.reduce(
            (sum, p) => sum + (p.amount_cents || 0),
            0
        );

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
    }

    return { valid: true };
}

/**
 * Valida INVOICE_ISSUED
 * - Check debe estar PAID
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

    const order = await tx.order.findUnique({
        where: { id: payload.order_id }
    }) as OrderData | null;

    if (!order) {
        return { valid: false, error: "ORDER_NOT_FOUND" };
    }

    const checks = order.checks || [];
    const check = checks.find((c) => c.check_id === payload.check_id);

    if (!check) {
        return { valid: false, error: "CHECK_NOT_FOUND" };
    }

    // Check debe estar PAID
    if (check.status !== "PAID") {
        return { valid: false, error: "CHECK_NOT_PAID" };
    }

    // No debe existir factura previa
    const existingInvoice = await tx.invoice.findFirst({
        where: {
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

    // Validar producto si tiene product_id o sku
    if (payload.line.product_id || payload.line.sku) {
        const product = await tx.product.findFirst({
            where: payload.line.product_id
                ? { id: payload.line.product_id }
                : { sku: payload.line.sku, tenant_id: event.tenant_id },
        });

        if (!product || !product.is_active) {
            return { valid: false, error: "PRODUCT_NOT_FOUND" };
        }
    }

    // Validar límite de items por orden
    const order = await tx.order.findUnique({
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
 * - Solo MANAGER o ADMIN pueden anular
 * - Debe tener razón
 */
async function validateItemVoided(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        reason?: string;
    };

    // Validar que tenga razón
    if (!payload.reason || payload.reason.length < 3) {
        return { valid: false, error: "VOID_REASON_REQUIRED" };
    }

    // Validar permisos del actor
    if (event.actor_id) {
        const employee = await tx.employee.findUnique({
            where: { id: event.actor_id },
        });

        if (employee && !["ADMIN", "MANAGER"].includes(employee.role)) {
            return { valid: false, error: "INSUFFICIENT_PERMISSIONS" };
        }
    }

    return { valid: true };
}

/**
 * Valida CHECK_PAYMENT_ADDED
 * - Monto debe ser positivo
 * - No exceder límites
 */
async function validateCheckPaymentAdded(
    tx: Prisma.TransactionClient,
    event: ParkEvent
): Promise<ValidationResult> {
    const payload = event.payload as {
        order_id: string;
        check_id: string;
        payment: {
            amount_cents: number;
            method: string;
        };
    };

    // Validar monto positivo
    if (!payload.payment?.amount_cents || payload.payment.amount_cents <= 0) {
        return { valid: false, error: "INVALID_PAYMENT_AMOUNT" };
    }

    // Validar método de pago
    const validMethods = ["CASH", "CARD", "YAPE", "PLIN", "TRANSFER", "CREDIT"];
    if (!validMethods.includes(payload.payment.method)) {
        return {
            valid: false,
            error: "INVALID_PAYMENT_METHOD",
            details: { method: payload.payment.method, valid: validMethods },
        };
    }

    return { valid: true };
}
