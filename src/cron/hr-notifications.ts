/**
 * HR Notification Cron Jobs
 * Fase 11 - Notificaciones programadas
 *
 * Funciones puras que generan las notificaciones a enviar.
 * La ejecución real del cron se configura en la infraestructura.
 *
 * Jobs:
 * - Recordatorios de turno (cada hora)
 * - Cumpleaños (diario a las 8AM)
 * - Capacitaciones pendientes (semanal)
 *
 * Requirements: 2.7, 8.3, 14.5
 */

import {
  createShiftReminderNotification,
  createBirthdayNotification,
  createTrainingDueNotification,
  findBirthdaysOnDate,
  findExpiringTrainings,
} from '@/src/core/services/notification.service';
import type { Notification, ShiftReminderInput, BirthdayInput } from '@/src/core/services/notification.service';

// ============ TYPES ============

export interface CronJobResult {
  jobName: string;
  notificationsGenerated: number;
  executedAt: string;
  errors: string[];
}

export interface UpcomingShift {
  employeeId: string;
  employeeName: string;
  shiftStart: string;
  shiftEnd: string;
  location?: string;
}

// ============ PURE FUNCTIONS ============

/**
 * Generate shift reminder notifications for upcoming shifts.
 * Called every hour to notify employees about shifts starting in the next hour.
 */
export function generateShiftReminders(
  tenantId: string,
  upcomingShifts: UpcomingShift[],
  teamRecipientIds: string[]
): Array<Omit<Notification, 'id' | 'createdAt'>> {
  return upcomingShifts.map(shift =>
    createShiftReminderNotification(tenantId, {
      employeeId: shift.employeeId,
      employeeName: shift.employeeName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      location: shift.location,
    })
  );
}

/**
 * Generate birthday notifications for today.
 * Called daily at 8AM.
 */
export function generateBirthdayNotifications(
  tenantId: string,
  employees: Array<{ id: string; name: string; birthDate?: string }>,
  allEmployeeIds: string[],
  today: Date = new Date()
): Array<Omit<Notification, 'id' | 'createdAt'>> {
  const birthdays = findBirthdaysOnDate(employees, today);

  // Notify all employees about each birthday
  const notifications: Array<Omit<Notification, 'id' | 'createdAt'>> = [];
  for (const birthday of birthdays) {
    for (const recipientId of allEmployeeIds) {
      notifications.push(
        createBirthdayNotification(tenantId, recipientId, birthday)
      );
    }
  }
  return notifications;
}

/**
 * Generate training due notifications.
 * Called weekly to notify about trainings expiring in the next 30 days.
 */
export function generateTrainingReminders(
  tenantId: string,
  trainings: Array<{ employeeId: string; title: string; expiresAt: string }>,
  daysAhead: number = 30,
  today: Date = new Date()
): Array<Omit<Notification, 'id' | 'createdAt'>> {
  const expiring = findExpiringTrainings(trainings, daysAhead, today);
  return expiring.map(t =>
    createTrainingDueNotification(tenantId, t.employeeId, t.trainingTitle, t.dueDate)
  );
}
