/**
 * Admin Panel Permissions
 * Define permisos por rol para el panel de administración
 * Cubre los 11 roles de EMPLOYEE_ROLES (src/core/constants/roles.ts)
 *
 * Jerarquía: OWNER > ADMIN > MANAGER > SUPERVISOR > CASHIER/WAITER > (sin acceso admin)
 *
 * Requirements: 1.4
 */

import type { EmployeeRole } from '@/src/core/constants/roles';

export interface AdminPermissions {
  // Dashboard
  view_dashboard: boolean;

  // Gestión
  manage_products: boolean;
  manage_employees: boolean;
  manage_terminals: boolean;
  manage_promotions: boolean;
  manage_stations: boolean;
  manage_config: boolean;
  manage_fiscal: boolean; // Solo OWNER

  // Reportes
  view_reports: boolean;
  view_audit: boolean;
}

export type AdminRole = EmployeeRole;

/** Permisos nulos — rol sin acceso al panel admin */
const NO_ACCESS: AdminPermissions = {
  view_dashboard: false,
  manage_products: false,
  manage_employees: false,
  manage_terminals: false,
  manage_promotions: false,
  manage_stations: false,
  manage_config: false,
  manage_fiscal: false,
  view_reports: false,
  view_audit: false,
};

/** Solo dashboard — acceso mínimo al panel */
const DASHBOARD_ONLY: AdminPermissions = {
  ...NO_ACCESS,
  view_dashboard: true,
};

/**
 * Permisos por rol — cubre los 11 EmployeeRole
 * OWNER/ADMIN: acceso total
 * MANAGER: gestión operativa (productos, promos, reportes, config operativa)
 * SUPERVISOR: equipo + reportes
 * CASHIER/WAITER: solo dashboard
 * KITCHEN/COOK/PACKER/BAR/DRIVER: sin acceso al panel admin
 */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermissions> = {
  OWNER: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: true,
    manage_promotions: true,
    manage_stations: true,
    manage_config: true,
    manage_fiscal: true,
    view_reports: true,
    view_audit: true,
  },
  ADMIN: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: true,
    manage_promotions: true,
    manage_stations: true,
    manage_config: true,
    manage_fiscal: false,
    view_reports: true,
    view_audit: true,
  },
  MANAGER: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: false,
    manage_promotions: true,
    manage_stations: true,
    manage_config: true,
    manage_fiscal: false,
    view_reports: true,
    view_audit: false,
  },
  SUPERVISOR: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: true,
    manage_terminals: false,
    manage_promotions: false,
    manage_stations: false,
    manage_config: false,
    manage_fiscal: false,
    view_reports: true,
    view_audit: false,
  },
  CASHIER: DASHBOARD_ONLY,
  WAITER: DASHBOARD_ONLY,
  KITCHEN: NO_ACCESS,
  COOK: NO_ACCESS,
  PACKER: NO_ACCESS,
  BAR: NO_ACCESS,
  DRIVER: NO_ACCESS,
};

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(role: string | null | undefined, permission: keyof AdminPermissions): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as AdminRole;
  const perms = ROLE_PERMISSIONS[normalizedRole];
  if (!perms) return false;
  return perms[permission];
}

/**
 * Verifica si un rol puede acceder a una ruta específica
 */
export function canAccessRoute(role: string | null | undefined, route: string): boolean {
  if (!role) return false;

  const routePermissions: Record<string, keyof AdminPermissions> = {
    '/admin': 'view_dashboard',
    '/admin/productos': 'manage_products',
    '/admin/empleados': 'manage_employees',
    '/admin/terminales': 'manage_terminals',
    '/admin/promociones': 'manage_promotions',
    '/admin/estaciones': 'manage_stations',
    '/admin/configuracion': 'manage_config',
    '/admin/reportes': 'view_reports',
    '/admin/reports/profitability': 'view_reports',
  };

  const permission = routePermissions[route];
  if (!permission) return true; // Ruta no protegida

  return hasPermission(role, permission);
}

/**
 * Obtiene todos los permisos de un rol
 */
export function getPermissionsForRole(role: string | null | undefined): AdminPermissions | null {
  if (!role) return null;
  const normalizedRole = role.toUpperCase() as AdminRole;
  return ROLE_PERMISSIONS[normalizedRole] || null;
}

/**
 * Verifica si un rol tiene al menos view_dashboard (acceso mínimo al panel)
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as AdminRole;
  const perms = ROLE_PERMISSIONS[normalizedRole];
  return !!perms?.view_dashboard;
}

/**
 * Obtiene la jerarquía de roles (mayor número = más permisos)
 */
export function getRoleHierarchy(role: string | null | undefined): number {
  if (!role) return 0;
  const normalizedRole = role.toUpperCase();
  switch (normalizedRole) {
    case 'OWNER': return 5;
    case 'ADMIN': return 4;
    case 'MANAGER': return 3;
    case 'SUPERVISOR': return 2;
    case 'CASHIER':
    case 'WAITER': return 1;
    default: return 0;
  }
}

/**
 * Verifica si roleA tiene permisos >= roleB
 */
export function isRoleAtLeast(roleA: string | null | undefined, roleB: AdminRole): boolean {
  return getRoleHierarchy(roleA) >= getRoleHierarchy(roleB);
}
