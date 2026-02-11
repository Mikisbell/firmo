/**
 * Property Tests: Alert Deduplication
 * 
 * Valida que el sistema de alertas deduplica correctamente alertas duplicadas
 * dentro de la ventana de 5 minutos.
 * 
 * **Validates: Requirements 15.7**
 * 
 * @module core/alerts/__tests__/alert-deduplication.property.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AlertNotifier, type CreateAlertEventInput, type AlertSeverity } from '../alert-notifier';
import { type AlertConfiguration, type AlertType } from '../alert-config';
import prisma from '@/src/core/db/prisma';

// Configure fast-check
fc.configureGlobal({
  numRuns: 10, // Reducir para tests más rápidos
  verbose: false,
});

describe('Property: Alert Deduplication', () => {
  let notifier: AlertNotifier;

  beforeEach(() => {
    notifier = new AlertNotifier();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Limpiar datos de prueba
    await prisma.alert_events.deleteMany({
      where: {
        tenant_id: {
          // contains: 'test-tenant-',
        },
      },
    });

    await prisma.alert_configurations.deleteMany({
      where: {
        tenant_id: {
          // contains: 'test-tenant-',
        },
      },
    });
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
          tenantId: fc.string({ minLength: 10, maxLength: 20 }).map(s => `test-tenant-${s}`),
          alertType: fc.constantFrom<AlertType>(
            'ERROR_RATE',
            'RESPONSE_TIME'
          ),
          severity: fc.constantFrom<AlertSeverity>('INFO', 'WARNING'),
          currentValue: fc.double({ min: 0, max: 100 }),
          thresholdValue: fc.double({ min: 0, max: 100 }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          attemptCount: fc.integer({ min: 2, max: 3 }),
        }),
        async (input) => {
          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: input.tenantId,
              alert_type: input.alertType,
              threshold_value: input.thresholdValue,
              threshold_unit: 'PERCENTAGE',
              comparison_operator: 'GT',
              enabled: true,
              notification_channels: ['email'],
              notification_config: {
                email: {
                  recipients: ['test@example.com'],
                },
              },
            },
          });

          const alertConfig: AlertConfiguration = {
            id: config.id,
            tenantId: config.tenant_id,
            alertType: config.alert_type as AlertType,
            thresholdValue: Number(config.threshold_value),
            thresholdUnit: config.threshold_unit as import('../alert-config').ThresholdUnit,
            comparisonOperator: config.comparison_operator as import('../alert-config').ComparisonOperator,
            enabled: config.enabled,
            notificationChannels: config.notification_channels as any[],
            notificationConfig: config.notification_config as any,
            createdAt: config.created_at,
            updatedAt: config.updated_at,
            createdBy: config.created_by ?? undefined,
            updatedBy: config.updated_by ?? undefined,
          };

          const alertInput: CreateAlertEventInput = {
            tenantId: input.tenantId,
            configurationId: config.id,
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
            await new Promise(resolve => setTimeout(resolve, 10));
          }

          // Assert: Solo la primera alerta debe ser creada
          const createdAlerts = results.filter(r => r !== null);
          const deduplicatedAlerts = results.filter(r => r === null);

          expect(createdAlerts).toHaveLength(1);
          expect(deduplicatedAlerts).toHaveLength(input.attemptCount - 1);

          // Verificar que solo existe una alerta en la base de datos
          const dbAlerts = await prisma.alert_events.findMany({
            where: {
              tenant_id: input.tenantId,
              configuration_id: config.id,
            },
          });

          expect(dbAlerts).toHaveLength(1);
        }
      )
    );
  });
});
