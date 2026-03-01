// src/core/auth/__tests__/audit-logger.test.ts
// Unit tests for Audit Logger Service
// Task 10.1 - Requirements 6.1, 6.2, 6.3
// Task 10.2 - Property 14: Audit Log Completeness

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  logAuthEvent,
  createSecurityAlert,
  queryEvents,
  queryAlerts,
  acknowledgeAlert,
  getUnacknowledgedAlertsCount,
  getRecentTerminalEvents,
  getCriticalAlerts,
  type CreateAuthEventInput,
  type CreateSecurityAlertInput,
  type EventFilters,
  type AlertFilters,
  type AuthEventType,
} from '../audit-logger';

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    auth_events: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    security_alerts: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock logger
vi.mock('@/src/core/observability/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';

describe('Audit Logger Service', () => {
  const mockTenantId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const mockTerminalId = 'CAJA_01';
  const mockEmployeeId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logAuthEvent', () => {
    it('should log a complete authentication event with all fields', async () => {
      // **Validates: Requirements 6.1**
      const mockEvent: CreateAuthEventInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        employee_id: mockEmployeeId,
        event_type: 'login_success',
        risk_score: 25,
        fingerprint_match: 95,
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        metadata: { session_id: 'test-session' },
      };

      const mockCreatedEvent = {
        id: 'event-123',
        ...mockEvent,
        created_at: new Date(),
      };

      vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

      const result = await logAuthEvent(mockEvent);

      expect(prisma.auth_events.create).toHaveBeenCalledWith({
        data: {
          tenant_id: mockEvent.tenant_id,
          terminal_id: mockEvent.terminal_id,
          employee_id: mockEvent.employee_id,
          event_type: mockEvent.event_type,
          risk_score: mockEvent.risk_score,
          fingerprint_match: mockEvent.fingerprint_match,
          ip_address: mockEvent.ip_address,
          user_agent: mockEvent.user_agent,
          metadata: mockEvent.metadata,
        },
      });

      expect(result).toEqual(mockCreatedEvent);
      expect(logger.info).toHaveBeenCalledWith('auth.event.logged', 'Auth event logged', {
        event_id: 'event-123',
        event_type: 'login_success',
        terminal_id: mockTerminalId,
        employee_id: mockEmployeeId,
      });
    });

    it('should handle null employee_id for system events', async () => {
      const mockEvent: CreateAuthEventInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        employee_id: null,
        event_type: 'terminal_created',
        ip_address: '192.168.1.100',
        user_agent: 'Admin Panel',
      };

      const mockCreatedEvent = {
        id: 'event-456',
        ...mockEvent,
        risk_score: null,
        fingerprint_match: null,
        metadata: {},
        created_at: new Date(),
      };

      vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

      const result = await logAuthEvent(mockEvent);

      expect(result.employee_id).toBeNull();
      expect(result.event_type).toBe('terminal_created');
    });

    it('should use default empty metadata if not provided', async () => {
      const mockEvent: CreateAuthEventInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        event_type: 'logout',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
      };

      const mockCreatedEvent = {
        id: 'event-789',
        ...mockEvent,
        employee_id: null,
        risk_score: null,
        fingerprint_match: null,
        metadata: {},
        created_at: new Date(),
      };

      vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

      await logAuthEvent(mockEvent);

      expect(prisma.auth_events.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {},
        }),
      });
    });

    it('should log error and rethrow on database failure', async () => {
      const mockEvent: CreateAuthEventInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        event_type: 'login_failed',
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
      };

      const dbError = new Error('Database connection failed');
      vi.mocked(prisma.auth_events.create).mockRejectedValue(dbError);

      await expect(logAuthEvent(mockEvent)).rejects.toThrow('Database connection failed');

      expect(logger.error).toHaveBeenCalledWith(
        'auth.event.log_failed',
        'Failed to log auth event',
        dbError,
        {
          event_type: 'login_failed',
          terminal_id: mockTerminalId,
        }
      );
    });

    it('should log all authentication event types', async () => {
      const eventTypes = [
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
      ];

      for (const eventType of eventTypes) {
        const mockEvent: CreateAuthEventInput = {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          event_type: eventType as any,
          ip_address: '192.168.1.100',
          user_agent: 'Test',
        };

        const mockCreatedEvent = {
          id: `event-${eventType}`,
          ...mockEvent,
          employee_id: null,
          risk_score: null,
          fingerprint_match: null,
          metadata: {},
          created_at: new Date(),
        };

        vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

        const result = await logAuthEvent(mockEvent);
        expect(result.event_type).toBe(eventType);
      }
    });
  });

  describe('createSecurityAlert', () => {
    it('should create a security alert with all required fields', async () => {
      // **Validates: Requirements 6.2, 6.3**
      const mockAlert: CreateSecurityAlertInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        alert_type: 'fingerprint_mismatch',
        severity: 'high',
        message: 'Device fingerprint changed significantly',
      };

      const mockCreatedAlert = {
        id: 'alert-123',
        ...mockAlert,
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        created_at: new Date(),
      };

      vi.mocked(prisma.security_alerts.create).mockResolvedValue(mockCreatedAlert as never);

      const result = await createSecurityAlert(mockAlert);

      expect(prisma.security_alerts.create).toHaveBeenCalledWith({
        data: {
          tenant_id: mockAlert.tenant_id,
          terminal_id: mockAlert.terminal_id,
          alert_type: mockAlert.alert_type,
          severity: mockAlert.severity,
          message: mockAlert.message,
          acknowledged: false,
        },
      });

      expect(result).toEqual(mockCreatedAlert);
      expect(logger.warn).toHaveBeenCalledWith('security.alert.created', 'Security alert created', {
        alert_id: 'alert-123',
        alert_type: 'fingerprint_mismatch',
        severity: 'high',
        terminal_id: mockTerminalId,
      });
    });

    it('should create alerts with different severity levels', async () => {
      const severities: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      for (const severity of severities) {
        const mockAlert: CreateSecurityAlertInput = {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          alert_type: 'test_alert',
          severity,
          message: `Test alert with ${severity} severity`,
        };

        const mockCreatedAlert = {
          id: `alert-${severity}`,
          ...mockAlert,
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
          created_at: new Date(),
        };

        vi.mocked(prisma.security_alerts.create).mockResolvedValue(mockCreatedAlert as never);

        const result = await createSecurityAlert(mockAlert);
        expect(result.severity).toBe(severity);
      }
    });

    it('should log error and rethrow on database failure', async () => {
      const mockAlert: CreateSecurityAlertInput = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        alert_type: 'test_alert',
        severity: 'medium',
        message: 'Test message',
      };

      const dbError = new Error('Database connection failed');
      vi.mocked(prisma.security_alerts.create).mockRejectedValue(dbError);

      await expect(createSecurityAlert(mockAlert)).rejects.toThrow('Database connection failed');

      expect(logger.error).toHaveBeenCalledWith(
        'security.alert.create_failed',
        'Failed to create security alert',
        dbError,
        {
          alert_type: 'test_alert',
          terminal_id: mockTerminalId,
        }
      );
    });
  });

  describe('queryEvents', () => {
    it('should query events with all filters applied', async () => {
      // **Validates: Requirements 6.4**
      const filters: EventFilters = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        employee_id: mockEmployeeId,
        event_type: 'login_success',
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-01-31'),
        limit: 50,
      };

      const mockEvents = [
        {
          id: 'event-1',
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          employee_id: mockEmployeeId,
          event_type: 'login_success',
          risk_score: 20,
          fingerprint_match: 98,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0',
          metadata: {},
          created_at: new Date('2025-01-15'),
        },
      ];

      vi.mocked(prisma.auth_events.findMany).mockResolvedValue(mockEvents as never);

      const result = await queryEvents(filters);

      expect(prisma.auth_events.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          employee_id: mockEmployeeId,
          event_type: 'login_success',
          created_at: {
            gte: filters.start_date,
            lte: filters.end_date,
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 50,
      });

      expect(result).toEqual(mockEvents);
    });

    it('should query events with only tenant_id (minimal filter)', async () => {
      const filters: EventFilters = {
        tenant_id: mockTenantId,
      };

      const mockEvents = [
        {
          id: 'event-1',
          tenant_id: mockTenantId,
          terminal_id: 'CAJA_01',
          employee_id: null,
          event_type: 'terminal_created',
          risk_score: null,
          fingerprint_match: null,
          ip_address: '192.168.1.1',
          user_agent: 'Admin',
          metadata: {},
          created_at: new Date(),
        },
      ];

      vi.mocked(prisma.auth_events.findMany).mockResolvedValue(mockEvents as never);

      const result = await queryEvents(filters);

      expect(prisma.auth_events.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 100, // default limit
      });

      expect(result).toEqual(mockEvents);
    });

    it('should query events with date range only', async () => {
      const filters: EventFilters = {
        tenant_id: mockTenantId,
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-01-31'),
      };

      vi.mocked(prisma.auth_events.findMany).mockResolvedValue([]);

      await queryEvents(filters);

      expect(prisma.auth_events.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          created_at: {
            gte: filters.start_date,
            lte: filters.end_date,
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 100,
      });
    });

    it('should handle database errors gracefully', async () => {
      const filters: EventFilters = {
        tenant_id: mockTenantId,
      };

      const dbError = new Error('Query failed');
      vi.mocked(prisma.auth_events.findMany).mockRejectedValue(dbError);

      await expect(queryEvents(filters)).rejects.toThrow('Query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'auth.events.query_failed',
        'Failed to query auth events',
        dbError,
        {
          tenant_id: mockTenantId,
          terminal_id: undefined,
        }
      );
    });
  });

  describe('queryAlerts', () => {
    it('should query alerts with all filters applied', async () => {
      // **Validates: Requirements 6.3, 6.4**
      const filters: AlertFilters = {
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        severity: 'high',
        acknowledged: false,
        start_date: new Date('2025-01-01'),
        end_date: new Date('2025-01-31'),
        limit: 25,
      };

      const mockAlerts = [
        {
          id: 'alert-1',
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          alert_type: 'fingerprint_drift',
          severity: 'high',
          message: 'Fingerprint drift detected',
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
          created_at: new Date('2025-01-15'),
        },
      ];

      vi.mocked(prisma.security_alerts.findMany).mockResolvedValue(mockAlerts as never);

      const result = await queryAlerts(filters);

      expect(prisma.security_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          severity: 'high',
          acknowledged: false,
          created_at: {
            gte: filters.start_date,
            lte: filters.end_date,
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 25,
      });

      expect(result).toEqual(mockAlerts);
    });

    it('should query alerts with only tenant_id', async () => {
      const filters: AlertFilters = {
        tenant_id: mockTenantId,
      };

      vi.mocked(prisma.security_alerts.findMany).mockResolvedValue([]);

      await queryAlerts(filters);

      expect(prisma.security_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 100,
      });
    });

    it('should handle database errors gracefully', async () => {
      const filters: AlertFilters = {
        tenant_id: mockTenantId,
      };

      const dbError = new Error('Query failed');
      vi.mocked(prisma.security_alerts.findMany).mockRejectedValue(dbError);

      await expect(queryAlerts(filters)).rejects.toThrow('Query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'security.alerts.query_failed',
        'Failed to query security alerts',
        dbError,
        {
          tenant_id: mockTenantId,
          terminal_id: undefined,
        }
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert with employee ID and timestamp', async () => {
      const alertId = 'alert-123';
      const acknowledgedBy = mockEmployeeId;

      const mockUpdatedAlert = {
        id: alertId,
        tenant_id: mockTenantId,
        terminal_id: mockTerminalId,
        alert_type: 'test_alert',
        severity: 'medium',
        message: 'Test alert',
        acknowledged: true,
        acknowledged_by: acknowledgedBy,
        acknowledged_at: new Date(),
        created_at: new Date(),
      };

      vi.mocked(prisma.security_alerts.update).mockResolvedValue(mockUpdatedAlert as never);

      const result = await acknowledgeAlert(alertId, acknowledgedBy);

      expect(prisma.security_alerts.update).toHaveBeenCalledWith({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledged_by: acknowledgedBy,
          acknowledged_at: expect.any(Date),
        },
      });

      expect(result.acknowledged).toBe(true);
      expect(result.acknowledged_by).toBe(acknowledgedBy);
      expect(logger.info).toHaveBeenCalledWith('security.alert.acknowledged', 'Security alert acknowledged', {
        alert_id: alertId,
        acknowledged_by: acknowledgedBy,
      });
    });

    it('should handle database errors gracefully', async () => {
      const alertId = 'alert-123';
      const acknowledgedBy = mockEmployeeId;

      const dbError = new Error('Update failed');
      vi.mocked(prisma.security_alerts.update).mockRejectedValue(dbError);

      await expect(acknowledgeAlert(alertId, acknowledgedBy)).rejects.toThrow('Update failed');

      expect(logger.error).toHaveBeenCalledWith(
        'security.alert.acknowledge_failed',
        'Failed to acknowledge alert',
        dbError,
        {
          alert_id: alertId,
        }
      );
    });
  });

  describe('getUnacknowledgedAlertsCount', () => {
    it('should return count of unacknowledged alerts', async () => {
      vi.mocked(prisma.security_alerts.count).mockResolvedValue(5);

      const count = await getUnacknowledgedAlertsCount(mockTenantId);

      expect(prisma.security_alerts.count).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          acknowledged: false,
        },
      });

      expect(count).toBe(5);
    });

    it('should return 0 when no unacknowledged alerts exist', async () => {
      vi.mocked(prisma.security_alerts.count).mockResolvedValue(0);

      const count = await getUnacknowledgedAlertsCount(mockTenantId);

      expect(count).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Count failed');
      vi.mocked(prisma.security_alerts.count).mockRejectedValue(dbError);

      await expect(getUnacknowledgedAlertsCount(mockTenantId)).rejects.toThrow('Count failed');

      expect(logger.error).toHaveBeenCalledWith(
        'security.alerts.count_failed',
        'Failed to get unacknowledged alerts count',
        dbError,
        {
          tenant_id: mockTenantId,
        }
      );
    });
  });

  describe('getRecentTerminalEvents', () => {
    it('should get recent events for a terminal with default limit', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          employee_id: mockEmployeeId,
          event_type: 'login_success',
          risk_score: 20,
          fingerprint_match: 95,
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0',
          metadata: {},
          created_at: new Date(),
        },
      ];

      vi.mocked(prisma.auth_events.findMany).mockResolvedValue(mockEvents as never);

      const result = await getRecentTerminalEvents(mockTenantId, mockTerminalId);

      expect(prisma.auth_events.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 50,
      });

      expect(result).toEqual(mockEvents);
    });

    it('should get recent events with custom limit', async () => {
      vi.mocked(prisma.auth_events.findMany).mockResolvedValue([]);

      await getRecentTerminalEvents(mockTenantId, mockTerminalId, 10);

      expect(prisma.auth_events.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 10,
      });
    });
  });

  describe('getCriticalAlerts', () => {
    it('should get unacknowledged critical and high severity alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          tenant_id: mockTenantId,
          terminal_id: mockTerminalId,
          alert_type: 'security_breach',
          severity: 'critical',
          message: 'Critical security issue',
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
          created_at: new Date(),
        },
        {
          id: 'alert-2',
          tenant_id: mockTenantId,
          terminal_id: 'MOZO_01',
          alert_type: 'fingerprint_mismatch',
          severity: 'high',
          message: 'High severity issue',
          acknowledged: false,
          acknowledged_by: null,
          acknowledged_at: null,
          created_at: new Date(),
        },
      ];

      vi.mocked(prisma.security_alerts.findMany).mockResolvedValue(mockAlerts as never);

      const result = await getCriticalAlerts(mockTenantId);

      expect(prisma.security_alerts.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
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

      expect(result).toEqual(mockAlerts);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no critical alerts exist', async () => {
      vi.mocked(prisma.security_alerts.findMany).mockResolvedValue([]);

      const result = await getCriticalAlerts(mockTenantId);

      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Query failed');
      vi.mocked(prisma.security_alerts.findMany).mockRejectedValue(dbError);

      await expect(getCriticalAlerts(mockTenantId)).rejects.toThrow('Query failed');

      expect(logger.error).toHaveBeenCalledWith(
        'security.alerts.critical_query_failed',
        'Failed to get critical alerts',
        dbError,
        {
          tenant_id: mockTenantId,
        }
      );
    });
  });
});


