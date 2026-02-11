/**
 * Tests Unitarios: Servicio de Recuperación de Errores
 * 
 * Valida el comportamiento del servicio de recuperación incluyendo:
 * - Reintentos automáticos con backoff exponencial
 * - Validación de prerequisitos
 * - Ejecución de acciones de recuperación
 * - Registro de auditoría
 * - Notificaciones
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RecoveryService,
  RecoverableErrorType,
  RecoveryActionType,
  RecoveryContext,
  RetryConfig,
} from '../recovery-service';
import prisma from '../../db/prisma';

// Mock de dependencias
vi.mock('../../observability/structured-logger');
vi.mock('../../observability/metrics');
vi.mock('../../observability/error-tracker');
vi.mock('../../db/prisma', () => ({
  __esModule: true,
  default: {
    recovery_action_log: {
      create: vi.fn(),
    },
    events: {
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

describe('RecoveryService', () => {
  let recoveryService: RecoveryService;

  beforeEach(() => {
    recoveryService = RecoveryService.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('withRetry', () => {
    it('debe ejecutar operación exitosa sin reintentos', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const errorType: RecoverableErrorType = 'DATABASE_CONNECTION';

      const result = await recoveryService.withRetry(operation, errorType);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('debe reintentar operación fallida hasta éxito', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fallo 1'))
        .mockRejectedValueOnce(new Error('Fallo 2'))
        .mockResolvedValue('success');

      const errorType: RecoverableErrorType = 'NETWORK_TIMEOUT';
      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        backoffMultiplier: 2,
      };

      const result = await recoveryService.withRetry(operation, errorType, config);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('debe lanzar error después de agotar reintentos', async () => {
      const error = new Error('Fallo permanente');
      const operation = vi.fn().mockRejectedValue(error);
      const errorType: RecoverableErrorType = 'REDIS_CONNECTION';

      const config: Partial<RetryConfig> = {
        maxAttempts: 2,
        initialDelayMs: 10,
      };

      await expect(
        recoveryService.withRetry(operation, errorType, config)
      ).rejects.toThrow('Fallo permanente');

      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('debe aplicar backoff exponencial entre reintentos', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fallo 1'))
        .mockRejectedValueOnce(new Error('Fallo 2'))
        .mockResolvedValue('success');

      const errorType: RecoverableErrorType = 'RATE_LIMIT';
      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      };

      const startTime = Date.now();
      await recoveryService.withRetry(operation, errorType, config);
      const duration = Date.now() - startTime;

      // Debe esperar al menos: 100ms (primer reintento) + 200ms (segundo reintento) = 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('debe respetar delay máximo en backoff exponencial', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fallo 1'))
        .mockRejectedValueOnce(new Error('Fallo 2'))
        .mockResolvedValue('success');

      const errorType: RecoverableErrorType = 'SYNC_FAILURE';
      const config: Partial<RetryConfig> = {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 500, // Máximo menor que el delay calculado
        backoffMultiplier: 10,
      };

      const startTime = Date.now();
      await recoveryService.withRetry(operation, errorType, config);
      const duration = Date.now() - startTime;

      // Debe esperar máximo: 500ms + 500ms = 1000ms (no 1000ms + 10000ms)
      expect(duration).toBeLessThan(1500);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('validatePrerequisites', () => {
    it('debe validar prerequisitos para CLEAR_CACHE', async () => {
      const context: RecoveryContext = {
        actionType: 'CLEAR_CACHE',
        reason: 'Cache corrupto',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('CLEAR_CACHE', context);

      expect(result.actionType).toBe('CLEAR_CACHE');
      expect(result.checks).toHaveLength(1);
      expect(result.checks[0].name).toBe('Redis disponible');
      expect(result.canProceed).toBe(true);
    });

    it('debe validar prerequisitos para RESET_SYNC', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);

      const context: RecoveryContext = {
        actionType: 'RESET_SYNC',
        reason: 'Sincronización bloqueada',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('RESET_SYNC', context);

      expect(result.actionType).toBe('RESET_SYNC');
      expect(result.checks.length).toBeGreaterThanOrEqual(2);
      expect(result.checks.some((c) => c.name === 'Base de datos disponible')).toBe(true);
      expect(result.checks.some((c) => c.name === 'No hay sincronización en progreso')).toBe(true);
    });

    it('debe validar prerequisitos para REBUILD_PROJECTIONS', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);
      (prisma.events.count as any).mockResolvedValue(100);

      const context: RecoveryContext = {
        actionType: 'REBUILD_PROJECTIONS',
        reason: 'Proyecciones desactualizadas',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('REBUILD_PROJECTIONS', context);

      expect(result.actionType).toBe('REBUILD_PROJECTIONS');
      expect(result.checks.length).toBeGreaterThanOrEqual(3);
      expect(result.checks.some((c) => c.name === 'Base de datos disponible')).toBe(true);
      expect(result.checks.some((c) => c.name === 'No hay rebuild en progreso')).toBe(true);
      expect(result.checks.some((c) => c.name === 'Eventos existen para reconstruir')).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('debe fallar validación si no hay eventos para reconstruir', async () => {
      (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);
      (prisma.events.count as any).mockResolvedValue(0);

      const context: RecoveryContext = {
        actionType: 'REBUILD_PROJECTIONS',
        reason: 'Proyecciones desactualizadas',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('REBUILD_PROJECTIONS', context);

      const eventsCheck = result.checks.find((c) => c.name === 'Eventos existen para reconstruir');
      expect(eventsCheck?.passed).toBe(false);
      expect(eventsCheck?.message).toBe('No hay eventos para reconstruir');
      expect(result.canProceed).toBe(false);
    });

    it('debe fallar validación si base de datos no está disponible', async () => {
      (prisma.$queryRaw as any).mockRejectedValue(new Error('Connection failed'));

      const context: RecoveryContext = {
        actionType: 'RESET_SYNC',
        reason: 'Sincronización bloqueada',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('RESET_SYNC', context);

      const dbCheck = result.checks.find((c) => c.name === 'Base de datos disponible');
      expect(dbCheck?.passed).toBe(false);
      expect(dbCheck?.message).toBe('No se pudo conectar a la base de datos');
      expect(result.canProceed).toBe(false);
    });

    it('debe validar permisos de administrador para RESTART_SERVICE', async () => {
      const context: RecoveryContext = {
        actionType: 'RESTART_SERVICE',
        reason: 'Servicio no responde',
        userId: 'admin-123',
      };

      const result = await recoveryService.validatePrerequisites('RESTART_SERVICE', context);

      expect(result.checks.some((c) => c.name === 'Permisos de administrador')).toBe(true);
    });

    it('debe fallar validación si no se proporciona userId para acciones admin', async () => {
      const context: RecoveryContext = {
        actionType: 'PURGE_QUEUE',
        reason: 'Cola bloqueada',
        tenantId: 'tenant-123',
      };

      const result = await recoveryService.validatePrerequisites('PURGE_QUEUE', context);

      const adminCheck = result.checks.find((c) => c.name === 'Permisos de administrador');
      expect(adminCheck?.passed).toBe(false);
      expect(adminCheck?.message).toBe('Usuario no especificado');
      expect(result.canProceed).toBe(false);
    });
  });

  describe('executeRecoveryAction', () => {
    beforeEach(() => {
      (prisma.$queryRaw as any).mockResolvedValue([{ result: 1 }]);
      (prisma.events.count as any).mockResolvedValue(100);
      (prisma.recovery_action_log.create as any).mockResolvedValue({
        id: 'log-123',
      });
    });

    it('debe ejecutar acción CLEAR_CACHE exitosamente', async () => {
      const context: RecoveryContext = {
        actionType: 'CLEAR_CACHE',
        reason: 'Cache corrupto',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('CLEAR_CACHE');
      expect(result.message).toBe('Caché limpiado exitosamente');
      expect(result.rollbackAvailable).toBe(false);
      expect(result.duration).toBeGreaterThan(0);
      expect(prisma.recovery_action_log.create).toHaveBeenCalled();
    });

    it('debe ejecutar acción RESET_SYNC exitosamente', async () => {
      const context: RecoveryContext = {
        actionType: 'RESET_SYNC',
        reason: 'Sincronización bloqueada',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('RESET_SYNC');
      expect(result.message).toBe('Estado de sincronización reseteado exitosamente');
      expect(result.rollbackAvailable).toBe(true);
    });

    it('debe ejecutar acción REBUILD_PROJECTIONS exitosamente', async () => {
      const context: RecoveryContext = {
        actionType: 'REBUILD_PROJECTIONS',
        reason: 'Proyecciones desactualizadas',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.success).toBe(true);
      expect(result.actionType).toBe('REBUILD_PROJECTIONS');
      expect(result.message).toBe('Proyecciones reconstruidas exitosamente');
      expect(result.rollbackAvailable).toBe(true);
    });

    it('debe rechazar acción si prerequisitos no se cumplen', async () => {
      (prisma.events.count as any).mockResolvedValue(0); // No hay eventos

      const context: RecoveryContext = {
        actionType: 'REBUILD_PROJECTIONS',
        reason: 'Proyecciones desactualizadas',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Prerequisitos no cumplidos');
      expect(result.details).toHaveProperty('failedChecks');
    });

    it('debe registrar acción en auditoría', async () => {
      const context: RecoveryContext = {
        actionType: 'CLEAR_CACHE',
        reason: 'Cache corrupto',
        tenantId: 'tenant-123',
        userId: 'admin-123',
        metadata: { cacheSize: 1024 },
      };

      await recoveryService.executeRecoveryAction(context);

      expect(prisma.recovery_action_log.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action_type: 'CLEAR_CACHE',
          tenant_id: 'tenant-123',
          user_id: 'admin-123',
          reason: 'Cache corrupto',
          success: true,
          metadata: { cacheSize: 1024 },
        }),
      });
    });

    it('debe manejar errores durante ejecución de acción', async () => {
      // Simular error en la base de datos
      (prisma.$queryRaw as any).mockRejectedValue(new Error('Database error'));

      const context: RecoveryContext = {
        actionType: 'RESET_SYNC',
        reason: 'Sincronización bloqueada',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Prerequisitos no cumplidos');
    });

    it('debe incluir duración de ejecución en resultado', async () => {
      const context: RecoveryContext = {
        actionType: 'CLEAR_CACHE',
        reason: 'Cache corrupto',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.duration).toBeGreaterThan(0);
      expect(typeof result.duration).toBe('number');
    });

    it('debe incluir timestamp ISO 8601 en resultado', async () => {
      const context: RecoveryContext = {
        actionType: 'CLEAR_CACHE',
        reason: 'Cache corrupto',
        tenantId: 'tenant-123',
        userId: 'admin-123',
      };

      const result = await recoveryService.executeRecoveryAction(context);

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('Singleton Pattern', () => {
    it('debe retornar la misma instancia en múltiples llamadas', () => {
      const instance1 = RecoveryService.getInstance();
      const instance2 = RecoveryService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
