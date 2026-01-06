/**
 * Validación del lado del CLIENTE
 * 
 * Valida ANTES de crear eventos para dar feedback inmediato
 * y evitar enviar datos inválidos al servidor.
 */

import { LIMITS, LIMIT_ERRORS, formatCentsToSoles } from '@/src/core/constants/limits';

export interface ClientValidationResult {
    valid: boolean;
    error?: string;
    field?: string;
}

/**
 * Valida un item antes de agregarlo a la orden
 */
export function validateAddItem(params: {
    currentItemCount: number;
    currentOrderTotal: number;
    unitPriceCents: number;
    quantity: number;
}): ClientValidationResult {
    const { currentItemCount, currentOrderTotal, unitPriceCents, quantity } = params;

    // Validar cantidad
    if (quantity <= 0 || quantity > LIMITS.MAX_QUANTITY_PER_LINE) {
        return { valid: false, error: LIMIT_ERRORS.INVALID_QUANTITY, field: 'quantity' };
    }

    // Validar precio
    if (unitPriceCents < LIMITS.MIN_UNIT_PRICE_CENTS) {
        return { valid: false, error: LIMIT_ERRORS.INVALID_PRICE, field: 'price' };
    }

    // Validar precio máximo por línea
    const lineTotal = quantity * unitPriceCents;
    if (lineTotal > LIMITS.MAX_SINGLE_ITEM_CENTS) {
        return { valid: false, error: LIMIT_ERRORS.ITEM_PRICE_TOO_HIGH, field: 'price' };
    }

    // Validar límite de items
    if (currentItemCount >= LIMITS.MAX_ITEMS_PER_ORDER) {
        return { valid: false, error: LIMIT_ERRORS.MAX_ITEMS_EXCEEDED, field: 'items' };
    }

    // Validar total de orden
    const newTotal = currentOrderTotal + lineTotal;
    if (newTotal > LIMITS.MAX_ORDER_TOTAL_CENTS) {
        return { valid: false, error: LIMIT_ERRORS.ORDER_TOTAL_TOO_HIGH, field: 'total' };
    }

    return { valid: true };
}

/**
 * Valida un pago antes de agregarlo
 */
export function validateAddPayment(params: {
    amountCents: number;
    currentPaymentCount: number;
    method: string;
}): ClientValidationResult {
    const { amountCents, currentPaymentCount, method } = params;

    // Validar monto positivo
    if (amountCents <= 0) {
        return { valid: false, error: LIMIT_ERRORS.INVALID_PAYMENT_AMOUNT, field: 'amount' };
    }

    // Validar monto máximo
    if (amountCents > LIMITS.MAX_PAYMENT_AMOUNT_CENTS) {
        return { valid: false, error: LIMIT_ERRORS.PAYMENT_TOO_HIGH, field: 'amount' };
    }

    // Validar límite de pagos
    if (currentPaymentCount >= LIMITS.MAX_PAYMENTS_PER_CHECK) {
        return { valid: false, error: LIMIT_ERRORS.MAX_PAYMENTS_EXCEEDED, field: 'payments' };
    }

    // Validar método
    const validMethods = ['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER', 'CREDIT'];
    if (!validMethods.includes(method)) {
        return { valid: false, error: `Método inválido: ${method}`, field: 'method' };
    }

    return { valid: true };
}

/**
 * Valida un descuento antes de aplicarlo
 */
export function validateDiscount(params: {
    type: 'PERCENT' | 'FIXED';
    value: number;
    orderTotalCents: number;
}): ClientValidationResult {
    const { type, value, orderTotalCents } = params;

    if (type === 'PERCENT') {
        if (value < 0 || value > LIMITS.MAX_DISCOUNT_PERCENT) {
            return { valid: false, error: LIMIT_ERRORS.INVALID_DISCOUNT, field: 'discount' };
        }
    } else {
        if (value < 0) {
            return { valid: false, error: 'Descuento no puede ser negativo', field: 'discount' };
        }
        if (value > LIMITS.MAX_DISCOUNT_AMOUNT_CENTS) {
            return { valid: false, error: LIMIT_ERRORS.DISCOUNT_TOO_HIGH, field: 'discount' };
        }
        if (value > orderTotalCents) {
            return { 
                valid: false, 
                error: `Descuento (${formatCentsToSoles(value)}) no puede ser mayor al total (${formatCentsToSoles(orderTotalCents)})`,
                field: 'discount' 
            };
        }
    }

    return { valid: true };
}

/**
 * Valida una propina antes de agregarla
 */
export function validateTip(params: {
    amountCents: number;
    orderTotalCents: number;
}): ClientValidationResult {
    const { amountCents, orderTotalCents } = params;

    if (amountCents < 0) {
        return { valid: false, error: 'Propina no puede ser negativa', field: 'tip' };
    }

    if (amountCents > LIMITS.MAX_TIP_AMOUNT_CENTS) {
        return { valid: false, error: LIMIT_ERRORS.TIP_TOO_HIGH, field: 'tip' };
    }

    // Validar porcentaje máximo
    const tipPercent = (amountCents / orderTotalCents) * 100;
    if (tipPercent > LIMITS.MAX_TIP_PERCENT) {
        return { valid: false, error: LIMIT_ERRORS.TIP_TOO_HIGH, field: 'tip' };
    }

    return { valid: true };
}

/**
 * Valida razón de void/anulación
 */
export function validateVoidReason(reason: string): ClientValidationResult {
    if (!reason || reason.trim().length < LIMITS.VOID_REASON_MIN_LENGTH) {
        return { valid: false, error: LIMIT_ERRORS.VOID_REASON_REQUIRED, field: 'reason' };
    }
    return { valid: true };
}

/**
 * Valida split bill (división de cuenta)
 */
export function validateSplitBill(params: {
    currentCheckCount: number;
}): ClientValidationResult {
    if (params.currentCheckCount >= LIMITS.MAX_CHECKS_PER_ORDER) {
        return { valid: false, error: LIMIT_ERRORS.MAX_CHECKS_EXCEEDED, field: 'checks' };
    }
    return { valid: true };
}
