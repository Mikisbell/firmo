/**
 * Sistema de Notificación de Alertas
 * 
 * Gestiona el envío de notificaciones de alertas a través de múltiples canales:
 * - Email: Envío de correos electrónicos
 * - Slack: Mensajes a canales de Slack
 * - Webhook: Llamadas HTTP a endpoints personalizados
 * 
 * Características:
 * - Deduplicación: Evita enviar alertas duplicadas dentro de una ventana de 5 minutos
 * - Escalación: Escala alertas no reconocidas después de 15 minutos
 * - Snoozing: Permite silenciar alertas durante ventanas de mantenimiento
 * 
 * @module core/alerts/alert-notifier
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';
import { sendEmail, buildAlertEmailHtml } from '@/src/core/notifications/email.service';
import type { AlertConfiguration, AlertType, NotificationChannel } from './alert-config';

/**
 * Severidad de una alerta
 */
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * Estado de una alerta
 */
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SNOOZED';

/**
 * Evento de alerta
 */
export interface AlertEvent {
  id: string;
  tenantId: string;
  configurationId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  currentValue: number;
  thresholdValue: number;
  message: string;
  metadata?: Record<string, unknown>;
  status: AlertStatus;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  snoozedUntil?: Date;
  escalated: boolean;
  escalatedAt?: Date;
  notificationsSent: NotificationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Registro de notificación enviada
 */
export interface NotificationRecord {
  channel: NotificationChannel;
  sentAt: Date;
  success: boolean;
  error?: string;
}

/**
 * Datos para crear un evento de alerta
 */
export interface CreateAlertEventInput {
  tenantId: string;
  configurationId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  currentValue: number;
  thresholdValue: number;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Ventana de mantenimiento
 */
export interface MaintenanceWindow {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  alertTypes: AlertType[];
  createdAt: Date;
  createdBy?: string;
}

/**
 * Servicio de Notificación de Alertas
 * 
 * Gestiona el ciclo de vida completo de las alertas:
 * - Creación y deduplicación
 * - Envío de notificaciones
 * - Escalación automática
 * - Reconocimiento y resolución
 * - Snoozing durante mantenimiento
 */
export class AlertNotifier {
  // Ventana de deduplicación: 5 minutos
  private readonly DEDUPLICATION_WINDOW_MS = 5 * 60 * 1000;
  
  // Tiempo de escalación: 15 minutos
  private readonly ESCALATION_TIMEOUT_MS = 15 * 60 * 1000;

  /**
   * Crear y enviar una alerta
   * 
   * Verifica deduplicación, ventanas de mantenimiento y envía notificaciones.
   * 
   * @param config - Configuración de la alerta
   * @param input - Datos del evento de alerta
   * @returns Evento de alerta creado o null si fue deduplicado/snoozed
   */
  async createAndNotify(
    config: AlertConfiguration,
    input: CreateAlertEventInput
  ): Promise<AlertEvent | null> {
    try {
      // Verificar si la alerta está en ventana de mantenimiento
      const isSnoozed = await this.isInMaintenanceWindow(
        input.tenantId,
        input.alertType
      );

      if (isSnoozed) {
        logger.info('Alerta silenciada por ventana de mantenimiento', {
          tenantId: input.tenantId,
          alertType: input.alertType,
        });
        
        metrics.increment('alert.snoozed', {
          tenantId: input.tenantId,
          alertType: input.alertType,
        });
        
        return null;
      }

      // Verificar deduplicación
      const isDuplicate = await this.isDuplicateAlert(
        input.tenantId,
        input.configurationId,
        this.DEDUPLICATION_WINDOW_MS
      );

      if (isDuplicate) {
        logger.info('Alerta deduplicada', {
          tenantId: input.tenantId,
          alertType: input.alertType,
        });
        
        metrics.increment('alert.deduplicated', {
          tenantId: input.tenantId,
          alertType: input.alertType,
        });
        
        return null;
      }

      // Crear evento de alerta
      const alertEvent = await this.createAlertEvent(input);

      // Enviar notificaciones
      await this.sendNotifications(config, alertEvent);

      logger.info('Alerta creada y notificaciones enviadas', {
        tenantId: input.tenantId,
        alertType: input.alertType,
        alertId: alertEvent.id,
      });

      metrics.increment('alert.created', {
        tenantId: input.tenantId,
        alertType: input.alertType,
        severity: input.severity,
      });

      return alertEvent;
    } catch (error) {
      logger.error('Error al crear y notificar alerta', error as Error, {
        tenantId: input.tenantId,
        alertType: input.alertType,
      });
      throw error;
    }
  }

