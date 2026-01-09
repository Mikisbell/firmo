/**
 * Property-Based Tests for Admin Role Permissions
 * 
 * Property 1: Jerarquía de Permisos de Rol
 * Para cualquier rol R, los permisos de R deben ser un subconjunto 
 * de los permisos de roles superiores en la jerarquía (OWNER > ADMIN > MANAGER).
 * 
 * Validates: Requirements 1.2, 1.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  AdminRole,
  AdminPermissions,
  ROLE_PERMISSIONS,
  hasPermission,
  getRoleHierarchy,
  isRoleAtLeast,
  isAdminRole,
  getPermissionsForRole,
  canAccessRoute,
} from '../lib/permissions';

// All permission keys
const ALL_PERMISSIONS: (keyof AdminPermissions)[] = [
  'view_dashboard',
  'manage_products',
  'manage_employees',
  'manage_terminals',
  'manage_promotions',
  'manage_stations',
  'manage_config',
  'manage_fiscal',
  'view_reports',
  'view_audit',
];

// Role hierarchy (higher index = more permissions)
const _ADMIN_ROLE_ORDER: AdminRole[] = ['MANAGER', 'ADMIN', 'OWNER'];

// Arbitrary for valid admin roles
const adminRoleArb = fc.constantFrom<AdminRole>('OWNER', 'ADMIN', 'MANAGER');

// Arbitrary for permission keys
const permissionArb = fc.constantFrom<keyof AdminPermissions>(...ALL_PERMISSIONS);

// Arbitrary for any string (including invalid roles)
const anyStringArb = fc.string({ minLength: 0, maxLength: 20 });

describe('Admin Permissions - Property Tests', () => {
  describe('Property 1: Role Hierarchy - Permissions are Subsets', () => {
    it('MANAGER permissions are a subset of ADMIN permissions', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          const managerHas = ROLE_PERMISSIONS.MANAGER[permission];
          const adminHas = ROLE_PERMISSIONS.ADMIN[permission];
          
          // If MANAGER has the permission, ADMIN must also have it
          if (managerHas) {
            expect(adminHas).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('ADMIN permissions are a subset of OWNER permissions', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          const adminHas = ROLE_PERMISSIONS.ADMIN[permission];
          const ownerHas = ROLE_PERMISSIONS.OWNER[permission];
          
          // If ADMIN has the permission, OWNER must also have it
          if (adminHas) {
            expect(ownerHas).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any role pair, higher role has >= permissions than lower role', () => {
      fc.assert(
        fc.property(
          adminRoleArb,
          adminRoleArb,
          permissionArb,
          (roleA, roleB, permission) => {
            const hierarchyA = getRoleHierarchy(roleA);
            const hierarchyB = getRoleHierarchy(roleB);
            
            const permA = ROLE_PERMISSIONS[roleA][permission];
            const permB = ROLE_PERMISSIONS[roleB][permission];
            
            // If roleA is higher in hierarchy and roleB has permission, roleA must have it too
            if (hierarchyA >= hierarchyB && permB) {
              expect(permA).toBe(true);
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: OWNER has all permissions', () => {
    it('OWNER has every permission set to true', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          expect(ROLE_PERMISSIONS.OWNER[permission]).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Role hierarchy values are consistent', () => {
    it('getRoleHierarchy returns correct ordering', () => {
      fc.assert(
        fc.property(adminRoleArb, adminRoleArb, (roleA, roleB) => {
          const hierarchyA = getRoleHierarchy(roleA);
          const hierarchyB = getRoleHierarchy(roleB);
          
          // Verify expected hierarchy values
          expect(getRoleHierarchy('OWNER')).toBe(3);
          expect(getRoleHierarchy('ADMIN')).toBe(2);
          expect(getRoleHierarchy('MANAGER')).toBe(1);
          
          // Hierarchy should be transitive
          if (hierarchyA > hierarchyB) {
            expect(isRoleAtLeast(roleA, roleB)).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: hasPermission is consistent with ROLE_PERMISSIONS', () => {
    it('hasPermission returns same value as direct lookup', () => {
      fc.assert(
        fc.property(adminRoleArb, permissionArb, (role, permission) => {
          const directLookup = ROLE_PERMISSIONS[role][permission];
          const viaFunction = hasPermission(role, permission);
          
          expect(viaFunction).toBe(directLookup);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('hasPermission handles case-insensitive roles', () => {
      fc.assert(
        fc.property(adminRoleArb, permissionArb, (role, permission) => {
          const lowercase = hasPermission(role.toLowerCase(), permission);
          const uppercase = hasPermission(role.toUpperCase(), permission);
          const mixed = hasPermission(
            role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            permission
          );
          
          // All case variations should return the same result
          expect(lowercase).toBe(uppercase);
          expect(uppercase).toBe(mixed);
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Invalid roles return safe defaults', () => {
    it('hasPermission returns false for null/undefined', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          expect(hasPermission(null, permission)).toBe(false);
          expect(hasPermission(undefined, permission)).toBe(false);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('hasPermission returns false for invalid role strings', () => {
      fc.assert(
        fc.property(
          anyStringArb.filter(s => !['OWNER', 'ADMIN', 'MANAGER'].includes(s.toUpperCase())),
          permissionArb,
          (invalidRole, permission) => {
            expect(hasPermission(invalidRole, permission)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getRoleHierarchy returns 0 for invalid roles', () => {
      fc.assert(
        fc.property(
          anyStringArb.filter(s => !['OWNER', 'ADMIN', 'MANAGER'].includes(s.toUpperCase())),
          (invalidRole) => {
            expect(getRoleHierarchy(invalidRole)).toBe(0);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getPermissionsForRole returns null for invalid roles', () => {
      fc.assert(
        fc.property(
          anyStringArb.filter(s => !['OWNER', 'ADMIN', 'MANAGER'].includes(s.toUpperCase())),
          (invalidRole) => {
            expect(getPermissionsForRole(invalidRole)).toBeNull();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: isAdminRole correctly identifies valid roles', () => {
    it('returns true only for valid admin roles', () => {
      fc.assert(
        fc.property(adminRoleArb, (role) => {
          expect(isAdminRole(role)).toBe(true);
          expect(isAdminRole(role.toLowerCase())).toBe(true);
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('returns false for invalid roles', () => {
      fc.assert(
        fc.property(
          anyStringArb.filter(s => !['OWNER', 'ADMIN', 'MANAGER'].includes(s.toUpperCase())),
          (invalidRole) => {
            expect(isAdminRole(invalidRole)).toBe(false);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: isRoleAtLeast is transitive', () => {
    it('if A >= B and B >= C, then A >= C', () => {
      fc.assert(
        fc.property(adminRoleArb, adminRoleArb, adminRoleArb, (roleA, roleB, roleC) => {
          const aGteB = isRoleAtLeast(roleA, roleB);
          const bGteC = isRoleAtLeast(roleB, roleC);
          const aGteC = isRoleAtLeast(roleA, roleC);
          
          if (aGteB && bGteC) {
            expect(aGteC).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: canAccessRoute respects permissions', () => {
    const protectedRoutes: { route: string; permission: keyof AdminPermissions }[] = [
      { route: '/admin', permission: 'view_dashboard' },
      { route: '/admin/productos', permission: 'manage_products' },
      { route: '/admin/empleados', permission: 'manage_employees' },
      { route: '/admin/terminales', permission: 'manage_terminals' },
      { route: '/admin/promociones', permission: 'manage_promotions' },
      { route: '/admin/estaciones', permission: 'manage_stations' },
      { route: '/admin/configuracion', permission: 'manage_config' },
      { route: '/admin/reportes', permission: 'view_reports' },
    ];

    it('canAccessRoute is consistent with hasPermission for protected routes', () => {
      fc.assert(
        fc.property(
          adminRoleArb,
          fc.constantFrom(...protectedRoutes),
          (role, { route, permission }) => {
            const canAccess = canAccessRoute(role, route);
            const hasPerm = hasPermission(role, permission);
            
            expect(canAccess).toBe(hasPerm);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canAccessRoute returns true for unprotected routes', () => {
      fc.assert(
        fc.property(
          adminRoleArb,
          fc.constantFrom('/admin/unknown', '/admin/other', '/random'),
          (role, route) => {
            // Unprotected routes should be accessible
            expect(canAccessRoute(role, route)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
