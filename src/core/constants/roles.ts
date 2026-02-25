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
  BAR:        'Barman',
  DRIVER:     'Repartidor(a)',
  DELIVERY:   'Repartidor(a)',
};
