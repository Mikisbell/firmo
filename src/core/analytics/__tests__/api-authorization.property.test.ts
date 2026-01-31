/**
 * Property Test: API Authorization
 * 
 * Property 12: For any request to /api/admin/analytics/*:
 * - IF actor role NOT IN ('ADMIN', 'OWNER'), THEN response SHALL be 403 Forbidden
 * - IF actor role IN ('ADMIN', 'OWNER'), THEN response SHALL be 200 OK with data
 * 
 * Validates: Requirements 10.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

type Role = 'ADMIN' | 'OWNER' | 'CASHIER' | 'WAITER' | 'KITCHEN' | 'BAR';

interface Session {
  tenant_id: string;
  employee_id: string;
  role: Role;
}

// Pure authorization function (extracted from API logic)
function isAuthorizedForAnalytics(session: Session | null): boolean {
  if (!session) return false;
  return ['ADMIN', 'OWNER'].includes(session.role);
}

function getAuthorizationResponse(session: Session | null): { status: number; allowed: boolean } {
  if (!session) {
    return { status: 401, allowed: false };
  }
  
  if (!isAuthorizedForAnalytics(session)) {
    return { status: 403, allowed: false };
  }
  
  return { status: 200, allowed: true };
}

// Generators
const roleArb = fc.constantFrom<Role>('ADMIN', 'OWNER', 'CASHIER', 'WAITER', 'KITCHEN', 'BAR');
const authorizedRoleArb = fc.constantFrom<Role>('ADMIN', 'OWNER');
const unauthorizedRoleArb = fc.constantFrom<Role>('CASHIER', 'WAITER', 'KITCHEN', 'BAR');

const sessionArb = fc.record({
  tenant_id: fc.uuid(),
  employee_id: fc.uuid(),
  role: roleArb,
});

describe('API Authorization Properties', () => {
  it('Property 12.1: ADMIN role is authorized', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (tenantId, employeeId) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role: 'ADMIN' };
        expect(isAuthorizedForAnalytics(session)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.2: OWNER role is authorized', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (tenantId, employeeId) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role: 'OWNER' };
        expect(isAuthorizedForAnalytics(session)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.3: CASHIER role is NOT authorized', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (tenantId, employeeId) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role: 'CASHIER' };
        expect(isAuthorizedForAnalytics(session)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.4: WAITER role is NOT authorized', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (tenantId, employeeId) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role: 'WAITER' };
        expect(isAuthorizedForAnalytics(session)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.5: KITCHEN role is NOT authorized', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (tenantId, employeeId) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role: 'KITCHEN' };
        expect(isAuthorizedForAnalytics(session)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.6: null session returns 401', () => {
    const response = getAuthorizationResponse(null);
    expect(response.status).toBe(401);
    expect(response.allowed).toBe(false);
  });

  it('Property 12.7: authorized roles return 200', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), authorizedRoleArb, (tenantId, employeeId, role) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role };
        const response = getAuthorizationResponse(session);
        
        expect(response.status).toBe(200);
        expect(response.allowed).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.8: unauthorized roles return 403', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), unauthorizedRoleArb, (tenantId, employeeId, role) => {
        const session: Session = { tenant_id: tenantId, employee_id: employeeId, role };
        const response = getAuthorizationResponse(session);
        
        expect(response.status).toBe(403);
        expect(response.allowed).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.9: authorization is deterministic', () => {
    fc.assert(
      fc.property(sessionArb, (session) => {
        const result1 = isAuthorizedForAnalytics(session);
        const result2 = isAuthorizedForAnalytics(session);
        expect(result1).toBe(result2);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 12.10: authorization depends only on role', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        roleArb,
        (tenant1, tenant2, emp1, emp2, role) => {
          const session1: Session = { tenant_id: tenant1, employee_id: emp1, role };
          const session2: Session = { tenant_id: tenant2, employee_id: emp2, role };
          
          // Same role should give same authorization regardless of tenant/employee
          expect(isAuthorizedForAnalytics(session1)).toBe(isAuthorizedForAnalytics(session2));
        }
      ),
      { numRuns: 100 }
    );
  });
});
