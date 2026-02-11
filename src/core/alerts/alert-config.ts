/**
 * Servicio de Configuración de Alertas
 * 
 * Gestiona la configuración de umbrales y canales de notificación para alertas del sistema.
 * Soporta múltiples tipos de alertas:
 * - ERROR_RATE: Tasa de errores del sistema
 * - RESPONSE_TIME: Tiempo de respuesta de APIs
 * - UPTIME: Disponibilidad del sistema
 * - CACHE_HIT_RATE: Tasa de aciertos de caché
 * - DB_POOL: Agotamiento del pool de conexiones de base de datos
 * 
 * @module core/alerts/alert-config
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { metrics } from '@/src/core/observability/metrics';

/**
 * Tipos de alertas soportados por el sistema
 */
export type AlertType = 
  | 'ERROR_RATE'
  | 'RESPONSE_TIME'
  | 'UPTIME'
  | 'CACHE_HIT_RATE'
  | 'DB_POOL';

/**
 * Unidades de medida para umbrales
 */
export type ThresholdUnit = 
  | 'PERCENTAGE'
  | 'MILLISECONDS'
  | 'COUNT';

/**
 * Operadores de comparación para umbrales
 */
export type ComparisonOperator = 
  | 'GT'  // Mayor que (>)
  | 'LT'  // Menor que (<)
  | 'GTE' // Mayor o igual que (>=)
  | 'LTE' // Menor o igual que (<=)
  | 'EQ'; // Igual a (=)

/**
 * Canales de notificación disponibles
 */
export type NotificationChannel = 
  | 'email'
  | 'slack'
  | 'webhook';

/**
 * Configuración de una alerta
 */
