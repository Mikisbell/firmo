/**
 * Audit Validation Schemas
 * Zod schemas for type-safe validation with automatic type inference
 */

import { z } from 'zod';

/**
 * Auth Event Type Enum
 */
export const AuthEventTypeSchema = z.enum([
  'terminal_created',
  'activation_code_generated',
  'device_activated',
  'login_success',
  'login_failed',
  'logout',
  'session_expired',
  'fingerprint_drift_detected',
  'step_up_auth_required',
  'terminal_disabled',
  'security_alert',
]);

export type AuthEventType = z.infer<typeof AuthEventTypeSchema>;

/**
 * Audit Events Query Schema
 */
export const AuditEventsQuerySchema = z.object({
  terminal_id: z.string().optional(),
  employee_id: z.string().optional(),
  event_type: AuthEventTypeSchema.optional(),
  start_date: z
    .string()
    .datetime('Fecha de inicio inválida. Use formato ISO 8601')
    .optional(),
  end_date: z
    .string()
    .datetime('Fecha de fin inválida. Use formato ISO 8601')
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100).optional(),
});

export type AuditEventsQueryParams = z.infer<typeof AuditEventsQuerySchema>;

/**
 * Alert Severity Enum
 */
export const AlertSeveritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

/**
 * Audit Alerts Query Schema
 */
export const AuditAlertsQuerySchema = z.object({
  severity: AlertSeveritySchema.optional(),
  acknowledged: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  terminal_id: z.string().optional(),
  start_date: z
    .string()
    .datetime('Fecha de inicio inválida. Use formato ISO 8601')
    .optional(),
  end_date: z
    .string()
    .datetime('Fecha de fin inválida. Use formato ISO 8601')
    .optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100).optional(),
});

export type AuditAlertsQueryParams = z.infer<typeof AuditAlertsQuerySchema>;

/**
 * Acknowledge Alert Schema
 */
export const AcknowledgeAlertSchema = z.object({
  acknowledged_by: z
    .string()
    .min(1, 'ID de empleado es requerido')
    .max(50, 'ID de empleado muy largo'),
});

export type AcknowledgeAlertDTO = z.infer<typeof AcknowledgeAlertSchema>;