  /**
   * Verificar si existe una alerta duplicada reciente
   * 
   * @param tenantId - ID del tenant
   * @param configurationId - ID de la configuración
   * @param windowMs - Ventana de tiempo en milisegundos
   * @returns true si existe una alerta duplicada
   */
  private async isDuplicateAlert(
    tenantId: string,
    configurationId: string,
    windowMs: number
  ): Promise<boolean> {
    const cutoffTime = new Date(Date.now() - windowMs);

    const recentAlert = await prisma.alert_events.findFirst({
      where: {
        tenant_id: tenantId,
        configuration_id: configurationId,
        status: 'ACTIVE',
        created_at: {
          gte: cutoffTime,
        },
      },
    });

    return recentAlert !== null;
  }

  /**
   * Verificar si la alerta está en ventana de mantenimiento
   * 
   * @param tenantId - ID del tenant
   * @param alertType - Tipo de alerta
   * @returns true si está en ventana de mantenimiento
   */
  private async isInMaintenanceWindow(
    tenantId: string,
    alertType: AlertType
  ): Promise<boolean> {
    const now = new Date();

    const activeWindow = await prisma.maintenance_windows.findFirst({
      where: {
        tenant_id: tenantId,
        start_time: {
          lte: now,
        },
        end_time: {
          gte: now,
        },
        alert_types: {
          has: alertType,
        },
      },
    });

    return activeWindow !== null;
  }

  /**
   * Crear un evento de alerta en la base de datos
   * 
   * @param input - Datos del evento
   * @returns Evento de alerta creado
   */
  private async createAlertEvent(input: CreateAlertEventInput): Promise<AlertEvent> {
    const event = await prisma.alert_events.create({
      data: {
        tenant_id: input.tenantId,
        configuration_id: input.configurationId,
        alert_type: input.alertType,
        severity: input.severity,
        current_value: input.currentValue,
        threshold_value: input.thresholdValue,
        message: input.message,
        metadata: (input.metadata ?? {}) as any,
        status: 'ACTIVE',
        escalated: false,
        notifications_sent: [] as any,
      },
    });

    return this.mapToAlertEvent(event);
  }

