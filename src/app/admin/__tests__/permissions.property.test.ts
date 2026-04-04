/**
 * Property-Based Tests for Admin Role Permissions
 *
 * Cubre los 11 EmployeeRole con jerarquía completa:
 * OWNER > ADMIN > MANAGER > SUPERVISOR > CASHIER/WAITER > (sin acceso: KITCHEN, COOK, PACKER, BAR, DRIVER)
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
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';

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

// Roles con acceso al panel admin (view_dashboard = true)
const ROLES_WITH_DASHBOARD: AdminRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'WAITER'];

// Roles sin acceso al panel admin
const ROLES_WITHOUT_ACCESS: AdminRole[] = ['KITCHEN', 'COOK', 'PACKER', 'BAR', 'DRIVER'];

// Arbitrary para roles con jerarquía definida (para tests de subset)
const hierarchyRoleArb = fc.constantFrom<AdminRole>('OWNER', 'ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'WAITER');

// Arbitrary para todos los EmployeeRole válidos
const allRoleArb = fc.constantFrom<AdminRole>(...(EMPLOYEE_ROLES as unknown as AdminRole[]));

// Arbitrary for permission keys
const permissionArb = fc.constantFrom<keyof AdminPermissions>(...ALL_PERMISSIONS);

// Arbitrary for any string (including invalid roles)
const anyStringArb = fc.string({ minLength: 0, maxLength: 20 });

// Todos los nombres de roles válidos (para filtrar en tests de "invalid role")
const ALL_ROLE_NAMES = EMPLOYEE_ROLES.map(r => r.toUpperCase());

describe('Admin Permissions - Property Tests', () => {
  describe('Property 1: Role Hierarchy - Permissions are Subsets', () => {
    it('SUPERVISOR permissions are a subset of MANAGER permissions', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          if (ROLE_PERMISSIONS.SUPERVISOR[permission]) {
            expect(ROLE_PERMISSIONS.MANAGER[permission]).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('MANAGER permissions are a subset of ADMIN permissions', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          if (ROLE_PERMISSIONS.MANAGER[permission]) {
            expect(ROLE_PERMISSIONS.ADMIN[permission]).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('ADMIN permissions are a subset of OWNER permissions', () => {
      fc.assert(
        fc.property(permissionArb, (permission) => {
          if (ROLE_PERMISSIONS.ADMIN[permission]) {
            expect(ROLE_PERMISSIONS.OWNER[permission]).toBe(true);
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('for any role pair, higher role has >= permissions than lower role', () => {
      fc.assert(
        fc.property(
          hierarchyRoleArb,
          hierarchyRoleArb,
          permissionArb,
          (roleA, roleB, permission) => {
            const hierarchyA = getRoleHierarchy(roleA);
            const hierarchyB = getRoleHierarchy(roleB);

            const permA = ROLE_PERMISSIONS[roleA][permission];
            const permB = ROLE_PERMISSIONS[roleB][permission];

            // Si roleA es mayor en jerarquía y roleB tiene el permiso, roleA también
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

  describe('Property: Roles sin acceso no tienen permisos', () => {
    it('KITCHEN/COOK/PACKER/BAR/DRIVER tienen todos los permisos en false', () => {
      for (const role of ROLES_WITHOUT_ACCESS) {
        for (const perm of ALL_PERMISSIONS) {
          expect(ROLE_PERMISSIONS[role][perm]).toBe(false);
        }
      }
    });
  });

  describe('Property: CASHIER y WAITER solo tienen dashboard', () => {
    it('CASHIER y WAITER solo tienen view_dashboard', () => {
      for (const role of ['CASHIER', 'WAITER'] as AdminRole[]) {
        expect(ROLE_PERMISSIONS[role].view_dashboard).toBe(true);
        for (const perm of ALL_PERMISSIONS.filter(p => p !== 'view_dashboard')) {
          expect(ROLE_PERMISSIONS[role][perm]).toBe(false);
        }
      }
    });
  });

  describe('Property: Role hierarchy values are consistent', () => {
    it('getRoleHierarchy returns correct ordering', () => {
      expect(getRoleHierarchy('OWNER')).toBe(5);
      expect(getRoleHierarchy('ADMIN')).toBe(4);
      expect(getRoleHierarchy('MANAGER')).toBe(3);
      expect(getRoleHierarchy('SUPERVISOR')).toBe(2);
      expect(getRoleHierarchy('CASHIER')).toBe(1);
      expect(getRoleHierarchy('WAITER')).toBe(1);
      expect(getRoleHierarchy('KITCHEN')).toBe(0);
      expect(getRoleHierarchy('COOK')).toBe(0);
      expect(getRoleHierarchy('DRIVER')).toBe(0);
    });

    it('hierarchy is transitive for roles with dashboard access', () => {
      fc.assert(
        fc.property(hierarchyRoleArb, hierarchyRoleArb, (roleA, roleB) => {
          const hierarchyA = getRoleHierarchy(roleA);
          const hierarchyB = getRoleHierarchy(roleB);

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
        fc.property(allRoleArb, permissionArb, (role, permission) => {
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
        fc.property(allRoleArb, permissionArb, (role, permission) => {
          const lowercase = hasPermission(role.toLowerCase(), permission);
          const uppercase = hasPermission(role.toUpperCase(), permission);
          const mixed = hasPermission(
            role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            permission
          );

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
          anyStringArb.filter(s => !ALL_ROLE_NAMES.includes(s.toUpperCase())),
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
          anyStringArb.filter(s => !ALL_ROLE_NAMES.includes(s.toUpperCase())),
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
          anyStringArb.filter(s => !ALL_ROLE_NAMES.includes(s.toUpperCase())),
          (invalidRole) => {
            expect(getPermissionsForRole(invalidRole)).toBeNull();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: isAdminRole identifies roles with dashboard access', () => {
    it('returns true for roles with view_dashboard', () => {
      for (const role of ROLES_WITH_DASHBOARD) {
        expect(isAdminRole(role)).toBe(true);
        expect(isAdminRole(role.toLowerCase())).toBe(true);
      }
    });

    it('returns false for roles without dashboard access', () => {
      for (const role of ROLES_WITHOUT_ACCESS) {
        expect(isAdminRole(role)).toBe(false);
      }
    });

    it('returns false for completely invalid roles', () => {
      fc.assert(
        fc.property(
          anyStringArb.filter(s => !ALL_ROLE_NAMES.includes(s.toUpperCase())),
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
        fc.property(allRoleArb, allRoleArb, allRoleArb, (roleA, roleB, roleC) => {
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
          allRoleArb,
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
          allRoleArb,
          fc.constantFrom('/admin/unknown', '/admin/other', '/random'),
          (role, route) => {
            expect(canAccessRoute(role, route)).toBe(true);
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: ROLE_PERMISSIONS covers all 11 EmployeeRole', () => {
    it('every EmployeeRole has a permissions entry', () => {
      for (const role of EMPLOYEE_ROLES) {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
      }
    });
  });
});
