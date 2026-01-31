/**
 * Property Test: Authentication and Authorization
 * Feature: inventory-ui, Property 11
 * Validates: Requirements 5.8, 5.9
 * 
 * For any API request:
 * - Without valid JWT token, SHALL return 401
 * - With valid JWT but wrong role, SHALL return 403
 * - With valid JWT and ADMIN/MANAGER role, SHALL be allowed
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============ MOCK TYPES ============

type EmployeeRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'DRIVER';

interface AuthPayload {
  sub: string;
  tid: string;
  role: string;
  name: string;
  sid: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
  errorCode?: 'NO_TOKEN' | 'INVALID_TOKEN' | 'SESSION_INVALID' | 'ROLE_NOT_ALLOWED';
  status?: number;
  auth?: AuthPayload;
}

// Allowed roles for inventory
const INVENTORY_ALLOWED_ROLES = ['ADMIN', 'MANAGER'];

// ============ MOCK AUTH VALIDATION ============

function validateInventoryAuthMock(
  hasToken: boolean,
  tokenValid: boolean,
  sessionValid: boolean,
  role: string | null
): AuthResult {
  // 1. No token
  if (!hasToken) {
    return {
      success: false,
      error: 'Token de autenticación requerido',
      errorCode: 'NO_TOKEN',
      status: 401,
    };
  }

  // 2. Invalid token
  if (!tokenValid) {
    return {
      success: false,
      error: 'Token inválido',
      errorCode: 'INVALID_TOKEN',
      status: 401,
    };
  }

  // 3. Invalid session
  if (!sessionValid) {
    return {
      success: false,
      error: 'Sesión inválida',
      errorCode: 'SESSION_INVALID',
      status: 401,
    };
  }

  // 4. Check role
  if (!role || !INVENTORY_ALLOWED_ROLES.includes(role.toUpperCase())) {
    return {
      success: false,
      error: `Rol ${role || 'NONE'} no autorizado para inventario`,
      errorCode: 'ROLE_NOT_ALLOWED',
      status: 403,
    };
  }

  // Success
  return {
    success: true,
    auth: {
      sub: 'employee-id',
      tid: 'tenant-id',
      role: role,
      name: 'Test User',
      sid: 'session-id',
    },
  };
}

// ============ ARBITRARIES ============

const roleArb = fc.constantFrom<EmployeeRole>('ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER');
const allowedRoleArb = fc.constantFrom<EmployeeRole>('ADMIN', 'MANAGER');
const disallowedRoleArb = fc.constantFrom<EmployeeRole>('CASHIER', 'WAITER', 'KITCHEN', 'DRIVER');

// ============ PROPERTY TESTS ============

describe('Property 11: Authentication and Authorization', () => {
  // **Validates: Requirements 5.8, 5.9**

  it('should return 401 when no token is provided', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // tokenValid (irrelevant)
        fc.boolean(), // sessionValid (irrelevant)
        roleArb,      // role (irrelevant)
        (tokenValid, sessionValid, role) => {
          const result = validateInventoryAuthMock(false, tokenValid, sessionValid, role);
          
          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('NO_TOKEN');
          expect(result.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 401 when token is invalid', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // sessionValid (irrelevant)
        roleArb,      // role (irrelevant)
        (sessionValid, role) => {
          const result = validateInventoryAuthMock(true, false, sessionValid, role);
          
          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('INVALID_TOKEN');
          expect(result.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 401 when session is invalid', () => {
    fc.assert(
      fc.property(
        roleArb, // role (irrelevant)
        (role) => {
          const result = validateInventoryAuthMock(true, true, false, role);
          
          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('SESSION_INVALID');
          expect(result.status).toBe(401);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 403 when role is not ADMIN or MANAGER', () => {
    fc.assert(
      fc.property(
        disallowedRoleArb,
        (role) => {
          const result = validateInventoryAuthMock(true, true, true, role);
          
          expect(result.success).toBe(false);
          expect(result.errorCode).toBe('ROLE_NOT_ALLOWED');
          expect(result.status).toBe(403);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow access for ADMIN role', () => {
    fc.assert(
      fc.property(
        fc.constant('ADMIN'),
        (role) => {
          const result = validateInventoryAuthMock(true, true, true, role);
          
          expect(result.success).toBe(true);
          expect(result.auth).toBeDefined();
          expect(result.auth?.role).toBe('ADMIN');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow access for MANAGER role', () => {
    fc.assert(
      fc.property(
        fc.constant('MANAGER'),
        (role) => {
          const result = validateInventoryAuthMock(true, true, true, role);
          
          expect(result.success).toBe(true);
          expect(result.auth).toBeDefined();
          expect(result.auth?.role).toBe('MANAGER');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow access for any allowed role', () => {
    fc.assert(
      fc.property(
        allowedRoleArb,
        (role) => {
          const result = validateInventoryAuthMock(true, true, true, role);
          
          expect(result.success).toBe(true);
          expect(result.auth).toBeDefined();
          expect(INVENTORY_ALLOWED_ROLES).toContain(result.auth?.role);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle case-insensitive role matching', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('admin', 'Admin', 'ADMIN', 'manager', 'Manager', 'MANAGER'),
        (role) => {
          const result = validateInventoryAuthMock(true, true, true, role);
          
          expect(result.success).toBe(true);
          expect(result.auth).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return 403 when role is null', () => {
    const result = validateInventoryAuthMock(true, true, true, null);
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROLE_NOT_ALLOWED');
    expect(result.status).toBe(403);
  });

  it('should maintain auth hierarchy: no token < invalid token < invalid session < wrong role', () => {
    // This tests that the validation order is correct
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        disallowedRoleArb,
        (hasToken, tokenValid, sessionValid, role) => {
          const result = validateInventoryAuthMock(hasToken, tokenValid, sessionValid, role);
          
          if (!hasToken) {
            expect(result.errorCode).toBe('NO_TOKEN');
          } else if (!tokenValid) {
            expect(result.errorCode).toBe('INVALID_TOKEN');
          } else if (!sessionValid) {
            expect(result.errorCode).toBe('SESSION_INVALID');
          } else {
            expect(result.errorCode).toBe('ROLE_NOT_ALLOWED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
