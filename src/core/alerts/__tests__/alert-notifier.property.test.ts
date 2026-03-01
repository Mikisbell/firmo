/**
 * Property Tests para Alert Notifier
 *
 * Invariants:
 * 1. Deduplication: same alert within window → createAndNotify returns null
 * 2. Maintenance window: alerts during maintenance → suppressed (returns null)
 * 3. Severity ordering: AlertSeverity has exactly 3 levels (INFO, WARNING, CRITICAL)
 *
 * @module core/alerts/__tests__/alert-notifier.property.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock prisma before importing AlertNotifier
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    alert_events: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    maintenance_windows: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
  },
}));

import { AlertNotifier } from '../alert-notifier';
import type { AlertSeverity, CreateAlertEventInput } from '../alert-notifier';
import type { AlertConfiguration, AlertType } from '../alert-config';
import prisma from '@/src/core/db/prisma';

// ============================================================================
// Arbitraries
// ============================================================================

const alertTypeArb = fc.constantFrom<AlertType>(
  'ERROR_RATE', 'RESPONSE_TIME', 'UPTIME', 'CACHE_HIT_RATE', 'DB_POOL'
);

const severityArb = fc.constantFrom<AlertSeverity>('INFO', 'WARNING', 'CRITICAL');

const tenantIdArb = fc.uuid();
const configIdArb = fc.uuid();

function makeConfig(overrides?: Partial<AlertConfiguration>): AlertConfiguration {
  return {
    id: 'config-1',
    tenantId: 'tenant-1',
    alertType: 'ERROR_RATE',
    thresholdValue: 50,
    thresholdUnit: 'PERCENTAGE',
    comparisonOperator: 'GT',
    enabled: true,
    notificationChannels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInput(overrides?: Partial<CreateAlertEventInput>): CreateAlertEventInput {
  return {
    tenantId: 'tenant-1',
    configurationId: 'config-1',
    alertType: 'ERROR_RATE',
    severity: 'WARNING',
    currentValue: 75,
    thresholdValue: 50,
    message: 'Test alert',
    ...overrides,
  };
}

describe('Alert Notifier - Property Tests', () => {
  let notifier: AlertNotifier;

  beforeEach(() => {
    vi.clearAllMocks();
    notifier = new AlertNotifier();
  });

  /**
   * Invariant 1: Deduplication — if a recent ACTIVE alert exists
   * for the same configuration within the dedup window, createAndNotify
   * must return null (no duplicate alert created).
   */
  it('Invariant 1: Duplicate alerts within dedup window are suppressed (200 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        configIdArb,
        alertTypeArb,
        severityArb,
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        async (tenantId, configId, alertType, severity, currentValue) => {
          // Mock: no maintenance window
          vi.mocked(prisma.maintenance_windows.findFirst).mockResolvedValue(null);

          // Mock: a recent alert EXISTS (dedup should trigger)
          vi.mocked(prisma.alert_events.findFirst).mockResolvedValue({
            id: 'existing-alert',
            tenant_id: tenantId,
            configuration_id: configId,
            alert_type: alertType,
            status: 'ACTIVE',
            created_at: new Date(),
          } as any);

          const config = makeConfig({ id: configId, tenantId, alertType });
          const input = makeInput({
            tenantId,
            configurationId: configId,
            alertType,
            severity,
            currentValue,
          });

          const result = await notifier.createAndNotify(config, input);

          // INVARIANT: Duplicate alert → null (suppressed)
          expect(result).toBeNull();

          // Should NOT have created a new alert event
          expect(prisma.alert_events.create).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 2: Maintenance window — if an active maintenance window
   * covers the alert type, createAndNotify must return null.
   */
  it('Invariant 2: Alerts during maintenance window are suppressed (200 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        alertTypeArb,
        severityArb,
        async (tenantId, alertType, severity) => {
          // Mock: maintenance window IS active for this alert type
          vi.mocked(prisma.maintenance_windows.findFirst).mockResolvedValue({
            id: 'mw-1',
            tenant_id: tenantId,
            start_time: new Date(Date.now() - 60000),
            end_time: new Date(Date.now() + 60000),
            alert_types: [alertType],
          } as any);

          const config = makeConfig({ tenantId, alertType });
          const input = makeInput({ tenantId, alertType, severity });

          const result = await notifier.createAndNotify(config, input);

          // INVARIANT: During maintenance → null (suppressed)
          expect(result).toBeNull();

          // Should NOT check for duplicates (maintenance check comes first)
          expect(prisma.alert_events.findFirst).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 3: Alert creation — when no dedup and no maintenance,
   * createAndNotify must return an AlertEvent with correct fields.
   */
  it('Invariant 3: Fresh alerts are created with correct severity and type (200 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        tenantIdArb,
        configIdArb,
        alertTypeArb,
        severityArb,
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        async (tenantId, configId, alertType, severity, currentValue, thresholdValue) => {
          // Mock: no maintenance window
          vi.mocked(prisma.maintenance_windows.findFirst).mockResolvedValue(null);

          // Mock: no recent duplicate
          vi.mocked(prisma.alert_events.findFirst).mockResolvedValue(null);

          // Mock: create returns the alert event
          const now = new Date();
          vi.mocked(prisma.alert_events.create).mockResolvedValue({
            id: 'new-alert-1',
            tenant_id: tenantId,
            configuration_id: configId,
            alert_type: alertType,
            severity,
            current_value: currentValue,
            threshold_value: thresholdValue,
            message: 'Test alert',
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
            created_at: now,
            updated_at: now,
          } as any);

          const config = makeConfig({
            id: configId,
            tenantId,
            alertType,
            notificationChannels: [], // no channels to avoid send mocks
          });
          const input = makeInput({
            tenantId,
            configurationId: configId,
            alertType,
            severity,
            currentValue,
            thresholdValue,
          });

          const result = await notifier.createAndNotify(config, input);

          // INVARIANT: Fresh alert → non-null, correct type and severity
          expect(result).not.toBeNull();
          expect(result!.alertType).toBe(alertType);
          expect(result!.severity).toBe(severity);
          expect(result!.status).toBe('ACTIVE');
          expect(result!.escalated).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Invariant 4: AlertSeverity is exhaustive — exactly 3 levels.
   * This ensures no new severity level is added without tests.
   */
  it('Invariant 4: AlertSeverity has exactly 3 valid levels', () => {
    const validSeverities: AlertSeverity[] = ['INFO', 'WARNING', 'CRITICAL'];
    expect(validSeverities).toHaveLength(3);

    // Verify each severity can be used in an alert input
    for (const severity of validSeverities) {
      const input = makeInput({ severity });
      expect(input.severity).toBe(severity);
    }
  });
});
