/**
 * Shared role label constants — single source of truth.
 *
 * Used by EmployeeProfileButton, EmployeeProfileDrawer, employee portal pages,
 * and any other component that displays human-readable role names.
 *
 * ⚠ Keep in sync with the database enum values.
 */

/**
 * Canonical terminal (hardware) roles — single source of truth.
 * English vocabulary only. Used by terminal-registry.ts, session-v2.ts, and auth/types.ts.
 * NOTE: session-v2.ts and terminal-registry.ts still use the legacy Spanish vocabulary
 * ('CAJA' | 'MOZO' | 'KDS_COCINA' | 'KDS_HORNO' | 'KDS_BAR') for DB-stored values.
 * TODO: migrate DB terminal_devices.role column and all consumers to this English enum.
 */
export const TERMINAL_ROLES = ['CASHIER', 'WAITER', 'KDS', 'BAR', 'ADMIN'] as const;
export type TerminalRole = (typeof TERMINAL_ROLES)[number];

/** Terminal (hardware) role labels — matches TerminalRole enum */
export const TERMINAL_ROLE_LABELS: Record<string, string> = {
  CASHIER: 'Caja',
  WAITER:  'Mesero',
  KDS:     'Cocina / KDS',
  BAR:     'Bar',
  ADMIN:   'Administrador',
  // Legacy Spanish keys kept for backward-compat while migration is pending
  CAJA:      'Caja',
  MOZO:      'Mesero',
  KDS_COCINA: 'Cocina',
  KDS_HORNO:  'Horno',
  KDS_BAR:    'Bar',
};

/** Canonical list of all employee roles */
export const EMPLOYEE_ROLES = ['OWNER','ADMIN','MANAGER','SUPERVISOR','CASHIER','WAITER','KITCHEN','COOK','PACKER','BAR','DRIVER'] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

/** Roles with admin panel access */
export const ADMIN_ROLES = ['OWNER','ADMIN','MANAGER','SUPERVISOR'] as const;
export type AdminAccessRole = (typeof ADMIN_ROLES)[number];

/** Kitchen-related roles */
export const KITCHEN_ROLES = ['KITCHEN','COOK','PACKER'] as const;

/** Employee role labels — matches EmployeeRole enum */
export const ROLE_LABELS: Record<string, string> = {
  OWNER:      'Propietario',
  ADMIN:      'Administrador',
  MANAGER:    'Gerente',
  SUPERVISOR: 'Supervisor(a)',
  CASHIER:    'Cajero(a)',
  WAITER:     'Mesero(a)',
  KITCHEN:    'Cocina',
  COOK:       'Cocinero(a)',
  PACKER:     'Empaquetador(a)',
  BAR:        'Barman',
  DRIVER:     'Motorizado(a)',
};
