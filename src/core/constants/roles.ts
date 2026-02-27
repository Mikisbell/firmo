/**
 * Shared role label constants — single source of truth.
 *
 * Used by EmployeeProfileButton, EmployeeProfileDrawer, employee portal pages,
 * and any other component that displays human-readable role names.
 *
 * ⚠ Keep in sync with the database enum values.
 */

/** Terminal (hardware) role labels — matches TerminalRole enum */
export const TERMINAL_ROLE_LABELS: Record<string, string> = {
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
