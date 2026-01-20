// src/core/auth/audit-logger.ts
// Audit Logger Service - Terminal Architecture v2
// Task 10.1 - Requirements 6.1, 6.2, 6.3

import prisma from '@/src/core/db/prisma';
import { Prisma } from '@prisma/client';
import { logger } from '@/src/core/observability/logger';

/**
 * Authentication event types
 */
export type AuthEventType = 
  | 'terminal_created'
  | 'activation_code_generated'
  | 'device_activated'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'session_expired'
  | 'fingerprint_drift_detected'
  | 'step_up_auth_required'
  | 'step_up_auth_success'
  | 'step_up_auth_failed'
  | 'terminal_disabled'
  | 'security_alert';

/**
 * Authentication event structure
 */
export interface AuthEvent {
  id: string;
  tenant_id: string;
  terminal_id: string;
  employee_id: string | null;
  event_type: AuthEventType;
  risk_score: number | null;
  fingerprint_match: number | null;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, unknown>;
  created_at: Date;
}

/**
 * Security alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security alert structure
 */
export interface SecurityAlert {
  id: string;
  tenant_id: string;
  terminal_id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: Date | null;
  created_at: Date;
}

/**
 * Input for creating an auth event (without auto-generated fields)
 */
export interface CreateAuthEventInput {
  tenant_id: string;
  terminal_id: string;
  employee_id?: string | null;
  event_type: AuthEventType;
  risk_score?: number | null;
  fingerprint_match?: number | null;
  ip_address: string;
  user_agent: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a security alert (without auto-generated fields)
 */
export interface CreateSecurityAlertInput {
  tenant_id: string;
  terminal_id: string;
  alert_type: string;
  severity: AlertSeverity;
  message: string;
}

/**
 * Filters for querying auth events
 */
export interface EventFilters {
  tenant_id: string;
  terminal_id?: string;
  employee_id?: string;
  event_type?: AuthEventType;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
}

/**
 * Filters for querying security alerts
 */
export interface AlertFilters {
  tenant_id: string;
  terminal_id?: string;
  severity?: AlertSeverity;
  acknowledged?: boolean;
  start_date?: Date;
  end_date?: Date;
  limit?: number;
}

/**
 * Log an authentication event
 * 
 * **Validates: Requirements 6.1**
 * 
 * Logs all authentication events with complete context including:
 * - timestamp (auto-generated)
 * - terminal_id
 * - employee_id
 * - result (event_type)
 * - risk_score
 * - fingerprint_match
 * 
 * @param event - Authentication event data
 * @returns Promise resolving to the created event
 */
export async function logAuthEvent(event: CreateAuthEventInput): Promise<AuthEvent> {
  try {
    const authEvent = await prisma.auth_events.create({
      data: {
        tenant_id: event.tenant_id,
        terminal_id: event.terminal_id,
        employee_id: event.employee_id ?? null,
        event_type: event.event_type,
        risk_score: event.risk_score ?? null,
        fingerprint_match: event.fingerprint_match ?? null,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        metadata: (event.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    logger.info('auth.event.logged', 'Auth event logged', {
      event_id: authEvent.id,
      event_type: authEvent.event_type,
      terminal_id: authEvent.terminal_id,
      employee_id: authEvent.employee_id ?? undefined,
    });

    return authEvent as AuthEvent;
  } catch (error) {
    logger.error(
      'auth.event.log_failed',
      'Failed to log auth event',
      error instanceof Error ? error : new Error(String(error)),
      {
        event_type: event.event_type,
        terminal_id: event.terminal_id,
      }
    );
    throw error;
  }
}

/**
 * Create a security alert
 * 
 * **Validates: Requirements 6.2, 6.3**
 * 
 * Creates a security alert for anomalies and configuration changes.
 * Alerts are visible in the Admin Panel and support filtering.
 * 
 * @param alert - Security alert data
 * @returns Promise resolving to the created alert
 */
export async function createSecurityAlert(alert: CreateSecurityAlertInput): Promise<SecurityAlert> {
  try {
    const securityAlert = await prisma.security_alerts.create({
      data: {
        tenant_id: alert.tenant_id,
        terminal_id: alert.terminal_id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        message: alert.message,
        acknowledged: false,
      },
    });

    logger.warn('security.alert.created', 'Security alert created', {
      alert_id: securityAlert.id,
      alert_type: securityAlert.alert_type,
      severity: securityAlert.severity,
      terminal_id: securityAlert.terminal_id,
    });

    return securityAlert as SecurityAlert;
  } catch (error) {
    logger.error(
      'security.alert.create_failed',
      'Failed to create security alert',
      error instanceof Error ? error : new Error(String(error)),
      {
        alert_type: alert.alert_type,
        terminal_id: alert.terminal_id,
      }
    );
    throw error;
  }
}

/**
 * Query authentication events with filters
 * 
 * **Validates: Requirements 6.4**
 * 
 * Supports filtering by:
 * - date range (start_date, end_date)
 * - terminal_id
 * - employee_id
 * - event_type
 * 
 * Results are ordered by created_at DESC (most recent first).
 * 
 * @param filters - Query filters
 * @returns Promise resolving to array of matching events
 */
export async function queryEvents(filters: EventFilters): Promise<AuthEvent[]> {
  try {
    const where: any = {
      tenant_id: filters.tenant_id,
    };

    if (filters.terminal_id) {
      where.terminal_id = filters.terminal_id;
    }

    if (filters.employee_id) {
      where.employee_id = filters.employee_id;
    }

    if (filters.event_type) {
      where.event_type = filters.event_type;
    }

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) {
        where.created_at.gte = filters.start_date;
      }
      if (filters.end_date) {
        where.created_at.lte = filters.end_date;
      }
    }

    const events = await prisma.auth_events.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: filters.limit ?? 100,
    });

    return events as AuthEvent[];
  } catch (error) {
    logger.error(
      'auth.events.query_failed',
      'Failed to query auth events',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenant_id: filters.tenant_id,
        terminal_id: filters.terminal_id,
      }
    );
    throw error;
  }
}

