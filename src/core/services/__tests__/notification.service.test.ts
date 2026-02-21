/**
 * Tests: Notification Service
 * Fase 11 - Notificaciones RRHH
 *
 * Properties:
 * - 70: Notificación de aprobación
 * - 71: Notificación a supervisor
 * - 72: Notificación de boleta con link
 * - 73: Notificación de cumpleaños
 * - 74: Preferencias de notificaciones
 *
 * Validates: Requirements 14.1-14.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createLeaveApprovalNotification,
  createAdvanceNotification,
  createPayslipNotification,
  createShiftReminderNotification,
  createBirthdayNotification,
  createTrainingDueNotification,
  createSupervisorLeaveNotification,
  filterByPreferences,
  getDefaultPreferences,
  findBirthdaysOnDate,
  findExpiringTrainings,
} from '../notification.service';
import type { NotificationPreferences, Notification } from '../notification.service';

// ============ ARBITRARIES ============

const uuidArb = fc.uuid();
const dateStrArb = fc.constantFrom('2025-03-01', '2025-06-15', '2025-12-25');
const centsArb = fc.integer({ min: 1000, max: 5000000 });

// ============ PROPERTY TESTS ============

describe('Property 70: Notificación de aprobación', () => {
  it('leave approval creates notification with correct type', () => {
    fc.assert(
      fc.property(
        uuidArb, uuidArb,
        fc.constantFrom('VACATION', 'PERSONAL', 'MEDICAL'),
        dateStrArb, dateStrArb,
        fc.boolean(),
        (tenantId, recipientId, leaveType, start, end, approved) => {
          const notif = createLeaveApprovalNotification(tenantId, recipientId, leaveType, start, end, approved);

          expect(notif.tenantId).toBe(tenantId);
          expect(notif.recipientId).toBe(recipientId);
          expect(notif.type).toBe(approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED');
          expect(notif.channel).toBe('push');
          expect(notif.read).toBe(false);
          expect(notif.body).toContain(start);
          expect(notif.body).toContain(end);
          expect(notif.data?.approved).toBe(approved);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('advance approval creates notification with amount', () => {
    fc.assert(
      fc.property(
        uuidArb, uuidArb, centsArb, fc.boolean(),
        (tenantId, recipientId, amount, approved) => {
          const notif = createAdvanceNotification(tenantId, recipientId, amount, approved);

          expect(notif.type).toBe(approved ? 'ADVANCE_APPROVED' : 'ADVANCE_REJECTED');
          expect(notif.body).toContain('S/');
          expect(notif.data?.amountCents).toBe(amount);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 71: Notificación a supervisor', () => {
  it('supervisor notification includes employee name and dates', () => {
    fc.assert(
      fc.property(
        uuidArb, uuidArb,
        fc.string({ minLength: 2, maxLength: 30 }),
        fc.constantFrom('VACATION', 'PERSONAL'),
        dateStrArb, dateStrArb,
        (tenantId, supervisorId, empName, leaveType, start, end) => {
          const notif = createSupervisorLeaveNotification(
            tenantId, supervisorId, empName, leaveType, start, end
          );

          expect(notif.recipientId).toBe(supervisorId);
          expect(notif.body).toContain(empName);
          expect(notif.body).toContain(start);
          expect(notif.body).toContain(end);
          expect(notif.channel).toBe('in_app');
          expect(notif.type).toBe('GENERAL');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 72: Notificación de boleta con link', () => {
  it('payslip notification includes period and amount', () => {
    fc.assert(
      fc.property(
        uuidArb, uuidArb,
        fc.constantFrom('2025-01', '2025-06', '2025-12'),
        centsArb,
        (tenantId, recipientId, period, netCents) => {
          const notif = createPayslipNotification(tenantId, recipientId, period, netCents);

          expect(notif.type).toBe('PAYSLIP_READY');
          expect(notif.body).toContain(period);
          expect(notif.body).toContain('S/');
          expect(notif.data?.period).toBe(period);
          expect(notif.data?.link).toContain('/employee/payslips');
          expect(notif.data?.link).toContain(period);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('Property 73: Notificación de cumpleaños', () => {
  it('birthday notification includes employee name', () => {
    fc.assert(
      fc.property(
        uuidArb, uuidArb, uuidArb,
        fc.string({ minLength: 2, maxLength: 30 }),
        (tenantId, recipientId, empId, empName) => {
          const notif = createBirthdayNotification(tenantId, recipientId, {
            employeeId: empId,
            employeeName: empName,
            birthDate: '03-15',
          });

          expect(notif.type).toBe('BIRTHDAY');
          expect(notif.body).toContain(empName);
          expect(notif.channel).toBe('in_app');
          expect(notif.data?.birthdayEmployeeId).toBe(empId);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('findBirthdaysOnDate correctly matches MM-DD', () => {
    const employees = [
      { id: 'e1', name: 'Juan', birthDate: '1990-03-15' },
      { id: 'e2', name: 'Ana', birthDate: '1985-03-15' },
      { id: 'e3', name: 'Pedro', birthDate: '1992-06-20' },
      { id: 'e4', name: 'María' }, // no birthDate
    ];

    const march15 = new Date(2025, 2, 15); // March 15
    const result = findBirthdaysOnDate(employees, march15);
    expect(result.length).toBe(2);
    expect(result.map(r => r.employeeName)).toEqual(['Juan', 'Ana']);
    expect(result[0].birthDate).toBe('03-15');
  });

  it('findBirthdaysOnDate returns empty for no matches', () => {
    const employees = [
      { id: 'e1', name: 'Juan', birthDate: '1990-03-15' },
    ];
    const jan1 = new Date(2025, 0, 1);
    expect(findBirthdaysOnDate(employees, jan1).length).toBe(0);
  });
});

describe('Property 74: Preferencias de notificaciones', () => {
  it('default preferences enable all notification types', () => {
    fc.assert(
      fc.property(uuidArb, (empId) => {
        const prefs = getDefaultPreferences(empId);
        expect(prefs.employeeId).toBe(empId);
        expect(prefs.shiftReminders).toBe(true);
        expect(prefs.leaveUpdates).toBe(true);
        expect(prefs.payslipNotifications).toBe(true);
        expect(prefs.birthdayNotifications).toBe(true);
        expect(prefs.trainingReminders).toBe(true);
        expect(prefs.channels).toContain('push');
        expect(prefs.channels).toContain('in_app');
      }),
      { numRuns: 20 }
    );
  });

  it('filter respects disabled preferences', () => {
    const notifs = [
      createShiftReminderNotification('t1', {
        employeeId: 'e1', employeeName: 'Juan', shiftStart: '08:00', shiftEnd: '16:00',
      }),
      createLeaveApprovalNotification('t1', 'e1', 'VACATION', '2025-03-01', '2025-03-05', true),
      createPayslipNotification('t1', 'e1', '2025-01', 200000),
      createBirthdayNotification('t1', 'e1', {
        employeeId: 'e2', employeeName: 'Ana', birthDate: '03-15',
      }),
    ];

    const prefsAllDisabled: NotificationPreferences = {
      employeeId: 'e1',
      shiftReminders: false,
      leaveUpdates: false,
      payslipNotifications: false,
      birthdayNotifications: false,
      trainingReminders: false,
      channels: ['push', 'in_app'],
    };

    const filtered = filterByPreferences(notifs, prefsAllDisabled);
    expect(filtered.length).toBe(0);
  });

  it('filter respects channel preferences', () => {
    const notifs = [
      createShiftReminderNotification('t1', {
        employeeId: 'e1', employeeName: 'Juan', shiftStart: '08:00', shiftEnd: '16:00',
      }), // channel: push
      createBirthdayNotification('t1', 'e1', {
        employeeId: 'e2', employeeName: 'Ana', birthDate: '03-15',
      }), // channel: in_app
    ];

    const prefsOnlyInApp: NotificationPreferences = {
      employeeId: 'e1',
      shiftReminders: true,
      leaveUpdates: true,
      payslipNotifications: true,
      birthdayNotifications: true,
      trainingReminders: true,
      channels: ['in_app'], // only in_app
    };

    const filtered = filterByPreferences(notifs, prefsOnlyInApp);
    expect(filtered.length).toBe(1);
    expect(filtered[0].type).toBe('BIRTHDAY');
  });

  it('filter with all enabled passes everything through', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom(
            createShiftReminderNotification('t1', {
              employeeId: 'e1', employeeName: 'Juan', shiftStart: '08:00', shiftEnd: '16:00',
            }),
            createLeaveApprovalNotification('t1', 'e1', 'VACATION', '2025-01-01', '2025-01-05', true),
            createPayslipNotification('t1', 'e1', '2025-01', 200000),
          ),
          { minLength: 1, maxLength: 10 }
        ),
        (notifs) => {
          const prefs = getDefaultPreferences('e1');
          const filtered = filterByPreferences(notifs, prefs);
          expect(filtered.length).toBe(notifs.length);
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ============ UNIT TESTS ============

describe('createShiftReminderNotification', () => {
  it('should include employee name and time', () => {
    const notif = createShiftReminderNotification('t1', {
      employeeId: 'e1',
      employeeName: 'Juan Pérez',
      shiftStart: '08:00',
      shiftEnd: '16:00',
      location: 'Local Principal',
    });

    expect(notif.type).toBe('SHIFT_REMINDER');
    expect(notif.body).toContain('Juan Pérez');
    expect(notif.body).toContain('08:00');
    expect(notif.body).toContain('Local Principal');
  });

  it('should work without location', () => {
    const notif = createShiftReminderNotification('t1', {
      employeeId: 'e1', employeeName: 'Ana', shiftStart: '10:00', shiftEnd: '18:00',
    });
    expect(notif.body).not.toContain(' en ');
  });
});

describe('createTrainingDueNotification', () => {
  it('should include training title and due date', () => {
    const notif = createTrainingDueNotification('t1', 'e1', 'Seguridad Alimentaria', '2025-06-30');
    expect(notif.type).toBe('TRAINING_DUE');
    expect(notif.body).toContain('Seguridad Alimentaria');
    expect(notif.body).toContain('2025-06-30');
  });
});

describe('findExpiringTrainings', () => {
  it('should find trainings within threshold', () => {
    const today = new Date('2025-03-01');
    const trainings = [
      { employeeId: 'e1', title: 'Safety', expiresAt: '2025-03-10T00:00:00Z' },
      { employeeId: 'e2', title: 'Food', expiresAt: '2025-03-25T00:00:00Z' },
      { employeeId: 'e3', title: 'Fire', expiresAt: '2025-04-15T00:00:00Z' },
      { employeeId: 'e4', title: 'Past', expiresAt: '2025-02-28T00:00:00Z' },
    ];

    const result = findExpiringTrainings(trainings, 30, today);
    expect(result.length).toBe(2); // Safety and Food
    expect(result.map(r => r.trainingTitle)).toContain('Safety');
    expect(result.map(r => r.trainingTitle)).toContain('Food');
  });

  it('should return empty for no expiring trainings', () => {
    const today = new Date('2025-01-01');
    const trainings = [
      { employeeId: 'e1', title: 'Safety', expiresAt: '2026-01-01T00:00:00Z' },
    ];
    expect(findExpiringTrainings(trainings, 30, today).length).toBe(0);
  });
});
