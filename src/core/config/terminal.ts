// src/core/config/terminal.ts
// Configuración centralizada de terminal

// Tenant ID - debe coincidir con el seeded en la DB
// TODO P1: Obtener dinámicamente del registro de terminal
export const DEFAULT_TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID 
    || "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// Employee IDs fijos - DEBEN coincidir con prisma/seed.ts
export const EMPLOYEE_IDS = {
    ADMIN: "00000000-0000-0000-0000-000000000001",
    CASHIER_MARIA: "00000000-0000-0000-0000-000000000002",
    WAITER_CARLOS: "00000000-0000-0000-0000-000000000003",
    KITCHEN_LUIS: "00000000-0000-0000-0000-000000000004",
    PARRILLA_PEDRO: "00000000-0000-0000-0000-000000000005",
    BAR_JORGE: "00000000-0000-0000-0000-000000000006",
    MANAGER_ROSA: "00000000-0000-0000-0000-000000000007",
    WAITER_ANA: "00000000-0000-0000-0000-000000000008",
    WAITER_CARMEN: "00000000-0000-0000-0000-000000000009",
    DELIVERY_MIGUEL: "00000000-0000-0000-0000-000000000010",
} as const;

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