// ============ PROPERTY-BASED TESTS ============
// Task 10.2 - Property 14: Audit Log Completeness

// ============ ARBITRARIES ============

const authEventTypeArb = fc.constantFrom<AuthEventType>(
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
  'security_alert'
);

const ipAddressArb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const userAgentArb = fc.constantFrom(
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Admin Panel',
  'System'
);

const authEventInputArb = fc.record({
  tenant_id: fc.uuid(),
  terminal_id: fc.string({ minLength: 5, maxLength: 20 }),
  employee_id: fc.option(fc.uuid(), { nil: null }),
  event_type: authEventTypeArb,
  risk_score: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  fingerprint_match: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
  ip_address: ipAddressArb,
  user_agent: userAgentArb,
  metadata: fc.option(
    fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean()
      )
    ),
    { nil: undefined }
  ),
});

// ============ PROPERTY 14: AUDIT LOG COMPLETENESS ============
// **Validates: Requirements 6.1, 6.2**

describe('Property 14: Audit Log Completeness', () => {
  // Feature: terminal-architecture-v2, Property 14: Audit Log Completeness
  
  it('should always include timestamp (created_at) in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify timestamp exists and is a valid Date
          expect(result.created_at).toBeDefined();
          expect(result.created_at).toBeInstanceOf(Date);
          expect(result.created_at.getTime()).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include terminal_id in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify terminal_id exists and matches input
          expect(result.terminal_id).toBeDefined();
          expect(result.terminal_id).toBe(eventInput.terminal_id);
          expect(result.terminal_id.length).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include employee_id (or null) in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify employee_id field exists (can be null for system events)
          expect('employee_id' in result).toBe(true);
          
          // If provided, should match input
          if (eventInput.employee_id !== null && eventInput.employee_id !== undefined) {
            expect(result.employee_id).toBe(eventInput.employee_id);
          } else {
            expect(result.employee_id).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include result (event_type) in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify event_type (result) exists and matches input
          expect(result.event_type).toBeDefined();
          expect(result.event_type).toBe(eventInput.event_type);
          
          // Verify it's a valid event type
          const validEventTypes: AuthEventType[] = [
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
          ];
          expect(validEventTypes).toContain(result.event_type);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include risk_score (or null) in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify risk_score field exists (can be null for non-auth events)
          expect('risk_score' in result).toBe(true);
          
          // If provided, should match input and be in valid range
          if (eventInput.risk_score !== null && eventInput.risk_score !== undefined) {
            expect(result.risk_score).toBe(eventInput.risk_score);
            expect(result.risk_score).toBeGreaterThanOrEqual(0);
            expect(result.risk_score).toBeLessThanOrEqual(100);
          } else {
            expect(result.risk_score).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always include fingerprint_match (or null) in logged events', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify fingerprint_match field exists (can be null for non-device events)
          expect('fingerprint_match' in result).toBe(true);
          
          // If provided, should match input and be in valid range
          if (eventInput.fingerprint_match !== null && eventInput.fingerprint_match !== undefined) {
            expect(result.fingerprint_match).toBe(eventInput.fingerprint_match);
            expect(result.fingerprint_match).toBeGreaterThanOrEqual(0);
            expect(result.fingerprint_match).toBeLessThanOrEqual(100);
          } else {
            expect(result.fingerprint_match).toBeNull();
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include all required fields for any authentication event type', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify ALL required fields are present
          expect(result).toHaveProperty('id');
          expect(result).toHaveProperty('tenant_id');
          expect(result).toHaveProperty('terminal_id');
          expect(result).toHaveProperty('employee_id');
          expect(result).toHaveProperty('event_type');
          expect(result).toHaveProperty('risk_score');
          expect(result).toHaveProperty('fingerprint_match');
          expect(result).toHaveProperty('ip_address');
          expect(result).toHaveProperty('user_agent');
          expect(result).toHaveProperty('metadata');
          expect(result).toHaveProperty('created_at');
          
          // Verify no field is undefined
          expect(result.id).not.toBeUndefined();
          expect(result.tenant_id).not.toBeUndefined();
          expect(result.terminal_id).not.toBeUndefined();
          expect(result.event_type).not.toBeUndefined();
          expect(result.ip_address).not.toBeUndefined();
          expect(result.user_agent).not.toBeUndefined();
          expect(result.metadata).not.toBeUndefined();
          expect(result.created_at).not.toBeUndefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all input data in the logged event', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        async (eventInput) => {
          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            employee_id: eventInput.employee_id ?? null,
            risk_score: eventInput.risk_score ?? null,
            fingerprint_match: eventInput.fingerprint_match ?? null,
            metadata: eventInput.metadata ?? {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // Verify all input fields are preserved in output
          expect(result.tenant_id).toBe(eventInput.tenant_id);
          expect(result.terminal_id).toBe(eventInput.terminal_id);
          expect(result.event_type).toBe(eventInput.event_type);
          expect(result.ip_address).toBe(eventInput.ip_address);
          expect(result.user_agent).toBe(eventInput.user_agent);
          
          // Handle optional fields
          if (eventInput.employee_id !== undefined) {
            expect(result.employee_id).toBe(eventInput.employee_id);
          }
          if (eventInput.risk_score !== undefined) {
            expect(result.risk_score).toBe(eventInput.risk_score);
          }
          if (eventInput.fingerprint_match !== undefined) {
            expect(result.fingerprint_match).toBe(eventInput.fingerprint_match);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle login events with complete authentication context', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.uuid(),
        fc.constantFrom<AuthEventType>('login_success', 'login_failed'),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        ipAddressArb,
        userAgentArb,
        async (tenantId, terminalId, employeeId, eventType, riskScore, fingerprintMatch, ipAddress, userAgent) => {
          const eventInput: CreateAuthEventInput = {
            tenant_id: tenantId,
            terminal_id: terminalId,
            employee_id: employeeId,
            event_type: eventType,
            risk_score: riskScore,
            fingerprint_match: fingerprintMatch,
            ip_address: ipAddress,
            user_agent: userAgent,
          };

          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            metadata: {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // For login events, all authentication fields should be present
          expect(result.employee_id).toBe(employeeId);
          expect(result.risk_score).toBe(riskScore);
          expect(result.fingerprint_match).toBe(fingerprintMatch);
          expect(result.event_type).toMatch(/^login_(success|failed)$/);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle system events without employee context', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.constantFrom<AuthEventType>('terminal_created', 'activation_code_generated', 'terminal_disabled'),
        ipAddressArb,
        userAgentArb,
        async (tenantId, terminalId, eventType, ipAddress, userAgent) => {
          const eventInput: CreateAuthEventInput = {
            tenant_id: tenantId,
            terminal_id: terminalId,
            employee_id: null,
            event_type: eventType,
            ip_address: ipAddress,
            user_agent: userAgent,
          };

          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            risk_score: null,
            fingerprint_match: null,
            metadata: {},
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // For system events, employee_id can be null
          expect(result.employee_id).toBeNull();
          
          // But all other required fields must still be present
          expect(result.terminal_id).toBe(terminalId);
          expect(result.event_type).toBe(eventType);
          expect(result.created_at).toBeInstanceOf(Date);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle security events with risk assessment data', () => {
    fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 5, maxLength: 20 }),
        fc.uuid(),
        fc.constantFrom<AuthEventType>('fingerprint_drift_detected', 'step_up_auth_required', 'security_alert'),
        fc.integer({ min: 50, max: 100 }), // High risk scores for security events
        fc.integer({ min: 0, max: 70 }), // Lower fingerprint match for security events
        ipAddressArb,
        userAgentArb,
        async (tenantId, terminalId, employeeId, eventType, riskScore, fingerprintMatch, ipAddress, userAgent) => {
          const eventInput: CreateAuthEventInput = {
            tenant_id: tenantId,
            terminal_id: terminalId,
            employee_id: employeeId,
            event_type: eventType,
            risk_score: riskScore,
            fingerprint_match: fingerprintMatch,
            ip_address: ipAddress,
            user_agent: userAgent,
            metadata: {
              alert_reason: 'Suspicious activity detected',
            },
          };

          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventInput,
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventInput);

          // For security events, risk assessment data should be present
          expect(result.risk_score).toBeDefined();
          expect(result.risk_score).toBeGreaterThanOrEqual(50);
          expect(result.fingerprint_match).toBeDefined();
          expect(result.metadata).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data integrity across different event types', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(authEventInputArb, { minLength: 1, maxLength: 10 }),
        async (eventInputs) => {
          const results: any[] = [];

          for (const eventInput of eventInputs) {
            const mockCreatedEvent = {
              id: fc.sample(fc.uuid(), 1)[0],
              ...eventInput,
              employee_id: eventInput.employee_id ?? null,
              risk_score: eventInput.risk_score ?? null,
              fingerprint_match: eventInput.fingerprint_match ?? null,
              metadata: eventInput.metadata ?? {},
              created_at: new Date(),
            };

            vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

            const result = await logAuthEvent(eventInput);
            results.push(result as any);
          }

          // Verify all events have complete required fields
          for (const result of results) {
            expect(result).toHaveProperty('id');
            expect((result as any).tenant_id).toBeDefined();
            expect((result as any).terminal_id).toBeDefined();
            expect((result as any).employee_id).toBeDefined();
            expect((result as any).event_type).toBeDefined();
            expect((result as any).risk_score).toBeDefined();
            expect((result as any).fingerprint_match).toBeDefined();
            expect((result as any).created_at).toBeDefined();
          }

          // Verify each event maintains its unique data
          for (let i = 0; i < results.length; i++) {
            expect((results[i] as any).tenant_id).toBe(eventInputs[i].tenant_id);
            expect((results[i] as any).terminal_id).toBe(eventInputs[i].terminal_id);
            expect((results[i] as any).event_type).toBe(eventInputs[i].event_type);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle metadata without losing required fields', () => {
    fc.assert(
      fc.asyncProperty(
        authEventInputArb,
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 30 }),
          fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
        ),
        async (eventInput, metadata) => {
          const eventWithMetadata = {
            ...eventInput,
            metadata,
          };

          const mockCreatedEvent = {
            id: fc.sample(fc.uuid(), 1)[0],
            ...eventWithMetadata,
            employee_id: eventWithMetadata.employee_id ?? null,
            risk_score: eventWithMetadata.risk_score ?? null,
            fingerprint_match: eventWithMetadata.fingerprint_match ?? null,
            created_at: new Date(),
          };

          vi.mocked(prisma.auth_events.create).mockResolvedValue(mockCreatedEvent as never);

          const result = await logAuthEvent(eventWithMetadata);

          // Verify metadata doesn't interfere with required fields
          expect(result.tenant_id).toBe(eventInput.tenant_id);
          expect(result.terminal_id).toBe(eventInput.terminal_id);
          expect(result.event_type).toBe(eventInput.event_type);
          expect(result.created_at).toBeInstanceOf(Date);
          
          // Verify metadata is preserved
          expect(result.metadata).toBeDefined();
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

