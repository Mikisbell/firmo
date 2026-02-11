/**
 * Servicio de Configuración de Niveles de Log
 * 
 * Proporciona configuración dinámica de niveles de log por módulo,
 * soportando configuración vía variables de entorno y API runtime.
 * 
 * Features:
 * - Configuración por módulo (auth, sync, events, orders)
 * - Configuración runtime vía API
 * - Persistencia en base de datos
 * - Validación de valores
 * - Audit trail de cambios
 * - Fallback a nivel default (info)
 * 
 * @module core/observability/log-config
 */

import prisma from '@/src/core/db/prisma';

/**
 * Niveles de log soportados
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

/**
 * Módulos del sistema con configuración de log independiente
 */
export type LogModule = 'auth' | 'sync' | 'events' | 'orders' | 'global';

/**
 * Configuración de nivel de log para un módulo
 */
export interface LogLevelConfig {
  module: LogModule;
  level: LogLevel;
  updatedAt: Date;
  updatedBy?: string;
}

/**
 * Cambio de configuración de log (audit trail)
 */
export interface LogConfigChange {
  id: string;
  module: LogModule;
  previousLevel: LogLevel;
  newLevel: LogLevel;
  changedBy: string;
  changedAt: Date;
  reason?: string;
}

/**
 * Servicio de Configuración de Niveles de Log
 * 
 * Gestiona la configuración dinámica de niveles de log por módulo,
 * con soporte para configuración runtime y persistencia.
 */
export class LogConfigService {
  private static instance: LogConfigService;
  private config: Map<LogModule, LogLevel> = new Map();
  private readonly DEFAULT_LEVEL: LogLevel = 'INFO';
  private readonly VALID_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
  private readonly VALID_MODULES: LogModule[] = ['auth', 'sync', 'events', 'orders', 'global'];

  private constructor() {
    // Inicializar con configuración de variables de entorno
    this.loadFromEnvironment();
  }

  /**
   * Obtener instancia singleton del servicio
   */
  public static getInstance(): LogConfigService {
    if (!LogConfigService.instance) {
      LogConfigService.instance = new LogConfigService();
    }
    return LogConfigService.instance;
  }

  /**
   * Cargar configuración desde variables de entorno
   * 
   * Soporta:
   * - LOG_LEVEL: nivel global
   * - LOG_LEVEL_AUTH: nivel para módulo auth
   * - LOG_LEVEL_SYNC: nivel para módulo sync
   * - LOG_LEVEL_EVENTS: nivel para módulo events
   * - LOG_LEVEL_ORDERS: nivel para módulo orders
   */
  private loadFromEnvironment(): void {
    // Nivel global
    const globalLevel = process.env.LOG_LEVEL;
    if (globalLevel && this.isValidLevel(globalLevel)) {
      this.config.set('global', globalLevel as LogLevel);
    } else {
      this.config.set('global', this.DEFAULT_LEVEL);
    }

    // Niveles por módulo
    const moduleEnvVars: Record<LogModule, string> = {
      auth: 'LOG_LEVEL_AUTH',
      sync: 'LOG_LEVEL_SYNC',
      events: 'LOG_LEVEL_EVENTS',
      orders: 'LOG_LEVEL_ORDERS',
      global: 'LOG_LEVEL',
    };

    for (const [module, envVar] of Object.entries(moduleEnvVars)) {
      if (module === 'global') continue; // Ya procesado arriba
      
      const level = process.env[envVar];
      if (level && this.isValidLevel(level)) {
        this.config.set(module as LogModule, level as LogLevel);
      }
    }

    console.log('[LogConfig] Configuración cargada desde environment:', {
      config: Object.fromEntries(this.config),
    });
  }

  /**
   * Validar que un nivel de log es válido
   */
  private isValidLevel(level: string): boolean {
    return this.VALID_LEVELS.includes(level as LogLevel);
  }

  /**
   * Validar que un módulo es válido
   */
  private isValidModule(module: string): boolean {
    return this.VALID_MODULES.includes(module as LogModule);
  }

  /**
   * Obtener nivel de log para un módulo
   * 
   * Orden de precedencia:
   * 1. Configuración específica del módulo
   * 2. Configuración global
   * 3. Nivel default (INFO)
   */
  public getLevel(module: LogModule): LogLevel {
    // Intentar obtener configuración específica del módulo
    const moduleLevel = this.config.get(module);
    if (moduleLevel) {
      return moduleLevel;
    }

    // Fallback a configuración global
    const globalLevel = this.config.get('global');
    if (globalLevel) {
      return globalLevel;
    }

    // Fallback a nivel default
    return this.DEFAULT_LEVEL;
  }

