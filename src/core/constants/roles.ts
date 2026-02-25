/**
 * Shared role label constants — single source of truth.
 *
 * Used by EmployeeProfileButton, EmployeeProfileDrawer, employee portal pages,
 * and any other component that displays human-readable role names.
 *
 * ⚠ Keep in sync with the database enum values.
 */

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
