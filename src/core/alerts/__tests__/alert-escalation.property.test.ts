/**
 * Property Tests: Alert Escalation
 * 
 * Valida que las alertas no reconocidas se escalan automáticamente después de 15 minutos.
 * 
 * **Validates: Requirements 15.8**
 * 
 * @module core/alerts/__tests__/alert-escalation.property.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { AlertNotifier, type AlertSeverity } from '../alert-notifier';
import { type AlertType } from '../alert-config';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';

// Configurar fast-check
fc.configureGlobal({
  numRuns: 2, // Reducir a 2 para tests más rápidos
  verbose: false,
});

// Almacenar IDs de prueba para limpieza
const testTenantIds = new Set<string>();
const testConfigIds = new Set<string>();
const testAlertIds = new Set<string>();

describe('Property: Alert Escalation', () => {
  let notifier: AlertNotifier;

  beforeEach(() => {
    notifier = new AlertNotifier();
    vi.clearAllMocks();
    
    // Mockear fetch para evitar llamadas HTTP reales
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });

  afterEach(async () => {
    // Limpiar datos de prueba usando los IDs almacenados
    if (testAlertIds.size > 0) {
      await prisma.alert_events.deleteMany({
        where: {
          id: {
            in: Array.from(testAlertIds),
          },
        },
      });
      testAlertIds.clear();
    }

    if (testConfigIds.size > 0) {
      await prisma.alert_configurations.deleteMany({
        where: {
          id: {
            in: Array.from(testConfigIds),
          },
        },
      });
      testConfigIds.clear();
    }

    testTenantIds.clear();
    
    // Restaurar fetch
    vi.restoreAllMocks();
  }, 60000); // Timeout de 60 segundos para cleanup

  /**
   * Property: Unacknowledged alerts escalate after 15 minutes
   * 
   * Verifica que las alertas activas que no han sido reconocidas después de 15 minutos
   * se marcan como escaladas y se envían notificaciones adicionales.
   */
  it('escala alertas no reconocidas después de 15 minutos', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>(
            'ERROR_RATE',
            'RESPONSE_TIME',
            'UPTIME',
            'CACHE_HIT_RATE'
          ),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100 }),
          thresholdValue: fc.double({ min: 0, max: 50 }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }), // Más de 15 minutos
        }),
        async (input) => {
          // Generar UUID válido para tenant
          const tenantId = randomUUID();
          testTenantIds.add(tenantId);

          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: tenantId,
              alert_type: input.alertType,
              threshold_value: input.thresholdValue,
              threshold_unit: 'PERCENTAGE',
              comparison_operator: 'GT',
              enabled: true,
              notification_channels: ['email', 'slack'],
              notification_config: {
                email: {
                  recipients: ['test@example.com'],
                },
                slack: {
                  webhookUrl: 'https://hooks.slack.com/test',
                },
              },
            },
          });
          testConfigIds.add(config.id);

          // Crear alerta antigua (más de 15 minutos)
          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          
          const alert = await prisma.alert_events.create({
            data: {
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
              notifications_sent: [],
              created_at: oldDate,
              updated_at: oldDate,
            },
          });
          testAlertIds.add(alert.id);

          // Act: Ejecutar escalación
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert: Verificar que la alerta fue escalada
          expect(escalatedCount).toBe(1);

          // Verificar que la alerta está marcada como escalada en la base de datos
          const escalatedAlert = await prisma.alert_events.findUnique({
            where: { id: alert.id },
          });

          expect(escalatedAlert).not.toBeNull();
          expect(escalatedAlert!.escalated).toBe(true);
          expect(escalatedAlert!.escalated_at).not.toBeNull();
          expect(escalatedAlert!.status).toBe('ACTIVE');

          // Verificar que escalated_at es posterior a created_at
          expect(escalatedAlert!.escalated_at!.getTime()).toBeGreaterThan(
            escalatedAlert!.created_at.getTime()
          );
        }
      )
    );
  });

  /**
   * Property: Acknowledged alerts are not escalated
   * 
   * Verifica que las alertas que ya han sido reconocidas NO se escalan,
   * incluso si han pasado más de 15 minutos desde su creación.
   */
  it('no escala alertas que ya han sido reconocidas', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>(
            'ERROR_RATE',
            'RESPONSE_TIME'
          ),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100 }),
          thresholdValue: fc.double({ min: 0, max: 50 }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          // Generar UUID válido para tenant y acknowledgedBy
          const tenantId = randomUUID();
          const acknowledgedBy = randomUUID(); // Usar UUID en lugar de string aleatorio
          testTenantIds.add(tenantId);

          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: tenantId,
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
          testConfigIds.add(config.id);

          // Crear alerta antigua pero reconocida
          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          
          const alert = await prisma.alert_events.create({
            data: {
              tenant_id: tenantId,
              configuration_id: config.id,
              alert_type: input.alertType,
              severity: input.severity,
              current_value: input.currentValue,
              threshold_value: input.thresholdValue,
              message: input.message,
              metadata: {},
              status: 'ACKNOWLEDGED', // Ya reconocida
              acknowledged_at: new Date(Date.now() - 5 * 60 * 1000), // Reconocida hace 5 minutos
              acknowledged_by: acknowledgedBy,
              escalated: false,
              notifications_sent: [],
              created_at: oldDate,
              updated_at: oldDate,
            },
          });
          testAlertIds.add(alert.id);

          // Act: Ejecutar escalación
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert: Verificar que NO se escaló ninguna alerta
          expect(escalatedCount).toBe(0);

          // Verificar que la alerta sigue sin estar escalada
          const unchangedAlert = await prisma.alert_events.findUnique({
            where: { id: alert.id },
          });

          expect(unchangedAlert).not.toBeNull();
          expect(unchangedAlert!.escalated).toBe(false);
          expect(unchangedAlert!.escalated_at).toBeNull();
          expect(unchangedAlert!.status).toBe('ACKNOWLEDGED');
        }
      )
    );
  });

  /**
   * Property: Already escalated alerts are not escalated again
   * 
   * Verifica que las alertas que ya han sido escaladas NO se escalan nuevamente,
   * evitando notificaciones duplicadas.
   */
  it('no escala alertas que ya han sido escaladas previamente', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>(
            'ERROR_RATE',
            'RESPONSE_TIME'
          ),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100 }),
          thresholdValue: fc.double({ min: 0, max: 50 }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          // Generar UUID válido para tenant
          const tenantId = randomUUID();
          testTenantIds.add(tenantId);

          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: tenantId,
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
          testConfigIds.add(config.id);

          // Crear alerta antigua ya escalada
          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          const escalatedDate = new Date(Date.now() - 5 * 60 * 1000); // Escalada hace 5 minutos
          
          const alert = await prisma.alert_events.create({
            data: {
              tenant_id: tenantId,
              configuration_id: config.id,
              alert_type: input.alertType,
              severity: input.severity,
              current_value: input.currentValue,
              threshold_value: input.thresholdValue,
              message: input.message,
              metadata: {},
              status: 'ACTIVE',
              escalated: true, // Ya escalada
              escalated_at: escalatedDate,
              notifications_sent: [],
              created_at: oldDate,
              updated_at: oldDate,
            },
          });
          testAlertIds.add(alert.id);

          // Act: Ejecutar escalación
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert: Verificar que NO se escaló ninguna alerta
          expect(escalatedCount).toBe(0);

          // Verificar que la alerta mantiene su estado de escalación original
          const unchangedAlert = await prisma.alert_events.findUnique({
            where: { id: alert.id },
          });

          expect(unchangedAlert).not.toBeNull();
          expect(unchangedAlert!.escalated).toBe(true);
          expect(unchangedAlert!.escalated_at).toEqual(escalatedDate);
          expect(unchangedAlert!.status).toBe('ACTIVE');
        }
      )
    );
  });

  /**
   * Property: Recent alerts (< 15 minutes) are not escalated
   * 
   * Verifica que las alertas recientes (menos de 15 minutos) NO se escalan,
   * respetando el tiempo de espera antes de la escalación.
   */
  it('no escala alertas recientes (menos de 15 minutos)', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertType: fc.constantFrom<AlertType>(
            'ERROR_RATE',
            'RESPONSE_TIME'
          ),
          severity: fc.constantFrom<AlertSeverity>('WARNING', 'CRITICAL'),
          currentValue: fc.double({ min: 50, max: 100 }),
          thresholdValue: fc.double({ min: 0, max: 50 }),
          message: fc.string({ minLength: 10, maxLength: 50 }),
          minutesAgo: fc.integer({ min: 1, max: 14 }), // Menos de 15 minutos
        }),
        async (input) => {
          // Generar UUID válido para tenant
          const tenantId = randomUUID();
          testTenantIds.add(tenantId);

          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: tenantId,
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
          testConfigIds.add(config.id);

          // Crear alerta reciente (menos de 15 minutos)
          const recentDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          
          const alert = await prisma.alert_events.create({
            data: {
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
              notifications_sent: [],
              created_at: recentDate,
              updated_at: recentDate,
            },
          });
          testAlertIds.add(alert.id);

          // Act: Ejecutar escalación
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert: Verificar que NO se escaló ninguna alerta
          expect(escalatedCount).toBe(0);

          // Verificar que la alerta sigue sin estar escalada
          const unchangedAlert = await prisma.alert_events.findUnique({
            where: { id: alert.id },
          });

          expect(unchangedAlert).not.toBeNull();
          expect(unchangedAlert!.escalated).toBe(false);
          expect(unchangedAlert!.escalated_at).toBeNull();
          expect(unchangedAlert!.status).toBe('ACTIVE');
        }
      )
    );
  });

  /**
   * Property: Multiple unacknowledged alerts are all escalated
   * 
   * Verifica que cuando hay múltiples alertas no reconocidas,
   * todas se escalan correctamente.
   */
  it('escala múltiples alertas no reconocidas simultáneamente', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          alertCount: fc.integer({ min: 2, max: 4 }),
          minutesAgo: fc.integer({ min: 16, max: 30 }),
        }),
        async (input) => {
          // Generar UUID válido para tenant
          const tenantId = randomUUID();
          testTenantIds.add(tenantId);

          // Arrange: Crear configuración de alerta
          const config = await prisma.alert_configurations.create({
            data: {
              tenant_id: tenantId,
              alert_type: 'ERROR_RATE',
              threshold_value: 50,
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
          testConfigIds.add(config.id);

          // Crear múltiples alertas antiguas
          const oldDate = new Date(Date.now() - input.minutesAgo * 60 * 1000);
          
          const alertPromises = Array.from({ length: input.alertCount }, (_, i) =>
            prisma.alert_events.create({
              data: {
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
                notifications_sent: [],
                created_at: oldDate,
                updated_at: oldDate,
              },
            })
          );

          const alerts = await Promise.all(alertPromises);
          alerts.forEach(alert => testAlertIds.add(alert.id));

          // Act: Ejecutar escalación
          const escalatedCount = await notifier.escalateUnacknowledgedAlerts(tenantId);

          // Assert: Verificar que todas las alertas fueron escaladas
          expect(escalatedCount).toBe(input.alertCount);

          // Verificar que todas las alertas están marcadas como escaladas
          const escalatedAlerts = await prisma.alert_events.findMany({
            where: {
              tenant_id: tenantId,
              configuration_id: config.id,
            },
          });

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