  /**
   * Enviar notificaciones a través de todos los canales configurados
   * 
   * @param config - Configuración de la alerta
   * @param alertEvent - Evento de alerta
   */
  private async sendNotifications(
    config: AlertConfiguration,
    alertEvent: AlertEvent
  ): Promise<void> {
    const notificationsSent: NotificationRecord[] = [];

    for (const channel of config.notificationChannels) {
      try {
        let success = false;
        let error: string | undefined;

        switch (channel) {
          case 'email':
            success = await this.sendEmailNotification(config, alertEvent);
            break;
          case 'slack':
            success = await this.sendSlackNotification(config, alertEvent);
            break;
          case 'webhook':
            success = await this.sendWebhookNotification(config, alertEvent);
            break;
        }

        notificationsSent.push({
          channel,
          sentAt: new Date(),
          success,
          error,
        });

        metrics.increment('alert.notification.sent', {
          tenantId: alertEvent.tenantId,
          alertType: alertEvent.alertType,
          channel,
          success: success.toString(),
        });
      } catch (err) {
        const error = err as Error;
        logger.error(`Error al enviar notificación por ${channel}`, error, {
          tenantId: alertEvent.tenantId,
          alertId: alertEvent.id,
        });

        notificationsSent.push({
          channel,
          sentAt: new Date(),
          success: false,
          error: error.message,
        });
      }
    }

    // Actualizar evento con notificaciones enviadas
    await prisma.alert_events.update({
      where: { id: alertEvent.id },
      data: {
        notifications_sent: notificationsSent as any,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Enviar notificación por email
   * 
   * @param config - Configuración de la alerta
   * @param alertEvent - Evento de alerta
   * @returns true si se envió exitosamente
   */
  private async sendEmailNotification(
    config: AlertConfiguration,
    alertEvent: AlertEvent
  ): Promise<boolean> {
    const recipients = config.notificationConfig?.email?.recipients;

    if (!recipients || recipients.length === 0) {
      logger.warn('No hay destinatarios de email configurados', {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
      });
      return false;
    }

    const subject = config.notificationConfig?.email?.subject
      ?? `[${alertEvent.severity}] ${alertEvent.alertType} — PARK POS`;

    const html = buildAlertEmailHtml({
      alertType: alertEvent.alertType,
      severity: alertEvent.severity,
      message: alertEvent.message,
      currentValue: alertEvent.currentValue,
      thresholdValue: alertEvent.thresholdValue,
      tenantId: alertEvent.tenantId,
      timestamp: alertEvent.createdAt,
    });

    const result = await sendEmail({ to: recipients, subject, html });

    if (!result.sent) {
      logger.warn('Email no enviado', {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
        error: result.error,
      });
    }

    return result.sent;
  }

  /**
   * Enviar notificación por Slack
   * 
   * @param config - Configuración de la alerta
   * @param alertEvent - Evento de alerta
   * @returns true si se envió exitosamente
   */
  private async sendSlackNotification(
    config: AlertConfiguration,
    alertEvent: AlertEvent
  ): Promise<boolean> {
    const webhookUrl = config.notificationConfig?.slack?.webhookUrl;
    
    if (!webhookUrl) {
      logger.warn('Webhook URL de Slack no configurado', {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
      });
      return false;
    }

    try {
      const payload = {
        text: `🚨 *${alertEvent.severity}*: ${alertEvent.message}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Alerta: ${alertEvent.alertType}*\n${alertEvent.message}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Severidad:*\n${alertEvent.severity}`,
              },
              {
                type: 'mrkdwn',
                text: `*Valor Actual:*\n${alertEvent.currentValue}`,
              },
              {
                type: 'mrkdwn',
                text: `*Umbral:*\n${alertEvent.thresholdValue}`,
              },
              {
                type: 'mrkdwn',
                text: `*Fecha:*\n${alertEvent.createdAt.toISOString()}`,
              },
            ],
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      return response.ok;
    } catch (error) {
      logger.error('Error al enviar notificación por Slack', error as Error, {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
      });
      return false;
    }
  }

  /**
   * Enviar notificación por webhook
   * 
   * @param config - Configuración de la alerta
   * @param alertEvent - Evento de alerta
   * @returns true si se envió exitosamente
   */
  private async sendWebhookNotification(
    config: AlertConfiguration,
    alertEvent: AlertEvent
  ): Promise<boolean> {
    const webhookConfig = config.notificationConfig?.webhook;
    
    if (!webhookConfig?.url) {
      logger.warn('URL de webhook no configurada', {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
      });
      return false;
    }

    try {
      const response = await fetch(webhookConfig.url, {
        method: webhookConfig.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookConfig.headers,
        },
        body: JSON.stringify({
          alertId: alertEvent.id,
          tenantId: alertEvent.tenantId,
          alertType: alertEvent.alertType,
          severity: alertEvent.severity,
          message: alertEvent.message,
          currentValue: alertEvent.currentValue,
          thresholdValue: alertEvent.thresholdValue,
          metadata: alertEvent.metadata,
          createdAt: alertEvent.createdAt.toISOString(),
        }),
      });

      return response.ok;
    } catch (error) {
      logger.error('Error al enviar notificación por webhook', error as Error, {
        tenantId: alertEvent.tenantId,
        alertId: alertEvent.id,
      });
      return false;
    }
  }

  /**
   * Reconocer una alerta
   * 
   * @param alertId - ID de la alerta
   * @param tenantId - ID del tenant
   * @param acknowledgedBy - ID del usuario que reconoce
   */
  async acknowledgeAlert(
    alertId: string,
    tenantId: string,
    acknowledgedBy: string
  ): Promise<AlertEvent> {
    const event = await prisma.alert_events.update({
      where: {
        id: alertId,
        tenant_id: tenantId,
      },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledged_at: new Date(),
        acknowledged_by: acknowledgedBy,
        updated_at: new Date(),
      },
    });

    metrics.increment('alert.acknowledged', {
      tenantId,
      alertType: event.alert_type,
    });

    logger.info('Alerta reconocida', {
      tenantId,
      alertId,
      acknowledgedBy,
    });

    return this.mapToAlertEvent(event);
  }

  /**
   * Resolver una alerta
   * 
   * @param alertId - ID de la alerta
   * @param tenantId - ID del tenant
   * @param resolvedBy - ID del usuario que resuelve
   */
  async resolveAlert(
    alertId: string,
    tenantId: string,
    resolvedBy: string
  ): Promise<AlertEvent> {
    const event = await prisma.alert_events.update({
      where: {
        id: alertId,
        tenant_id: tenantId,
      },
      data: {
        status: 'RESOLVED',
        resolved_at: new Date(),
        resolved_by: resolvedBy,
        updated_at: new Date(),
      },
    });

    metrics.increment('alert.resolved', {
      tenantId,
      alertType: event.alert_type,
    });

    logger.info('Alerta resuelta', {
      tenantId,
      alertId,
      resolvedBy,
    });

    return this.mapToAlertEvent(event);
  }

  /**
   * Escalar alertas no reconocidas
   * 
   * Busca alertas activas que no han sido reconocidas en el tiempo de escalación
   * y las marca como escaladas, enviando notificaciones adicionales.
   * 
   * @param tenantId - ID del tenant (opcional, si no se proporciona escala para todos)
   */
  async escalateUnacknowledgedAlerts(tenantId?: string): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.ESCALATION_TIMEOUT_MS);

