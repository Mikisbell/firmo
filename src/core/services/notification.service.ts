/**
 * Notification Service - Servicio de Notificaciones RRHH
 * Fase 11 - Notificaciones
 *
 * Pure functions for creating and managing HR notifications.
 * Actual delivery is delegated to the notification infrastructure.
 *
 * Requirements: 14.1-14.6
 */

// ============ TYPES ============

export type NotificationType =
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'ADVANCE_APPROVED'
  | 'ADVANCE_REJECTED'
  | 'PAYSLIP_READY'
  | 'SHIFT_REMINDER'
  | 'SHIFT_CHANGE'
  | 'BIRTHDAY'
  | 'TRAINING_DUE'
  | 'EVALUATION_PENDING'
  | 'GENERAL';

export type NotificationChannel = 'push' | 'in_app' | 'email';

export interface Notification {
  id: string;
  tenantId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  channel: NotificationChannel;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  employeeId: string;
  shiftReminders: boolean;
  leaveUpdates: boolean;
  payslipNotifications: boolean;
  birthdayNotifications: boolean;
  trainingReminders: boolean;
  channels: NotificationChannel[];
}

export interface ShiftReminderInput {
  employeeId: string;
  employeeName: string;
  shiftStart: string;
  shiftEnd: string;
  location?: string;
}

export interface BirthdayInput {
  employeeId: string;
  employeeName: string;
  birthDate: string; // MM-DD
}

// ============ PURE FUNCTIONS ============

/** Create notification for leave request approval */
export function createLeaveApprovalNotification(
  tenantId: string,
  recipientId: string,
  leaveType: string,
  startDate: string,
  endDate: string,
  approved: boolean
): Omit<Notification, 'id' | 'createdAt'> {
  const typeLabel = getLeaveTypeLabel(leaveType);
  return {
    tenantId,
    recipientId,
    type: approved ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
    title: approved ? 'Solicitud Aprobada' : 'Solicitud Rechazada',
    body: approved
      ? `Tu solicitud de ${typeLabel} del ${startDate} al ${endDate} ha sido aprobada.`
      : `Tu solicitud de ${typeLabel} del ${startDate} al ${endDate} ha sido rechazada.`,
    channel: 'push',
    data: { leaveType, startDate, endDate, approved },
    read: false,
  };
}

/** Create notification for advance request */
export function createAdvanceNotification(
  tenantId: string,
  recipientId: string,
  amountCents: number,
  approved: boolean
): Omit<Notification, 'id' | 'createdAt'> {
  const amount = formatCentsShort(amountCents);
  return {
    tenantId,
    recipientId,
    type: approved ? 'ADVANCE_APPROVED' : 'ADVANCE_REJECTED',
    title: approved ? 'Adelanto Aprobado' : 'Adelanto Rechazado',
    body: approved
      ? `Tu adelanto de ${amount} ha sido aprobado.`
      : `Tu solicitud de adelanto de ${amount} ha sido rechazada.`,
    channel: 'push',
    data: { amountCents, approved },
    read: false,
  };
}

/** Create notification for payslip availability */
export function createPayslipNotification(
  tenantId: string,
  recipientId: string,
  period: string,
  netSalaryCents: number
): Omit<Notification, 'id' | 'createdAt'> {
  return {
    tenantId,
    recipientId,
    type: 'PAYSLIP_READY',
    title: 'Boleta de Pago Disponible',
    body: `Tu boleta de pago del período ${period} está disponible. Neto: ${formatCentsShort(netSalaryCents)}`,
    channel: 'push',
    data: { period, netSalaryCents, link: `/employee/payslips?period=${period}` },
    read: false,
  };
}

/** Create shift reminder notification */
export function createShiftReminderNotification(
  tenantId: string,
  input: ShiftReminderInput
): Omit<Notification, 'id' | 'createdAt'> {
  const location = input.location ? ` en ${input.location}` : '';
  return {
    tenantId,
    recipientId: input.employeeId,
    type: 'SHIFT_REMINDER',
    title: 'Recordatorio de Turno',
    body: `${input.employeeName}, tu turno comienza a las ${input.shiftStart}${location}.`,
    channel: 'push',
    data: { shiftStart: input.shiftStart, shiftEnd: input.shiftEnd, location: input.location },
    read: false,
  };
}

