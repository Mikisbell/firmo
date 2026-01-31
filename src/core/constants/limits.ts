/**
 * Límites de Seguridad - PARK POS
 * 
 * Estos límites se validan tanto en CLIENTE como en SERVIDOR
 * para prevenir fraudes y errores.
 * 
 * IMPORTANTE: Dinero siempre en CENTAVOS (int)
 */

export const LIMITS = {
    // === ORDEN ===
    MAX_ITEMS_PER_ORDER: 50,           // Máximo items por orden
    MAX_CHECKS_PER_ORDER: 10,          // Máximo cuentas por orden (split bill)
    MAX_ORDER_TOTAL_CENTS: 100_000_00, // S/100,000 máximo por orden
    
    // === ITEMS ===
    MAX_QUANTITY_PER_LINE: 100,        // Máximo cantidad por línea
    MAX_SINGLE_ITEM_CENTS: 10_000_00,  // S/10,000 máximo por item
    MIN_UNIT_PRICE_CENTS: 0,           // Precio mínimo (puede ser 0 para cortesías)
    
    // === PAGOS ===
    MAX_PAYMENTS_PER_CHECK: 5,         // Máximo métodos de pago por cuenta
    MAX_PAYMENT_AMOUNT_CENTS: 100_000_00, // S/100,000 máximo por pago
    
    // === DESCUENTOS ===
    MAX_DISCOUNT_PERCENT: 100,         // Máximo descuento porcentual
    MAX_DISCOUNT_AMOUNT_CENTS: 50_000_00, // S/50,000 máximo descuento fijo
    
    // === SYNC ===
    MAX_EVENTS_PER_BATCH: 100,         // Máximo eventos por batch de sync
    MAX_JSONB_SIZE_BYTES: 1_000_000,   // 1MB máximo para payload JSONB
    
    // === PROPINAS ===
    MAX_TIP_PERCENT: 50,               // Máximo 50% de propina
    MAX_TIP_AMOUNT_CENTS: 10_000_00,   // S/10,000 máximo propina
    
    // === VOIDS/REFUNDS ===
    VOID_REASON_MIN_LENGTH: 3,         // Mínimo caracteres para razón de void
    MAX_VOID_AMOUNT_CENTS: 50_000_00,  // S/50,000 máximo void sin supervisor
} as const;

// Tipo para TypeScript
export type Limits = typeof LIMITS;

/**
 * Formatea centavos a soles para mensajes de error
 */
export function formatCentsToSoles(cents: number): string {
    return `S/${(cents / 100).toFixed(2)}`;
}

/**
 * Mensajes de error para límites excedidos
 */
export const LIMIT_ERRORS = {
    MAX_ITEMS_EXCEEDED: `Máximo ${LIMITS.MAX_ITEMS_PER_ORDER} items por orden`,
    MAX_CHECKS_EXCEEDED: `Máximo ${LIMITS.MAX_CHECKS_PER_ORDER} cuentas por orden`,
    ORDER_TOTAL_TOO_HIGH: `Total máximo por orden: ${formatCentsToSoles(LIMITS.MAX_ORDER_TOTAL_CENTS)}`,
    INVALID_QUANTITY: `Cantidad debe ser entre 1 y ${LIMITS.MAX_QUANTITY_PER_LINE}`,
    ITEM_PRICE_TOO_HIGH: `Precio máximo por item: ${formatCentsToSoles(LIMITS.MAX_SINGLE_ITEM_CENTS)}`,
    INVALID_PRICE: 'Precio no puede ser negativo',
    MAX_PAYMENTS_EXCEEDED: `Máximo ${LIMITS.MAX_PAYMENTS_PER_CHECK} pagos por cuenta`,
    INVALID_PAYMENT_AMOUNT: 'Monto de pago debe ser positivo',
    PAYMENT_TOO_HIGH: `Pago máximo: ${formatCentsToSoles(LIMITS.MAX_PAYMENT_AMOUNT_CENTS)}`,
    INVALID_DISCOUNT: `Descuento máximo: ${LIMITS.MAX_DISCOUNT_PERCENT}%`,
    DISCOUNT_TOO_HIGH: `Descuento máximo: ${formatCentsToSoles(LIMITS.MAX_DISCOUNT_AMOUNT_CENTS)}`,
    TIP_TOO_HIGH: `Propina máxima: ${LIMITS.MAX_TIP_PERCENT}% o ${formatCentsToSoles(LIMITS.MAX_TIP_AMOUNT_CENTS)}`,
    VOID_REASON_REQUIRED: `Razón de anulación requerida (mínimo ${LIMITS.VOID_REASON_MIN_LENGTH} caracteres)`,
    BATCH_TOO_LARGE: `Máximo ${LIMITS.MAX_EVENTS_PER_BATCH} eventos por batch`,
} as const;
