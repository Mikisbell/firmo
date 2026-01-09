/**
 * Admin Panel Permissions
 * Define permisos por rol para el panel de administración
 * 
 * Jerarquía: OWNER > ADMIN > MANAGER
 * 
 * Requirements: 1.4
 */

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
  manage_fiscal: boolean;  // Solo OWNER
  
  // Reportes
  view_reports: boolean;
  view_audit: boolean;
}

export type AdminRole = 'OWNER' | 'ADMIN' | 'MANAGER';

/**
 * Permisos por rol
 * Property 1: Los permisos de cada rol son un subconjunto de los roles superiores
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
    manage_fiscal: false,  // No puede configurar fiscal
    view_reports: true,
    view_audit: true,
  },
  MANAGER: {
    view_dashboard: true,
    manage_products: true,
    manage_employees: false,  // No puede gestionar empleados
    manage_terminals: false,  // No puede gestionar terminales
    manage_promotions: true,
    manage_stations: false,
    manage_config: false,
    manage_fiscal: false,
    view_reports: true,
    view_audit: false,
  },
};

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(role: string | null | undefined, permission: keyof AdminPermissions): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase() as AdminRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions[permission];
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
 * Verifica si un rol es válido para el panel de admin
 */
export function isAdminRole(role: string | null | undefined): role is AdminRole {
  if (!role) return false;
  const normalizedRole = role.toUpperCase();
  return normalizedRole === 'OWNER' || normalizedRole === 'ADMIN' || normalizedRole === 'MANAGER';
}

/**
 * Obtiene la jerarquía de roles (mayor número = más permisos)
 */
export function getRoleHierarchy(role: string | null | undefined): number {
  if (!role) return 0;
  const normalizedRole = role.toUpperCase();
  switch (normalizedRole) {
    case 'OWNER': return 3;
    case 'ADMIN': return 2;
    case 'MANAGER': return 1;
    default: return 0;
  }
}

/**
 * Verifica si roleA tiene permisos >= roleB
 */
export function isRoleAtLeast(roleA: string | null | undefined, roleB: AdminRole): boolean {
  return getRoleHierarchy(roleA) >= getRoleHierarchy(roleB);
}