export interface AlertConfiguration {
  id: string;
  tenantId: string;
  alertType: AlertType;
  thresholdValue: number;
  thresholdUnit: ThresholdUnit;
  comparisonOperator: ComparisonOperator;
  enabled: boolean;
  notificationChannels: NotificationChannel[];
  notificationConfig?: {
    email?: {
      recipients: string[];
      subject?: string;
    };
    slack?: {
      webhookUrl: string;
      channel?: string;
    };
    webhook?: {
      url: string;
      method?: 'POST' | 'PUT';
      headers?: Record<string, string>;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Datos para crear una configuración de alerta
 */
export interface CreateAlertConfigInput {
  tenantId: string;
  alertType: AlertType;
  thresholdValue: number;
  thresholdUnit: ThresholdUnit;
  comparisonOperator: ComparisonOperator;
  enabled?: boolean;
  notificationChannels: NotificationChannel[];
  notificationConfig?: AlertConfiguration['notificationConfig'];
  createdBy?: string;
}

/**
 * Datos para actualizar una configuración de alerta
 */
export interface UpdateAlertConfigInput {
  thresholdValue?: number;
  thresholdUnit?: ThresholdUnit;
  comparisonOperator?: ComparisonOperator;
  enabled?: boolean;
  notificationChannels?: NotificationChannel[];
  notificationConfig?: AlertConfiguration['notificationConfig'];
  updatedBy?: string;
}

/**
 * Servicio de Configuración de Alertas
 * 
 * Proporciona métodos para gestionar configuraciones de alertas del sistema.
 */
export class AlertConfigService {
  /**
   * Crear una nueva configuración de alerta
   * 
   * @param input - Datos de la configuración de alerta
   * @returns Configuración de alerta creada
   */
  async createAlertConfig(input: CreateAlertConfigInput): Promise<AlertConfiguration> {
    try {
      logger.info('Creando configuración de alerta', {
        tenantId: input.tenantId,
        alertType: input.alertType,
      });

      // Validar que no exista una configuración duplicada
      const existing = await prisma.alert_configurations.findFirst({
        where: {
          tenant_id: input.tenantId,
          alert_type: input.alertType,
        },
      });

      if (existing) {
        throw new Error(`Ya existe una configuración de alerta para ${input.alertType}`);
      }

      const config = await prisma.alert_configurations.create({
        data: {
          tenant_id: input.tenantId,
          alert_type: input.alertType,
          threshold_value: input.thresholdValue,
          threshold_unit: input.thresholdUnit,
          comparison_operator: input.comparisonOperator,
          enabled: input.enabled ?? true,
          notification_channels: input.notificationChannels,
          notification_config: input.notificationConfig ?? {},
          created_by: input.createdBy,
        },
      });

      metrics.increment('alert_config.created', {
        tenantId: input.tenantId,
        alertType: input.alertType,
      });

      logger.info('Configuración de alerta creada exitosamente', {
        tenantId: input.tenantId,
        alertType: input.alertType,
        configId: config.id,
      });

      return this.mapToAlertConfiguration(config);
    } catch (error) {
      logger.error('Error al crear configuración de alerta', error as Error, {
        tenantId: input.tenantId,
        alertType: input.alertType,
      });
      throw error;
    }
  }

  /**
   * Obtener una configuración de alerta por ID
   * 
   * @param id - ID de la configuración
   * @param tenantId - ID del tenant
   * @returns Configuración de alerta o null si no existe
   */
  async getAlertConfig(id: string, tenantId: string): Promise<AlertConfiguration | null> {
    const config = await prisma.alert_configurations.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    return config ? this.mapToAlertConfiguration(config) : null;
  }

  /**
   * Obtener todas las configuraciones de alerta de un tenant
   * 
   * @param tenantId - ID del tenant
   * @param enabledOnly - Si es true, solo retorna configuraciones habilitadas
   * @returns Lista de configuraciones de alerta
   */
  async getAlertConfigs(
    tenantId: string,
    enabledOnly: boolean = false
  ): Promise<AlertConfiguration[]> {
    const configs = await prisma.alert_configurations.findMany({
      where: {
        tenant_id: tenantId,
        ...(enabledOnly ? { enabled: true } : {}),
      },
      orderBy: {
        alert_type: 'asc',
      },
    });

    return configs.map(config => this.mapToAlertConfiguration(config));
  }

  /**
   * Alias para getAlertConfigs (compatibilidad con API)
   */
  async getAllAlertConfigs(tenantId: string): Promise<AlertConfiguration[]> {
    return this.getAlertConfigs(tenantId, false);
  }

  /**
   * Obtener configuración de alerta por tipo
   * 
   * @param tenantId - ID del tenant
   * @param alertType - Tipo de alerta
   * @returns Configuración de alerta o null si no existe
   */
  async getAlertConfigByType(
    tenantId: string,
    alertType: AlertType
  ): Promise<AlertConfiguration | null> {
    const config = await prisma.alert_configurations.findFirst({
      where: {
        tenant_id: tenantId,
        alert_type: alertType,
      },
    });

    return config ? this.mapToAlertConfiguration(config) : null;
  }

  /**
   * Actualizar una configuración de alerta
   * 
   * @param id - ID de la configuración
   * @param tenantId - ID del tenant
   * @param input - Datos a actualizar
   * @returns Configuración de alerta actualizada
   */
  async updateAlertConfig(
    id: string,
    tenantId: string,
    input: UpdateAlertConfigInput
  ): Promise<AlertConfiguration> {
    try {
      logger.info('Actualizando configuración de alerta', {
        tenantId,
        configId: id,
      });

      const config = await prisma.alert_configurations.update({
        where: {
          id,
          tenant_id: tenantId,
        },
        data: {
          ...(input.thresholdValue !== undefined && { threshold_value: input.thresholdValue }),
          ...(input.thresholdUnit && { threshold_unit: input.thresholdUnit }),
          ...(input.comparisonOperator && { comparison_operator: input.comparisonOperator }),
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.notificationChannels && { notification_channels: input.notificationChannels }),
          ...(input.notificationConfig && { notification_config: input.notificationConfig }),
          updated_at: new Date(),
          updated_by: input.updatedBy,
        },
      });

      metrics.increment('alert_config.updated', {
        tenantId,
        alertType: config.alert_type,
      });

      logger.info('Configuración de alerta actualizada exitosamente', {
        tenantId,
        configId: id,
      });

      return this.mapToAlertConfiguration(config);
    } catch (error) {
      logger.error('Error al actualizar configuración de alerta', error as Error, {
        tenantId,
        configId: id,
      });
      throw error;
    }
  }

  /**
   * Eliminar una configuración de alerta
   * 
   * @param id - ID de la configuración
   * @param tenantId - ID del tenant
   */
  async deleteAlertConfig(id: string, tenantId: string): Promise<void> {
    try {
      logger.info('Eliminando configuración de alerta', {
        tenantId,
        configId: id,
      });

      await prisma.alert_configurations.delete({
        where: {
          id,
          tenant_id: tenantId,
        },
      });

      metrics.increment('alert_config.deleted', {
        tenantId,
      });

      logger.info('Configuración de alerta eliminada exitosamente', {
        tenantId,
        configId: id,
      });
    } catch (error) {
      logger.error('Error al eliminar configuración de alerta', error as Error, {
        tenantId,
        configId: id,
      });
      throw error;
    }
  }

  /**
   * Verificar si un valor excede el umbral configurado
   * 
   * @param config - Configuración de alerta
   * @param currentValue - Valor actual a verificar
   * @returns true si el valor excede el umbral
   */
  shouldTriggerAlert(config: AlertConfiguration, currentValue: number): boolean {
    const threshold = Number(config.thresholdValue);
    
    switch (config.comparisonOperator) {
      case 'GT':
        return currentValue > threshold;
      case 'LT':
        return currentValue < threshold;
      case 'GTE':
        return currentValue >= threshold;
      case 'LTE':
        return currentValue <= threshold;
      case 'EQ':
        return currentValue === threshold;
      default:
        return false;
    }
  }

  /**
   * Mapear modelo de Prisma a interfaz de dominio
   */
  private mapToAlertConfiguration(config: any): AlertConfiguration {
    return {
      id: config.id,
      tenantId: config.tenant_id,
      alertType: config.alert_type as AlertType,
      thresholdValue: Number(config.threshold_value),
      thresholdUnit: config.threshold_unit as ThresholdUnit,
      comparisonOperator: config.comparison_operator as ComparisonOperator,
      enabled: config.enabled,
      notificationChannels: config.notification_channels as NotificationChannel[],
      notificationConfig: config.notification_config,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
      createdBy: config.created_by,
      updatedBy: config.updated_by,
    };
  }
}

// Singleton instance
export const alertConfigService = new AlertConfigService();