    const unacknowledgedAlerts = await prisma.alert_events.findMany({
      where: {
        ...(tenantId && { tenant_id: tenantId }),
        status: 'ACTIVE',
        escalated: false,
        created_at: {
          lte: cutoffTime,
        },
      },
      include: {
        configuration: true,
      },
    });

    let escalatedCount = 0;

    for (const alert of unacknowledgedAlerts) {
      try {
        // Marcar como escalada
        await prisma.alert_events.update({
          where: { id: alert.id },
          data: {
            escalated: true,
            escalated_at: new Date(),
            updated_at: new Date(),
          },
        });

        // Enviar notificaciones de escalación
        const config = this.mapToAlertConfiguration(alert.configuration);
        const alertEvent = this.mapToAlertEvent(alert);
        
        // Modificar mensaje para indicar escalación
        alertEvent.message = `[ESCALADA] ${alertEvent.message}`;
        
        await this.sendNotifications(config, alertEvent);

        escalatedCount++;

        metrics.increment('alert.escalated', {
          tenantId: alert.tenant_id,
          alertType: alert.alert_type,
        });

        logger.warn('Alerta escalada por falta de reconocimiento', {
          tenantId: alert.tenant_id,
          alertId: alert.id,
          alertType: alert.alert_type,
        });
      } catch (error) {
        logger.error('Error al escalar alerta', error as Error, {
          tenantId: alert.tenant_id,
          alertId: alert.id,
        });
      }
    }

    return escalatedCount;
  }

