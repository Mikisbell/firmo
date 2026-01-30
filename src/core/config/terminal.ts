// src/core/config/terminal.ts
// Configuración centralizada de terminal

import { DEFAULT_EMPLOYEE_IDS } from './employees';

// Tenant ID - debe coincidir con el seeded en la DB
// TODO P1: Obtener dinámicamente del registro de terminal
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID 
    || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Employee IDs - importados desde employees.ts para consistencia
export const EMPLOYEE_IDS = DEFAULT_EMPLOYEE_IDS;

// Terminal configurations
export const TERMINAL_CONFIG = {
    // Caja principal
    CAJA_01: {
        terminal_id: "CAJA_01",
        actor_id: EMPLOYEE_IDS.CASHIER_MARIA,
        role: "CASHIER",
    },
    // Mozos
    MOZO_01: {
        terminal_id: "MOZO_01",
        actor_id: EMPLOYEE_IDS.WAITER_CARLOS,
        role: "WAITER",
    },
    MOZO_02: {
        terminal_id: "MOZO_02",
        actor_id: EMPLOYEE_IDS.WAITER_ANA,
        role: "WAITER",
    },
    // Pantallas de cocina (SPC = Sistema Pantalla Cocina)
    SPC_COCINA: {
        terminal_id: "SPC_COCINA",
        actor_id: EMPLOYEE_IDS.KITCHEN_LUIS,
        role: "KITCHEN",
    },
    SPC_HORNO: {
        terminal_id: "SPC_HORNO",
        actor_id: EMPLOYEE_IDS.PARRILLA_PEDRO,
        role: "KITCHEN",
    },
    SPC_BAR: {
        terminal_id: "SPC_BAR",
        actor_id: EMPLOYEE_IDS.BAR_JORGE,
        role: "KITCHEN",
    },
    SPC_EMPAQUE: {
        terminal_id: "SPC_EMPAQUE",
        actor_id: EMPLOYEE_IDS.KITCHEN_LUIS, // Can use same employee or create new one
        role: "KITCHEN",
    },
} as const;

export type TerminalId = keyof typeof TERMINAL_CONFIG;

/**
 * Obtiene la configuración de un terminal
 */
export function getTerminalConfig(terminalId: TerminalId) {
    return {
        tenant_id: DEFAULT_TENANT_ID,
        ...TERMINAL_CONFIG[terminalId],
    };
}
