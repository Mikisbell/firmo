/**
 * Centralized Employee Configuration
 * 
 * This module provides employee IDs that must match between:
 * - prisma/seed.ts (database seeding)
 * - src/core/config/terminal.ts (terminal configuration)
 * - Any code that references specific employees
 * 
 * IMPORTANT: These IDs are for the default/demo tenant only.
 * In production multi-tenant, employees should be loaded from database.
 */

/**
 * Default Employee IDs for demo/development
 * These MUST match the IDs in prisma/seed.ts
 */
export const DEFAULT_EMPLOYEE_IDS = {
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
    /** Generic E2E test user — used by setupRoleTerminal() in e2e/helpers/test-utils.ts */
    E2E_TEST: "00000000-0000-0000-0000-000000000099",
} as const;

/**
 * Employee metadata for seeding and reference
 */
export const DEFAULT_EMPLOYEES = [
    { id: DEFAULT_EMPLOYEE_IDS.ADMIN, name: "Admin Principal", role: "ADMIN", pin: "160902", dni: "43708661" },
    { id: DEFAULT_EMPLOYEE_IDS.CASHIER_MARIA, name: "María García", role: "CASHIER", pin: "1111" },
    { id: DEFAULT_EMPLOYEE_IDS.WAITER_CARLOS, name: "Carlos López", role: "WAITER", pin: "2222" },
    { id: DEFAULT_EMPLOYEE_IDS.WAITER_ANA, name: "Ana Torres", role: "WAITER", pin: "3333" },
    { id: DEFAULT_EMPLOYEE_IDS.PARRILLA_PEDRO, name: "Pedro Ruiz", role: "KITCHEN", pin: "4444" },
    { id: DEFAULT_EMPLOYEE_IDS.KITCHEN_LUIS, name: "Luis Mendoza", role: "KITCHEN", pin: "5555" },
    { id: DEFAULT_EMPLOYEE_IDS.MANAGER_ROSA, name: "Rosa Flores", role: "MANAGER", pin: "0000" },
    { id: DEFAULT_EMPLOYEE_IDS.BAR_JORGE, name: "Jorge Díaz", role: "BAR", pin: "6666" },
    { id: DEFAULT_EMPLOYEE_IDS.WAITER_CARMEN, name: "Carmen Vega", role: "WAITER", pin: "7777" },
    { id: DEFAULT_EMPLOYEE_IDS.DELIVERY_MIGUEL, name: "Miguel Soto", role: "DRIVER", pin: "8888" },
    { id: DEFAULT_EMPLOYEE_IDS.E2E_TEST, name: "Test E2E User", role: "ADMIN", pin: "9999" },
] as const;

/**
 * Get employee IDs (for backward compatibility)
 * In the future, this could load from database or environment
 */
export function getEmployeeIds() {
    return DEFAULT_EMPLOYEE_IDS;
}

/**
 * Get default employees for seeding
 */
export function getDefaultEmployees() {
    return DEFAULT_EMPLOYEES;
}

/**
 * Get admin employee ID
 * Useful for audit trails and system operations
 */
export function getAdminEmployeeId(): string {
    return DEFAULT_EMPLOYEE_IDS.ADMIN;
}

/**
 * Type for employee roles
 */
export type EmployeeRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'COOK' | 'PACKER' | 'BAR' | 'DRIVER';

/**
 * Type for employee data
 */
export type EmployeeData = {
    id: string;
    name: string;
    role: string;
    pin: string;
    dni?: string;
};