/**
 * Query security alerts with filters
 * 
 * **Validates: Requirements 6.3, 6.4**
 * 
 * Supports filtering by:
 * - date range (start_date, end_date)
 * - terminal_id
 * - severity
 * - acknowledged status
 * 
 * Results are ordered by created_at DESC (most recent first).
 * 
 * @param filters - Query filters
 * @returns Promise resolving to array of matching alerts
 */
export async function queryAlerts(filters: AlertFilters): Promise<SecurityAlert[]> {
  try {
    const where: any = {
      tenant_id: filters.tenant_id,
    };

    if (filters.terminal_id) {
      where.terminal_id = filters.terminal_id;
    }

    if (filters.severity) {
      where.severity = filters.severity;
    }

    if (filters.acknowledged !== undefined) {
      where.acknowledged = filters.acknowledged;
    }

    if (filters.start_date || filters.end_date) {
      where.created_at = {};
      if (filters.start_date) {
        where.created_at.gte = filters.start_date;
      }
      if (filters.end_date) {
        where.created_at.lte = filters.end_date;
      }
    }

    const alerts = await prisma.security_alerts.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: filters.limit ?? 100,
    });

    return alerts as SecurityAlert[];
  } catch (error) {
    logger.error(
      'security.alerts.query_failed',
      'Failed to query security alerts',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenant_id: filters.tenant_id,
        terminal_id: filters.terminal_id,
      }
    );
    throw error;
  }
}

/**
 * Acknowledge a security alert
 * 
 * Marks an alert as acknowledged by a specific user.
 * 
 * @param alertId - Alert ID to acknowledge
 * @param acknowledgedBy - Employee ID who acknowledged the alert
 * @returns Promise resolving to the updated alert
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<SecurityAlert> {
  try {
    const alert = await prisma.security_alerts.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date(),
      },
    });

    logger.info('security.alert.acknowledged', 'Security alert acknowledged', {
      alert_id: alertId,
      acknowledged_by: acknowledgedBy,
    });

    return alert as SecurityAlert;
  } catch (error) {
    logger.error(
      'security.alert.acknowledge_failed',
      'Failed to acknowledge alert',
      error instanceof Error ? error : new Error(String(error)),
      {
        alert_id: alertId,
      }
    );
    throw error;
  }
}

/**
 * Get unacknowledged alerts count for a tenant
 * 
 * @param tenantId - Tenant ID
 * @returns Promise resolving to count of unacknowledged alerts
 */
export async function getUnacknowledgedAlertsCount(tenantId: string): Promise<number> {
  try {
    const count = await prisma.security_alerts.count({
      where: {
        tenant_id: tenantId,
        acknowledged: false,
      },
    });

    return count;
  } catch (error) {
    logger.error(
      'security.alerts.count_failed',
      'Failed to get unacknowledged alerts count',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenant_id: tenantId,
      }
    );
    throw error;
  }
}

/**
 * Get recent events for a terminal
 * 
 * Convenience function to get the last N events for a specific terminal.
 * 
 * @param tenantId - Tenant ID
 * @param terminalId - Terminal ID
 * @param limit - Maximum number of events to return (default: 50)
 * @returns Promise resolving to array of recent events
 */
export async function getRecentTerminalEvents(
  tenantId: string,
  terminalId: string,
  limit: number = 50
): Promise<AuthEvent[]> {
  return queryEvents({
    tenant_id: tenantId,
    terminal_id: terminalId,
    limit,
  });
}

/**
 * Get critical alerts for a tenant
 * 
 * Convenience function to get unacknowledged critical and high severity alerts.
 * 
 * @param tenantId - Tenant ID
 * @returns Promise resolving to array of critical alerts
 */
export async function getCriticalAlerts(tenantId: string): Promise<SecurityAlert[]> {
  try {
    const alerts = await prisma.security_alerts.findMany({
      where: {
        tenant_id: tenantId,
        acknowledged: false,
        severity: {
          in: ['critical', 'high'],
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 50,
    });

    return alerts as SecurityAlert[];
  } catch (error) {
    logger.error(
      'security.alerts.critical_query_failed',
      'Failed to get critical alerts',
      error instanceof Error ? error : new Error(String(error)),
      {
        tenant_id: tenantId,
      }
    );
    throw error;
  }
}
