// src/core/domain/item-status-machine.ts
// Máquina de estados para items de orden

import type { ItemStatus } from "./events";

// Transiciones válidas de estado
const VALID_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
    PENDING: ["COOKING", "VOIDED"],
    COOKING: ["READY", "PENDING", "VOIDED"], // Allow rollback to PENDING
    READY: ["DONE", "COOKING"],              // Allow rollback to COOKING
    DONE: [],                                 // Terminal state
    VOIDED: [],                               // Terminal state
};

/**
 * Verifica si una transición de estado es válida
 */
export function canTransition(from: ItemStatus, to: ItemStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Obtiene los estados siguientes válidos
 */
export function getNextValidStates(current: ItemStatus): ItemStatus[] {
    return VALID_TRANSITIONS[current] ?? [];
}

/**
 * Verifica si un estado es terminal (no puede cambiar)
 */
export function isTerminalState(status: ItemStatus): boolean {
    return VALID_TRANSITIONS[status]?.length === 0;
}

/**
 * Obtiene el siguiente estado en el flujo normal (sin rollback)
 */
export function getNextNormalState(current: ItemStatus): ItemStatus | null {
    switch (current) {
        case "PENDING": return "COOKING";
        case "COOKING": return "READY";
        case "READY": return "DONE";
        default: return null;
    }
}