  /**
   * Establecer nivel de log para un módulo
   * 
   * @param module - Módulo a configurar
   * @param level - Nivel de log
   * @param userId - ID del usuario que realiza el cambio (para audit trail)
   * @param reason - Razón del cambio (opcional)
   * @throws Error si el nivel o módulo son inválidos
   */
  public async setLevel(
    module: LogModule,
    level: LogLevel,
    userId?: string,
    reason?: string
  ): Promise<void> {
    // Validar módulo
    if (!this.isValidModule(module)) {
      const error = new Error(`Módulo inválido: ${module}. Módulos válidos: ${this.VALID_MODULES.join(', ')}`);
      console.error('[LogConfig] Error de validación:', error.message);
      throw error;
    }

    // Validar nivel
    if (!this.isValidLevel(level)) {
      const error = new Error(`Nivel de log inválido: ${level}. Niveles válidos: ${this.VALID_LEVELS.join(', ')}`);
      console.error('[LogConfig] Error de validación:', error.message);
      
      // Revertir a nivel default
      this.config.set(module, this.DEFAULT_LEVEL);
      console.warn(`[LogConfig] Revertido a nivel default (${this.DEFAULT_LEVEL}) para módulo ${module}`);
      
      throw error;
    }

    // Obtener nivel anterior para audit trail
    const previousLevel = this.getLevel(module);

    // Actualizar configuración en memoria
    this.config.set(module, level);

    // Persistir en base de datos
    try {
      await prisma.logConfiguration.upsert({
        where: { module },
        update: {
          level,
          updatedAt: new Date(),
          updatedBy: userId,
        },
        create: {
          module,
          level,
          updatedBy: userId,
        },
      });

      // Registrar cambio en audit trail
      await prisma.logConfigurationChange.create({
        data: {
          module,
          previousLevel,
          newLevel: level,
          changedBy: userId || 'system',
          changedAt: new Date(),
          reason,
        },
      });

      console.log('[LogConfig] Configuración actualizada:', {
        module,
        previousLevel,
        newLevel: level,
        userId,
        reason,
      });
    } catch (error) {
      console.error('[LogConfig] Error al persistir configuración:', error);
      // No lanzar error - la configuración en memoria ya está actualizada
      // El sistema puede continuar funcionando sin persistencia
    }
  }

  /**
   * Obtener toda la configuración actual
   */
  public getAllConfig(): LogLevelConfig[] {
    const configs: LogLevelConfig[] = [];
    
    for (const [module, level] of this.config.entries()) {
      configs.push({
        module,
        level,
        updatedAt: new Date(),
      });
    }

    return configs;
  }

  /**
   * Cargar configuración desde base de datos
   * 
   * Útil para sincronizar configuración al iniciar el servidor
   * o después de cambios realizados por otros procesos.
   */
  public async loadFromDatabase(): Promise<void> {
    try {
      const configs = await prisma.logConfiguration.findMany();
      
      for (const config of configs) {
        if (this.isValidModule(config.module) && this.isValidLevel(config.level)) {
          this.config.set(config.module as LogModule, config.level as LogLevel);
        }
      }

      console.log('[LogConfig] Configuración cargada desde base de datos:', {
        count: configs.length,
        config: Object.fromEntries(this.config),
      });
    } catch (error) {
      console.error('[LogConfig] Error al cargar configuración desde base de datos:', error);
      // No lanzar error - usar configuración de environment como fallback
    }
  }

  /**
   * Obtener historial de cambios de configuración (audit trail)
   * 
   * @param module - Módulo específico (opcional)
   * @param limit - Número máximo de registros a retornar
   */
  public async getChangeHistory(module?: LogModule, limit: number = 50): Promise<LogConfigChange[]> {
    try {
      const changes = await prisma.logConfigurationChange.findMany({
        where: module ? { module } : undefined,
        orderBy: { changedAt: 'desc' },
        take: limit,
      });

      return changes.map(change => ({
        id: change.id,
        module: change.module as LogModule,
        previousLevel: change.previousLevel as LogLevel,
        newLevel: change.newLevel as LogLevel,
        changedBy: change.changedBy,
        changedAt: change.changedAt,
        reason: change.reason || undefined,
      }));
    } catch (error) {
      console.error('[LogConfig] Error al obtener historial de cambios:', error);
      return [];
    }
  }

  /**
   * Resetear configuración a valores default
   * 
   * Útil para troubleshooting o después de configuraciones problemáticas.
   */
  public resetToDefaults(): void {
    this.config.clear();
    this.config.set('global', this.DEFAULT_LEVEL);
    
    console.log('[LogConfig] Configuración reseteada a valores default:', {
      defaultLevel: this.DEFAULT_LEVEL,
    });
  }
}

// Singleton instance
export const logConfig = LogConfigService.getInstance();
