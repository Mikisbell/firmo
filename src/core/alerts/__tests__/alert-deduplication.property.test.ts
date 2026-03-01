/**
 * Property Tests: Alert Deduplication
 *
 * Valida que el sistema de alertas deduplica correctamente alertas duplicadas
 * dentro de la ventana de 5 minutos.
 *
 * Uses mocked Prisma to avoid requiring a real database connection.
 *
 * **Validates: Requirements 15.7**
 *
 * @module core/alerts/__tests__/alert-deduplication.property.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { AlertSeverity } from '../alert-notifier';
import type { AlertType } from '../alert-config';
import { randomUUID } from 'crypto';

// Configure fast-check
fc.configureGlobal({
  numRuns: 10,
  verbose: false,
});

// In-memory stores for mocking
let alertEventsStore: any[] = [];
let alertConfigurationsStore: any[] = [];
let maintenanceWindowsStore: any[] = [];

// Mock Prisma before importing AlertNotifier
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
            const cutoff = where.created_at.gte;
            if (new Date(e.created_at) < cutoff) return false;
          }
          return true;
        });
        return Promise.resolve(match ?? null);
      }),
      findMany: vi.fn().mockImplementation(({ where } = {}) => {
        let results = [...alertEventsStore];
        if (where?.tenant_id) results = results.filter(e => e.tenant_id === where.tenant_id);
        if (where?.configuration_id) results = results.filter(e => e.configuration_id === where.configuration_id);
        return Promise.resolve(results);
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
      findFirst: vi.fn().mockResolvedValue(null), // No maintenance windows active
    },
  },
}));

// Mock logger to avoid console noise
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock metrics
vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    increment: vi.fn(),
    gauge: vi.fn(),
    timing: vi.fn(),
  },
}));

// Import after mocks
const { AlertNotifier } = await import('../alert-notifier');

describe('Property: Alert Deduplication', () => {
  let notifier: InstanceType<typeof AlertNotifier>;

  beforeEach(() => {
    notifier = new AlertNotifier();
    alertEventsStore = [];
    alertConfigurationsStore = [];
    maintenanceWindowsStore = [];
    vi.clearAllMocks();
  });

  /**
   * Property: Duplicate alerts within 5 minutes are suppressed
   *
   * Verifica que si se envía la misma alerta múltiples veces dentro de 5 minutos,
   * solo la primera se crea y las demás son deduplicadas.
   */
  it('deduplica alertas duplicadas dentro de 5 minutos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>('ERROR_RATE', 'RESPONSE_TIME'),
          severity: fc.constantFrom<AlertSeverity>('INFO', 'WARNING'),
          currentValue: fc.double({ min: 0, max: 100, noNaN: true }),
          thresholdValue: fc.double({ min: 0, max: 100, noNaN: true }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          attemptCount: fc.integer({ min: 2, max: 3 }),
        }),
        async (input) => {
          // Reset stores for each property test run
          alertEventsStore = [];
          alertConfigurationsStore = [];

          const tenantId = randomUUID();
          const configId = randomUUID();

          // Create mock config
          const alertConfig = {
            id: configId,
            tenantId: tenantId,
            alertType: input.alertType,
            thresholdValue: input.thresholdValue,
            thresholdUnit: 'PERCENTAGE' as const,
            comparisonOperator: 'GT' as const,
            enabled: true,
            notificationChannels: ['email' as const],
            notificationConfig: {
              email: { recipients: ['test@example.com'] },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const alertInput = {
            tenantId,
            configurationId: configId,
            alertType: input.alertType,
            severity: input.severity,
            currentValue: input.currentValue,
            thresholdValue: input.thresholdValue,
            message: input.message,
          };

          // Act: Intentar crear la misma alerta múltiples veces
          const results: (any | null)[] = [];

          for (let i = 0; i < input.attemptCount; i++) {
            const result = await notifier.createAndNotify(alertConfig, alertInput);
            results.push(result);
          }

          // Assert: Solo la primera alerta debe ser creada
          const createdAlerts = results.filter(r => r !== null);
          const deduplicatedAlerts = results.filter(r => r === null);

          expect(createdAlerts).toHaveLength(1);
          expect(deduplicatedAlerts).toHaveLength(input.attemptCount - 1);

          // Verificar que solo existe una alerta en el store
          const dbAlerts = alertEventsStore.filter(
            e => e.tenant_id === tenantId && e.configuration_id === configId
          );

          expect(dbAlerts).toHaveLength(1);
        }
      )
    );
  });
});