/** Create birthday notification */
export function createBirthdayNotification(
  tenantId: string,
  recipientId: string,
  input: BirthdayInput
): Omit<Notification, 'id' | 'createdAt'> {
  return {
    tenantId,
    recipientId,
    type: 'BIRTHDAY',
    title: 'Cumpleaños',
    body: `Hoy es el cumpleaños de ${input.employeeName}. ¡Felicitaciones!`,
    channel: 'in_app',
    data: { birthdayEmployeeId: input.employeeId, employeeName: input.employeeName },
    read: false,
  };
}

/** Create training due notification */
export function createTrainingDueNotification(
  tenantId: string,
  recipientId: string,
  trainingTitle: string,
  dueDate: string
): Omit<Notification, 'id' | 'createdAt'> {
  return {
    tenantId,
    recipientId,
    type: 'TRAINING_DUE',
    title: 'Capacitación Pendiente',
    body: `La capacitación "${trainingTitle}" vence el ${dueDate}. Por favor complétala a tiempo.`,
    channel: 'push',
    data: { trainingTitle, dueDate },
    read: false,
  };
}

/** Create notification for supervisor about new leave request */
export function createSupervisorLeaveNotification(
  tenantId: string,
  supervisorId: string,
  employeeName: string,
  leaveType: string,
  startDate: string,
  endDate: string
): Omit<Notification, 'id' | 'createdAt'> {
  return {
    tenantId,
    recipientId: supervisorId,
    type: 'GENERAL',
    title: 'Nueva Solicitud de Permiso',
    body: `${employeeName} ha solicitado ${getLeaveTypeLabel(leaveType)} del ${startDate} al ${endDate}.`,
    channel: 'in_app',
    data: { employeeName, leaveType, startDate, endDate },
    read: false,
  };
}

/** Filter notifications based on user preferences */
export function filterByPreferences(
  notifications: Array<Omit<Notification, 'id' | 'createdAt'>>,
  preferences: NotificationPreferences
): Array<Omit<Notification, 'id' | 'createdAt'>> {
  return notifications.filter(n => {
    // Check if channel is enabled
    if (!preferences.channels.includes(n.channel)) return false;

    // Check type preferences
    switch (n.type) {
      case 'SHIFT_REMINDER':
      case 'SHIFT_CHANGE':
        return preferences.shiftReminders;
      case 'LEAVE_APPROVED':
      case 'LEAVE_REJECTED':
        return preferences.leaveUpdates;
      case 'PAYSLIP_READY':
        return preferences.payslipNotifications;
      case 'BIRTHDAY':
        return preferences.birthdayNotifications;
      case 'TRAINING_DUE':
        return preferences.trainingReminders;
      default:
        return true; // Always deliver general and advance notifications
    }
  });
}

/** Get default notification preferences */
export function getDefaultPreferences(employeeId: string): NotificationPreferences {
  return {
    employeeId,
    shiftReminders: true,
    leaveUpdates: true,
    payslipNotifications: true,
    birthdayNotifications: true,
    trainingReminders: true,
    channels: ['push', 'in_app'],
  };
}

/** Find employees with birthdays on a given date */
export function findBirthdaysOnDate(
  employees: Array<{ id: string; name: string; birthDate?: string }>,
  date: Date
): BirthdayInput[] {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const target = `${month}-${day}`;

  return employees
    .filter(e => e.birthDate && e.birthDate.slice(5) === target)
    .map(e => ({
      employeeId: e.id,
      employeeName: e.name,
      birthDate: target,
    }));
}

/** Find trainings expiring within N days */
export function findExpiringTrainings(
  trainings: Array<{
    employeeId: string;
    title: string;
    expiresAt: string;
  }>,
  daysAhead: number,
  today: Date = new Date()
): Array<{ employeeId: string; trainingTitle: string; dueDate: string }> {
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + daysAhead);

  return trainings
    .filter(t => {
      const expires = new Date(t.expiresAt);
      return expires >= today && expires <= threshold;
    })
    .map(t => ({
      employeeId: t.employeeId,
      trainingTitle: t.title,
      dueDate: t.expiresAt.slice(0, 10),
    }));
}

// ============ HELPERS ============

function getLeaveTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    VACATION: 'vacaciones',
    PERSONAL: 'permiso personal',
    MEDICAL: 'licencia médica',
    MATERNITY: 'licencia por maternidad',
    PATERNITY: 'licencia por paternidad',
    BEREAVEMENT: 'licencia por duelo',
    UNPAID: 'licencia sin goce',
  };
  return labels[type] || type.toLowerCase();
}

function formatCentsShort(cents: number): string {
  return `S/ ${(cents / 100).toFixed(2)}`;
}
