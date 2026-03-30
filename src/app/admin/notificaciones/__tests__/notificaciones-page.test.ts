/**
 * Admin Notificaciones Page — Unit Tests
 *
 * Validates:
 * - Module export
 * - Subscribed count: employees with has_subscription = true
 * - Inactive count: employees with days_inactive > 7
 * - Active rate: subscribed / total
 * - Test notification URL
 *
 * @module app/admin/notificaciones/__tests__/notificaciones-page
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================================================
// Logic replicated from page source
// ============================================================================

interface EmployeeSubscription {
  employee_id: string;
  name: string;
  has_subscription: boolean;
  days_inactive: number;
}

const INACTIVE_THRESHOLD = 7; // days

function countSubscribed(employees: EmployeeSubscription[]): number {
  return employees.filter(e => e.has_subscription).length;
}

function countInactive(employees: EmployeeSubscription[]): number {
  return employees.filter(e => e.days_inactive > INACTIVE_THRESHOLD).length;
}

function calcSubscriptionRate(employees: EmployeeSubscription[]): number {
  if (employees.length === 0) return 0;
  return (countSubscribed(employees) / employees.length) * 100;
}

function buildTestNotificationURL(employeeId: string): string {
  return '/api/admin/notifications/test';
}

// ============================================================================
// Tests — Module export
// ============================================================================

describe('AdminNotificacionesPage', () => {
  it('debe exportar un componente default', async () => {
    const mod = await import('../page');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

// ============================================================================
// Tests — Subscription counts
// ============================================================================

describe('AdminNotificacionesPage — Conteo de suscripciones', () => {
  const employees: EmployeeSubscription[] = [
    { employee_id: 'e1', name: 'Ana',    has_subscription: true,  days_inactive: 0  },
    { employee_id: 'e2', name: 'Bob',    has_subscription: true,  days_inactive: 10 },
    { employee_id: 'e3', name: 'Carlos', has_subscription: false, days_inactive: 2  },
    { employee_id: 'e4', name: 'Diana',  has_subscription: false, days_inactive: 15 },
  ];

  it('countSubscribed: 2 de 4 tienen suscripción', () => {
    expect(countSubscribed(employees)).toBe(2);
  });

  it('countInactive: 2 con más de 7 días inactivos', () => {
    expect(countInactive(employees)).toBe(2);
  });

  it('calcSubscriptionRate: 50%', () => {
    expect(calcSubscriptionRate(employees)).toBe(50);
  });

  it('sin empleados → rate 0 (sin división por cero)', () => {
    expect(calcSubscriptionRate([])).toBe(0);
  });

  it('todos suscritos → rate 100%', () => {
    const all = employees.map(e => ({ ...e, has_subscription: true }));
    expect(calcSubscriptionRate(all)).toBe(100);
  });

  it('ninguno suscrito → rate 0%', () => {
    const none = employees.map(e => ({ ...e, has_subscription: false }));
    expect(calcSubscriptionRate(none)).toBe(0);
  });

  it('exactamente 7 días → NO es inactivo (threshold estricto)', () => {
    const emp: EmployeeSubscription[] = [
      { employee_id: 'e1', name: 'Test', has_subscription: true, days_inactive: 7 }
    ];
    expect(countInactive(emp)).toBe(0);
  });

  it('8 días → sí es inactivo', () => {
    const emp: EmployeeSubscription[] = [
      { employee_id: 'e1', name: 'Test', has_subscription: true, days_inactive: 8 }
    ];
    expect(countInactive(emp)).toBe(1);
  });

  it('property: subscribed + unsubscribed = total', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 20 }),
        (flags) => {
          const emps = flags.map((sub, i) => ({
            employee_id: `e${i}`,
            name: `Employee ${i}`,
            has_subscription: sub,
            days_inactive: 0,
          }));
          expect(countSubscribed(emps) + emps.filter(e => !e.has_subscription).length).toBe(emps.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: subscription rate siempre entre 0 y 100', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        (flags) => {
          const emps = flags.map((sub, i) => ({
            employee_id: `e${i}`,
            name: `Emp ${i}`,
            has_subscription: sub,
            days_inactive: 0,
          }));
          const rate = calcSubscriptionRate(emps);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Tests — URL
// ============================================================================

describe('AdminNotificacionesPage — URL de notificación de prueba', () => {
  it('URL es /api/admin/notifications/test', () => {
    expect(buildTestNotificationURL('emp-123')).toBe('/api/admin/notifications/test');
  });
});