  /**
   * Crear una ventana de mantenimiento
   * 
   * @param input - Datos de la ventana de mantenimiento
   * @returns Ventana de mantenimiento creada
   */
  async createMaintenanceWindow(input: {
    tenantId: string;
    name: string;
    description?: string;
    startTime: Date;
    endTime: Date;
    alertTypes: AlertType[];
    createdBy?: string;
  }): Promise<MaintenanceWindow> {
    const window = await prisma.maintenance_windows.create({
      data: {
        tenant_id: input.tenantId,
        name: input.name,
        description: input.description,
        start_time: input.startTime,
        end_time: input.endTime,
        alert_types: input.alertTypes,
        created_by: input.createdBy,
      },
    });

    logger.info('Ventana de mantenimiento creada', {
      tenantId: input.tenantId,
      windowId: window.id,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    return this.mapToMaintenanceWindow(window);
  }

  /**
   * Obtener alertas activas de un tenant
   * 
   * @param tenantId - ID del tenant
   * @param alertType - Tipo de alerta (opcional)
   * @returns Lista de alertas activas
   */
  async getActiveAlerts(
    tenantId: string,
    alertType?: AlertType
  ): Promise<AlertEvent[]> {
    const alerts = await prisma.alert_events.findMany({
      where: {
        tenant_id: tenantId,
        status: 'ACTIVE',
        ...(alertType && { alert_type: alertType }),
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return alerts.map(alert => this.mapToAlertEvent(alert));
  }

  /**
   * Obtener eventos de alertas con filtros
   * 
   * @param tenantId - ID del tenant
   * @param filters - Filtros opcionales
   * @returns Lista de eventos de alertas
   */
  async getAlertEvents(
    tenantId: string,
    filters?: {
      status?: AlertStatus;
      alertType?: AlertType;
      limit?: number;
    }
  ): Promise<AlertEvent[]> {
    const alerts = await prisma.alert_events.findMany({
      where: {
        tenant_id: tenantId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.alertType && { alert_type: filters.alertType }),
      },
      orderBy: {
        created_at: 'desc',
      },
      take: filters?.limit || 50,
    });

    return alerts.map(alert => this.mapToAlertEvent(alert));
  }

  /**
   * Mapear modelo de Prisma a interfaz de dominio (AlertEvent)
   */
  private mapToAlertEvent(event: any): AlertEvent {
    return {
      id: event.id,
      tenantId: event.tenant_id,
      configurationId: event.configuration_id,
      alertType: event.alert_type as AlertType,
      severity: event.severity as AlertSeverity,
      currentValue: Number(event.current_value),
      thresholdValue: Number(event.threshold_value),
      message: event.message,
      metadata: event.metadata,
      status: event.status as AlertStatus,
      acknowledgedAt: event.acknowledged_at,
      acknowledgedBy: event.acknowledged_by,
      resolvedAt: event.resolved_at,
      resolvedBy: event.resolved_by,
      snoozedUntil: event.snoozed_until,
      escalated: event.escalated,
      escalatedAt: event.escalated_at,
      notificationsSent: event.notifications_sent as NotificationRecord[],
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    };
  }

  /**
   * Mapear modelo de Prisma a interfaz de dominio (AlertConfiguration)
   */
  private mapToAlertConfiguration(config: any): AlertConfiguration {
    return {
      id: config.id,
      tenantId: config.tenant_id,
      alertType: config.alert_type,
      thresholdValue: Number(config.threshold_value),
      thresholdUnit: config.threshold_unit,
      comparisonOperator: config.comparison_operator,
      enabled: config.enabled,
      notificationChannels: config.notification_channels,
      notificationConfig: config.notification_config,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
      createdBy: config.created_by,
      updatedBy: config.updated_by,
    };
  }

  /**
   * Mapear modelo de Prisma a interfaz de dominio (MaintenanceWindow)
   */
  private mapToMaintenanceWindow(window: any): MaintenanceWindow {
    return {
      id: window.id,
      tenantId: window.tenant_id,
      name: window.name,
      description: window.description,
      startTime: window.start_time,
      endTime: window.end_time,
      alertTypes: window.alert_types,
      createdAt: window.created_at,
      createdBy: window.created_by,
    };
  }
}

// Singleton instance
export const alertNotifier = new AlertNotifier();
