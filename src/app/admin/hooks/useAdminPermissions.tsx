'use client';

/**
 * useAdminPermissions Hook
 * Hook para verificar permisos del usuario actual en el panel de admin
 * 
 * Requirements: 1.4
 */

import { useMemo } from 'react';
import { 
  AdminPermissions, 
  AdminRole, 
  ROLE_PERMISSIONS,
  hasPermission,
  canAccessRoute,
  isRoleAtLeast,
} from '../lib/permissions';

interface UseAdminPermissionsProps {
  role: string | null | undefined;
}

interface UseAdminPermissionsReturn {
  permissions: AdminPermissions | null;
  hasPermission: (permission: keyof AdminPermissions) => boolean;
  canAccess: (route: string) => boolean;
  isAtLeast: (minRole: AdminRole) => boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
}

/**
 * Hook para verificar permisos del usuario actual
 */
export function useAdminPermissions({ role }: UseAdminPermissionsProps): UseAdminPermissionsReturn {
  const permissions = useMemo(() => {
    if (!role) return null;
    const normalizedRole = role.toUpperCase() as AdminRole;
    return ROLE_PERMISSIONS[normalizedRole] || null;
  }, [role]);

  const checkPermission = useMemo(() => {
    return (permission: keyof AdminPermissions): boolean => {
      return hasPermission(role, permission);
    };
  }, [role]);

  const checkAccess = useMemo(() => {
    return (route: string): boolean => {
      return canAccessRoute(role, route);
    };
  }, [role]);

  const checkIsAtLeast = useMemo(() => {
    return (minRole: AdminRole): boolean => {
      return isRoleAtLeast(role, minRole);
    };
  }, [role]);

  const isOwner = useMemo(() => role?.toUpperCase() === 'OWNER', [role]);
  const isAdmin = useMemo(() => role?.toUpperCase() === 'ADMIN', [role]);
  const isManager = useMemo(() => role?.toUpperCase() === 'MANAGER', [role]);

  return {
    permissions,
    hasPermission: checkPermission,
    canAccess: checkAccess,
    isAtLeast: checkIsAtLeast,
    isOwner,
    isAdmin,
    isManager,
  };
}

/**
 * Componente wrapper para proteger contenido basado en permisos
 */
interface PermissionGateProps {
  children: React.ReactNode;
  permission: keyof AdminPermissions;
  role: string | null | undefined;
  fallback?: React.ReactNode;
}

export function PermissionGate({ 
  children, 
  permission, 
  role, 
  fallback = null 
}: PermissionGateProps) {
  const allowed = hasPermission(role, permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

/**
 * Componente wrapper para proteger contenido basado en rol mínimo
 */
interface RoleGateProps {
  children: React.ReactNode;
  minRole: AdminRole;
  role: string | null | undefined;
  fallback?: React.ReactNode;
}

export function RoleGate({ 
  children, 
  minRole, 
  role, 
  fallback = null 
}: RoleGateProps) {
  const allowed = isRoleAtLeast(role, minRole);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
