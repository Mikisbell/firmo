/**
 * Property Tests: Alert Escalation
 *
 * Valida que las alertas no reconocidas se escalan automáticamente después de 15 minutos.
 *
 * Uses mocked Prisma to avoid requiring a real database connection.
 *
 * **Validates: Requirements 15.8**
 *
 * @module core/alerts/__tests__/alert-escalation.property.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { AlertSeverity } from '../alert-notifier';
import type { AlertType } from '../alert-config';
import { randomUUID } from 'crypto';

// Configurar fast-check
fc.configureGlobal({
  numRuns: 2,
  verbose: false,
});

// In-memory stores
let alertEventsStore: any[] = [];
let alertConfigurationsStore: any[] = [];

// Mock Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    alert_events: {
      create: vi.fn().mockImplementation(({ data }) => {
        const record = {
          id: randomUUID(),
          ...data,
          created_at: data.created_at ?? new Date(),
          updated_at: data.updated_at ?? new Date(),
        };
        alertEventsStore.push(record);
        return Promise.resolve(record);
      }),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const match = alertEventsStore.find(e => {
          if (where.tenant_id && e.tenant_id !== where.tenant_id) return false;
          if (where.configuration_id && e.configuration_id !== where.configuration_id) return false;
          if (where.status && e.status !== where.status) return false;
          if (where.created_at?.gte) {
            if (new Date(e.created_at) < where.created_at.gte) return false;
          }
          return true;
        });
        return Promise.resolve(match ?? null);
      }),
      findMany: vi.fn().mockImplementation(({ where, include } = {}) => {
        let results = [...alertEventsStore];
        if (where?.tenant_id) results = results.filter(e => e.tenant_id === where.tenant_id);
        if (where?.status) results = results.filter(e => e.status === where.status);
        if (where?.escalated !== undefined) results = results.filter(e => e.escalated === where.escalated);
        if (where?.created_at?.lte) {
          const cutoff = where.created_at.lte;
          results = results.filter(e => new Date(e.created_at) <= cutoff);
        }
        // If include configuration, attach it
        if (include?.configuration) {
          results = results.map(e => ({
            ...e,
            configuration: alertConfigurationsStore.find(c => c.id === e.configuration_id) || null,
          }));
        }
        return Promise.resolve(results);
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        const match = alertEventsStore.find(e => e.id === where.id);
        return Promise.resolve(match ?? null);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const idx = alertEventsStore.findIndex(e => e.id === where.id);
        if (idx >= 0) {
          alertEventsStore[idx] = { ...alertEventsStore[idx], ...data };
          return Promise.resolve(alertEventsStore[idx]);
        }
        return Promise.reject(new Error('Not found'));
      }),
      deleteMany: vi.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
    },
    alert_configurations: {
      create: vi.fn().mockImplementation(({ data }) => {
        const record = {
          id: randomUUID(),
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: data.created_by ?? null,
          updated_by: data.updated_by ?? null,
        };
        alertConfigurationsStore.push(record);
        return Promise.resolve(record);
      }),
      deleteMany: vi.fn().mockImplementation(() => Promise.resolve({ count: 0 })),
    },
    maintenance_windows: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock logger
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock metrics
vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    gauge: vi.fn(),
    timing: vi.fn(),
  },
}));

// Mock fetch for slack notifications
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({}),
} as Response);

// Import after mocks
const { AlertNotifier } = await import('../alert-notifier');

describe('Property: Alert Escalation', () => {
  let notifier: InstanceType<typeof AlertNotifier>;

  beforeEach(() => {
    notifier = new AlertNotifier();
    alertEventsStore = [];
    alertConfigurationsStore = [];
    vi.clearAllMocks();

    // Re-mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });

  /**
   * Property: Unacknowledged alerts escalate after 15 minutes
   */
  it('escala alertas no reconocidas después de 15 minutos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>('ERROR_RATE', 'RESPONSE_TIME', 'UPTIME', 'CACHE_HIT_RATE'),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100, noNaN: true }),
          thresholdValue: fc.double({ min: 0, max: 50, noNaN: true }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          // Reset stores
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();

          // Create config
          const config = {
            id: randomUUID(),
            tenant_id: tenantId,
            alert_type: input.alertType,
            threshold_value: input.thresholdValue,
            threshold_unit: 'PERCENTAGE',
            comparison_operator: 'GT',
            enabled: true,
            notification_channels: ['email', 'slack'],
            notification_config: {
              email: { recipients: ['test@example.com'] },
              slack: { webhookUrl: 'https://hooks.slack.com/test' },
            },
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
          };
          alertConfigurationsStore.push(config);

          // Create old alert (more than 15 minutes ago)
          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          const alert = {
            id: randomUUID(),
            tenant_id: tenantId,
            configuration_id: config.id,
            alert_type: input.alertType,
            severity: input.severity,
            current_value: input.currentValue,
            threshold_value: input.thresholdValue,
            message: input.message,
            metadata: {},
            status: 'ACTIVE',
            escalated: false,
            escalated_at: null,
            acknowledged_at: null,
            acknowledged_by: null,
            resolved_at: null,
            resolved_by: null,
            snoozed_until: null,
            notifications_sent: [],
            created_at: oldDate,
            updated_at: oldDate,
          };
          alertEventsStore.push(alert);

          // Act: escalate
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert
          expect(escalatedCount).toBe(1);

          const escalatedAlert = alertEventsStore.find(e => e.id === alert.id);
          expect(escalatedAlert).not.toBeNull();
          expect(escalatedAlert!.escalated).toBe(true);
          expect(escalatedAlert!.escalated_at).not.toBeNull();
          expect(escalatedAlert!.status).toBe('ACTIVE');
        }
      )
    );
  });

  /**
   * Property: Acknowledged alerts are not escalated
   */
  it('no escala alertas que ya han sido reconocidas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>('ERROR_RATE', 'RESPONSE_TIME'),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100, noNaN: true }),
          thresholdValue: fc.double({ min: 0, max: 50, noNaN: true }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();

          const config = {
            id: randomUUID(),
            tenant_id: tenantId,
            alert_type: input.alertType,
            threshold_value: input.thresholdValue,
            threshold_unit: 'PERCENTAGE',
            comparison_operator: 'GT',
            enabled: true,
            notification_channels: ['email'],
            notification_config: { email: { recipients: ['test@example.com'] } },
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
          };
          alertConfigurationsStore.push(config);

          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          const alert = {
            id: randomUUID(),
            tenant_id: tenantId,
            configuration_id: config.id,
            alert_type: input.alertType,
            severity: input.severity,
            current_value: input.currentValue,
            threshold_value: input.thresholdValue,
            message: input.message,
            metadata: {},
            status: 'ACKNOWLEDGED', // Already acknowledged
            acknowledged_at: new Date(Date.now() - 5 * 60 * 1000),
            acknowledged_by: randomUUID(),
            escalated: false,
            escalated_at: null,
            resolved_at: null,
            resolved_by: null,
            snoozed_until: null,
            notifications_sent: [],
            created_at: oldDate,
            updated_at: oldDate,
          };
          alertEventsStore.push(alert);

          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          expect(escalatedCount).toBe(0);

          const unchangedAlert = alertEventsStore.find(e => e.id === alert.id);
          expect(unchangedAlert!.escalated).toBe(false);
          expect(unchangedAlert!.escalated_at).toBeNull();
          expect(unchangedAlert!.status).toBe('ACKNOWLEDGED');
        }
      )
    );
  });

  /**
   * Property: Already escalated alerts are not escalated again
   */
  it('no escala alertas que ya han sido escaladas previamente', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>('ERROR_RATE', 'RESPONSE_TIME'),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100, noNaN: true }),
          thresholdValue: fc.double({ min: 0, max: 50, noNaN: true }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();
          const escalatedDate = new Date(Date.now() - 5 * 60 * 1000);

          const config = {
            id: randomUUID(),
            tenant_id: tenantId,
            alert_type: input.alertType,
            threshold_value: input.thresholdValue,
            threshold_unit: 'PERCENTAGE',
            comparison_operator: 'GT',
            enabled: true,
            notification_channels: ['email'],
            notification_config: { email: { recipients: ['test@example.com'] } },
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
          };
          alertConfigurationsStore.push(config);

          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          const alert = {
            id: randomUUID(),
            tenant_id: tenantId,
            configuration_id: config.id,
            alert_type: input.alertType,
            severity: input.severity,
            current_value: input.currentValue,
            threshold_value: input.thresholdValue,
            message: input.message,
            metadata: {},
            status: 'ACTIVE',
            escalated: true, // Already escalated
            escalated_at: escalatedDate,
            acknowledged_at: null,
            acknowledged_by: null,
            resolved_at: null,
            resolved_by: null,
            snoozed_until: null,
            notifications_sent: [],
            created_at: oldDate,
            updated_at: oldDate,
          };
          alertEventsStore.push(alert);

          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          expect(escalatedCount).toBe(0);

          const unchangedAlert = alertEventsStore.find(e => e.id === alert.id);
          expect(unchangedAlert!.escalated).toBe(true);
          expect(unchangedAlert!.status).toBe('ACTIVE');
        }
      )
    );
  });

  /**
   * Property: Recent alerts (< 15 minutes) are not escalated
   */
  it('no escala alertas recientes (menos de 15 minutos)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>('ERROR_RATE', 'RESPONSE_TIME'),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100, noNaN: true }),
          thresholdValue: fc.double({ min: 0, max: 50, noNaN: true }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 1, max: 14 }),
        }),
        async (input) => {
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();

          const config = {
            id: randomUUID(),
            tenant_id: tenantId,
            alert_type: input.alertType,
            threshold_value: input.thresholdValue,
            threshold_unit: 'PERCENTAGE',
            comparison_operator: 'GT',
            enabled: true,
            notification_channels: ['email'],
            notification_config: { email: { recipients: ['test@example.com'] } },
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
          };
          alertConfigurationsStore.push(config);

          const recentDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          const alert = {
            id: randomUUID(),
            tenant_id: tenantId,
            configuration_id: config.id,
            alert_type: input.alertType,
            severity: input.severity,
            current_value: input.currentValue,
            threshold_value: input.thresholdValue,
            message: input.message,
            metadata: {},
            status: 'ACTIVE',
            escalated: false,
            escalated_at: null,
            acknowledged_at: null,
            acknowledged_by: null,
            resolved_at: null,
            resolved_by: null,
            snoozed_until: null,
            notifications_sent: [],
            created_at: recentDate,
            updated_at: recentDate,
          };
          alertEventsStore.push(alert);

          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          expect(escalatedCount).toBe(0);

          const unchangedAlert = alertEventsStore.find(e => e.id === alert.id);
          expect(unchangedAlert!.escalated).toBe(false);
          expect(unchangedAlert!.escalated_at).toBeNull();
          expect(unchangedAlert!.status).toBe('ACTIVE');
        }
      )
    );
  });

  /**
   * Property: Multiple unacknowledged alerts are all escalated
   */
  it('escala múltiples alertas no reconocidas simultáneamente', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertCount: fc.integer({ min: 2, max: 4 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();

          const config = {
            id: randomUUID(),
            tenant_id: tenantId,
            alert_type: 'ERROR_RATE',
            threshold_value: 50,
            threshold_unit: 'PERCENTAGE',
            comparison_operator: 'GT',
            enabled: true,
            notification_channels: ['email'],
            notification_config: { email: { recipients: ['test@example.com'] } },
            created_at: new Date(),
            updated_at: new Date(),
            created_by: null,
            updated_by: null,
          };
          alertConfigurationsStore.push(config);

          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);

          for (let i = 0; i < input.alertCount; i++) {
            alertEventsStore.push({
              id: randomUUID(),
              tenant_id: tenantId,
              configuration_id: config.id,
              alert_type: 'ERROR_RATE',
              severity: 'WARNING',
              current_value: 75 + i,
              threshold_value: 50,
              message: `Test alert ${i + 1}`,
              metadata: {},
              status: 'ACTIVE',
              escalated: false,
              escalated_at: null,
              acknowledged_at: null,
              acknowledged_by: null,
              resolved_at: null,
              resolved_by: null,
              snoozed_until: null,
              notifications_sent: [],
              created_at: oldDate,
              updated_at: oldDate,
            });
          }

          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          expect(escalatedCount).toBe(input.alertCount);

          const escalatedAlerts = alertEventsStore.filter(
            e => e.tenant_id === tenantId && e.configuration_id === config.id
          );

          expect(escalatedAlerts).toHaveLength(input.alertCount);

          for (const alert of escalatedAlerts) {
            expect(alert.escalated).toBe(true);
            expect(alert.escalated_at).not.toBeNull();
            expect(alert.status).toBe('ACTIVE');
          }
        }
      )
    );
  });
});
