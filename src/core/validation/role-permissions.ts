/**
 * Role-Based Event Validation
 *
 * Define qué roles pueden emitir qué tipos de eventos.
 * Esto previene que un mesero emita pagos o que cocina cree órdenes.
 *
 * All 11 canonical roles from @/src/core/constants/roles
 */

import type { EventType } from "@/src/core/domain/events";
import { ADMIN_ROLES } from "@/src/core/constants/roles";
import type { EmployeeRole } from "@/src/core/constants/roles";

// Re-export for backward compatibility
export type { EmployeeRole };

// Permisos por rol — all 11 canonical roles
const ROLE_PERMISSIONS: Record<EmployeeRole, Set<EventType>> = {
    // OWNER: Acceso completo (igual que ADMIN)
    OWNER: new Set([
        "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED", "ORDER_ITEM_VOIDED", "ORDER_CANCELLED",
        "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
        "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "INVOICE_ISSUED", "INVOICE_VOIDED", "REFUND_ISSUED",
        "CREDIT_NOTE_ISSUED", "CREDIT_NOTE_VOIDED",
        "CATALOG_VERSION_BUMPED",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // ADMIN: Acceso completo a todos los eventos
    ADMIN: new Set([
        "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED", "ORDER_ITEM_VOIDED", "ORDER_CANCELLED",
        "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
        "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "INVOICE_ISSUED", "INVOICE_VOIDED", "REFUND_ISSUED",
        "CREDIT_NOTE_ISSUED", "CREDIT_NOTE_VOIDED",
        "CATALOG_VERSION_BUMPED",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // MANAGER: Casi todo excepto catálogo
    MANAGER: new Set([
        "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED", "ORDER_ITEM_VOIDED", "ORDER_CANCELLED",
        "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
        "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "INVOICE_ISSUED", "INVOICE_VOIDED", "REFUND_ISSUED",
        "CREDIT_NOTE_ISSUED", "CREDIT_NOTE_VOIDED",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // SUPERVISOR: Igual que MANAGER (sub-gerente)
    SUPERVISOR: new Set([
        "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED", "ORDER_ITEM_VOIDED", "ORDER_CANCELLED",
        "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
        "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "INVOICE_ISSUED", "INVOICE_VOIDED", "REFUND_ISSUED",
        "CREDIT_NOTE_ISSUED", "CREDIT_NOTE_VOIDED",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // CASHIER: Turnos, órdenes, pagos, facturas
    CASHIER: new Set([
        "SHIFT_OPENED", "SHIFT_CLOSED", "CASH_ADJUSTED",
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED",
        "CHECK_CREATED", "CHECK_PAYMENT_ADDED", "CHECK_MARKED_PAID",
        "CHECK_TIP_SET", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "INVOICE_ISSUED",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // WAITER: Crear órdenes, agregar items, NO pagos ni facturas
    WAITER: new Set([
        "ORDER_CREATED", "ORDER_ITEM_ADDED", "ORDER_ITEM_QTY_CHANGED",
        "ORDER_ITEM_STATUS_CHANGED",
        "CHECK_CREATED", "CHECK_ITEMS_UPDATED", "CHECK_ITEMS_MOVED",
        "CHECK_TIP_SET",
        "REQUEST_CHECK", "ORDER_SUBMITTED",
    ]),

    // KITCHEN: Solo cambiar estado de items
    KITCHEN: new Set([
        "ORDER_ITEM_STATUS_CHANGED",
    ]),

    // COOK: Igual que KITCHEN
    COOK: new Set([
        "ORDER_ITEM_STATUS_CHANGED",
    ]),

    // PACKER: Igual que KITCHEN (empaquetado)
    PACKER: new Set([
        "ORDER_ITEM_STATUS_CHANGED",
    ]),

    // BAR: Igual que KITCHEN (preparación bebidas)
    BAR: new Set([
        "ORDER_ITEM_STATUS_CHANGED",
    ]),

    // DRIVER: Solo cambiar estado de items para delivery
    DRIVER: new Set([
        "ORDER_ITEM_STATUS_CHANGED",
    ]),
};

// Reservation events — ADMIN_ROLES can emit admin actions,
// RESERVATION_CREATED and RESERVATION_CANCELLED can also come from public API (system events)
const RESERVATION_ADMIN_EVENTS: EventType[] = [
    "RESERVATION_CONFIRMED",
    "RESERVATION_ARRIVED",
    "RESERVATION_SEATED",
    "RESERVATION_NO_SHOW",
];

const RESERVATION_PUBLIC_EVENTS: EventType[] = [
    "RESERVATION_CREATED",
    "RESERVATION_CANCELLED",
];

// Add reservation events to all roles that need them
// ADMIN_ROLES get all reservation events
for (const role of ["OWNER", "ADMIN", "MANAGER", "SUPERVISOR"] as const) {
    for (const evt of [...RESERVATION_ADMIN_EVENTS, ...RESERVATION_PUBLIC_EVENTS]) {
        ROLE_PERMISSIONS[role].add(evt);
    }
}

// Non-admin roles get only public reservation events (CREATED, CANCELLED)
// so they can appear as actors when the system emits on behalf of a customer
for (const role of ["CASHIER", "WAITER", "KITCHEN", "COOK", "PACKER", "BAR", "DRIVER"] as const) {
    for (const evt of RESERVATION_PUBLIC_EVENTS) {
        ROLE_PERMISSIONS[role].add(evt);
    }
}

// Eventos que requieren autorización de MANAGER/ADMIN
const REQUIRES_MANAGER_APPROVAL: Set<EventType> = new Set([
    "ORDER_ITEM_VOIDED",
    "ORDER_CANCELLED",
    "INVOICE_VOIDED",
    "CASH_ADJUSTED",
    "REFUND_ISSUED",
    "CREDIT_NOTE_VOIDED",
]);

// Eventos que pueden emitirse sin actor (sistema o API publica)
const SYSTEM_EVENTS: Set<EventType> = new Set([
    "CATALOG_VERSION_BUMPED",
    "RESERVATION_CREATED",   // Public API — no auth required
    "RESERVATION_CANCELLED", // Public API — customer can cancel without auth
]);

export interface RoleValidationResult {
    allowed: boolean;
    error?: string;
    details?: {
        role: string;
        event_type: string;
        allowed_events?: string[];
        requires_approval?: boolean;
    };
}

/**
 * Valida si un rol puede emitir un tipo de evento
 */
export function canRoleEmitEvent(
    role: string | null | undefined,
    eventType: EventType
): RoleValidationResult {
    // Eventos de sistema no requieren rol
    if (SYSTEM_EVENTS.has(eventType)) {
        return { allowed: true };
    }

    // Si no hay rol, rechazar (excepto eventos de sistema)
    if (!role) {
        return {
            allowed: false,
            error: "ROLE_REQUIRED",
            details: {
                role: "NONE",
                event_type: eventType,
            },
        };
    }

    // Validar que el rol sea válido
    const normalizedRole = role.toUpperCase() as EmployeeRole;
    if (!ROLE_PERMISSIONS[normalizedRole]) {
        return {
            allowed: false,
            error: "INVALID_ROLE",
            details: {
                role,
                event_type: eventType,
            },
        };
    }

    // Verificar si el rol tiene permiso
    const permissions = ROLE_PERMISSIONS[normalizedRole];
    if (!permissions.has(eventType)) {
        return {
            allowed: false,
            error: "ROLE_NOT_AUTHORIZED",
            details: {
                role: normalizedRole,
                event_type: eventType,
                allowed_events: Array.from(permissions),
            },
        };
    }

    return { allowed: true };
}

/**
 * Verifica si un evento requiere aprobación de manager
 */
export function requiresManagerApproval(eventType: EventType): boolean {
    return REQUIRES_MANAGER_APPROVAL.has(eventType);
}

/**
 * Obtiene los eventos permitidos para un rol
 */
export function getAllowedEventsForRole(role: string): EventType[] {
    const normalizedRole = role.toUpperCase() as EmployeeRole;
    const permissions = ROLE_PERMISSIONS[normalizedRole];
    return permissions ? Array.from(permissions) : [];
}

/**
 * Verifica si un rol puede aprobar acciones que requieren manager
 */
export function canApproveManagerActions(role: string | null | undefined): boolean {
    if (!role) return false;
    return (ADMIN_ROLES as readonly string[]).includes(role.toUpperCase());
}

// Export para testing
export const _ROLE_PERMISSIONS = ROLE_PERMISSIONS;
export const _REQUIRES_MANAGER_APPROVAL = REQUIRES_MANAGER_APPROVAL;
export const _SYSTEM_EVENTS = SYSTEM_EVENTS;
