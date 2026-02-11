/**
 * Unit Tests: Log Configuration Service
 * 
 * Tests para el servicio de configuración de niveles de log
 * 
 * @module core/observability/__tests__/log-config.unit.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogConfigService, LogLevel, LogModule } from '../log-config';
import prisma from '@/src/core/db/prisma';

// Mock de Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    logConfiguration: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    logConfigurationChange: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('LogConfigService', () => {
  let service: LogConfigService;

  beforeEach(() => {
    // Resetear mocks
    vi.clearAllMocks();
    
    // Crear nueva instancia para cada test
    // @ts-ignore - Acceder a constructor privado para testing
    service = new LogConfigService();
  });

  describe('getLevel', () => {
    it('debe retornar nivel específico del módulo si existe', () => {
      // Configurar nivel específico para auth
      service['config'].set('auth', 'DEBUG');
      service['config'].set('global', 'INFO');

      const level = service.getLevel('auth');
      expect(level).toBe('DEBUG');
    });

    it('debe retornar nivel global si no existe configuración específica', () => {
      service['config'].set('global', 'WARN');

      const level = service.getLevel('sync');
      expect(level).toBe('WARN');
    });

    it('debe retornar nivel default (INFO) si no hay configuración', () => {
      service['config'].clear();

      const level = service.getLevel('events');
      expect(level).toBe('INFO');
    });
  });

  describe('setLevel', () => {
    it('debe actualizar nivel de log correctamente', async () => {
      await service.setLevel('auth', 'DEBUG', 'user-123', 'Debugging issue');

      const level = service.getLevel('auth');
      expect(level).toBe('DEBUG');
    });

    it('debe persistir configuración en base de datos', async () => {
      await service.setLevel('sync', 'ERROR', 'user-456');

      expect(prisma.logConfiguration.upsert).toHaveBeenCalledWith({
        where: { module: 'sync' },
        update: expect.objectContaining({
          level: 'ERROR',
          updatedBy: 'user-456',
        }),
        create: expect.objectContaining({
          module: 'sync',
          level: 'ERROR',
          updatedBy: 'user-456',
        }),
      });
    });

    it('debe registrar cambio en audit trail', async () => {
      service['config'].set('events', 'INFO');

      await service.setLevel('events', 'DEBUG', 'user-789', 'Testing');

      expect(prisma.logConfigurationChange.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          module: 'events',
          previousLevel: 'INFO',
          newLevel: 'DEBUG',
          changedBy: 'user-789',
          reason: 'Testing',
        }),
      });
    });

    it('debe lanzar error si módulo es inválido', async () => {
      await expect(
        service.setLevel('invalid' as LogModule, 'INFO')
      ).rejects.toThrow('Módulo inválido');
    });

    it('debe lanzar error si nivel es inválido', async () => {
      await expect(
        service.setLevel('auth', 'INVALID' as LogLevel)
      ).rejects.toThrow('Nivel de log inválido');
    });

    it('debe revertir a nivel default si nivel es inválido', async () => {
      try {
        await service.setLevel('auth', 'INVALID' as LogLevel);
      } catch (error) {
        // Esperado
      }

      const level = service.getLevel('auth');
      expect(level).toBe('INFO'); // Default level
    });

    it('debe continuar funcionando si falla persistencia en DB', async () => {
      // Simular error de base de datos
      vi.mocked(prisma.logConfiguration.upsert).mockRejectedValueOnce(
        new Error('DB error')
      );

      // No debe lanzar error
      await expect(
        service.setLevel('orders', 'WARN', 'user-123')
      ).resolves.not.toThrow();

      // Configuración en memoria debe estar actualizada
      const level = service.getLevel('orders');
      expect(level).toBe('WARN');
    });
  });

  describe('getAllConfig', () => {
    it('debe retornar toda la configuración actual', () => {
      service['config'].set('auth', 'DEBUG');
      service['config'].set('sync', 'ERROR');
      service['config'].set('global', 'INFO');

      const config = service.getAllConfig();

      expect(config).toHaveLength(3);
      expect(config).toContainEqual(
        expect.objectContaining({ module: 'auth', level: 'DEBUG' })
      );
      expect(config).toContainEqual(
        expect.objectContaining({ module: 'sync', level: 'ERROR' })
      );
      expect(config).toContainEqual(
        expect.objectContaining({ module: 'global', level: 'INFO' })
      );
    });

    it('debe retornar array vacío si no hay configuración', () => {
      service['config'].clear();

      const config = service.getAllConfig();
      expect(config).toHaveLength(0);
    });
  });

  describe('loadFromDatabase', () => {
    it('debe cargar configuración desde base de datos', async () => {
      // Mock de datos de DB
      vi.mocked(prisma.logConfiguration.findMany).mockResolvedValueOnce([
        { module: 'auth', level: 'DEBUG', updatedAt: new Date(), updatedBy: null },
        { module: 'sync', level: 'ERROR', updatedAt: new Date(), updatedBy: null },
      ]);

      await service.loadFromDatabase();

      expect(service.getLevel('auth')).toBe('DEBUG');
      expect(service.getLevel('sync')).toBe('ERROR');
    });

    it('debe ignorar configuraciones inválidas de DB', async () => {
      vi.mocked(prisma.logConfiguration.findMany).mockResolvedValueOnce([
        { module: 'auth', level: 'DEBUG', updatedAt: new Date(), updatedBy: null },
        { module: 'invalid', level: 'INFO', updatedAt: new Date(), updatedBy: null },
        { module: 'sync', level: 'INVALID', updatedAt: new Date(), updatedBy: null },
      ]);

      await service.loadFromDatabase();

      // Solo debe cargar configuración válida
      expect(service.getLevel('auth')).toBe('DEBUG');
      expect(service.getLevel('invalid' as LogModule)).toBe('INFO'); // Fallback a default
    });

    it('debe continuar funcionando si falla carga de DB', async () => {
      vi.mocked(prisma.logConfiguration.findMany).mockRejectedValueOnce(
        new Error('DB error')
      );

      // No debe lanzar error
      await expect(service.loadFromDatabase()).resolves.not.toThrow();
    });
  });

  describe('getChangeHistory', () => {
    it('debe retornar historial de cambios', async () => {
      const mockChanges = [
        {
          id: '1',
          module: 'auth',
          previousLevel: 'INFO',
          newLevel: 'DEBUG',
          changedBy: 'user-123',
          changedAt: new Date(),
          reason: 'Testing',
        },
        {
          id: '2',
          module: 'sync',
          previousLevel: 'WARN',
          newLevel: 'ERROR',
          changedBy: 'user-456',
          changedAt: new Date(),
          reason: null,
        },
      ];

      vi.mocked(prisma.logConfigurationChange.findMany).mockResolvedValueOnce(
        mockChanges
      );

      const history = await service.getChangeHistory();

      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        module: 'auth',
        previousLevel: 'INFO',
        newLevel: 'DEBUG',
      });
    });

    it('debe filtrar por módulo si se especifica', async () => {
      await service.getChangeHistory('auth', 10);

      expect(prisma.logConfigurationChange.findMany).toHaveBeenCalledWith({
        where: { module: 'auth' },
        orderBy: { changedAt: 'desc' },
        take: 10,
      });
    });

    it('debe retornar array vacío si falla consulta', async () => {
      vi.mocked(prisma.logConfigurationChange.findMany).mockRejectedValueOnce(
        new Error('DB error')
      );

      const history = await service.getChangeHistory();
      expect(history).toEqual([]);
    });
  });

  describe('resetToDefaults', () => {
    it('debe resetear configuración a valores default', () => {
      service['config'].set('auth', 'DEBUG');
      service['config'].set('sync', 'ERROR');

      service.resetToDefaults();

      expect(service.getLevel('auth')).toBe('INFO'); // Default
      expect(service.getLevel('sync')).toBe('INFO'); // Default
      expect(service.getLevel('global')).toBe('INFO'); // Default
    });
  });

  describe('loadFromEnvironment', () => {
    it('debe cargar nivel global desde LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'DEBUG';
      
      // @ts-ignore - Acceder a método privado para testing
      service.loadFromEnvironment();

      expect(service.getLevel('global')).toBe('DEBUG');
    });

    it('debe cargar niveles por módulo desde variables específicas', () => {
      process.env.LOG_LEVEL_AUTH = 'DEBUG';
      process.env.LOG_LEVEL_SYNC = 'ERROR';
      process.env.LOG_LEVEL_EVENTS = 'WARN';

      // @ts-ignore
      service.loadFromEnvironment();

      expect(service.getLevel('auth')).toBe('DEBUG');
      expect(service.getLevel('sync')).toBe('ERROR');
      expect(service.getLevel('events')).toBe('WARN');
    });

    it('debe usar nivel default si variable de entorno es inválida', () => {
      process.env.LOG_LEVEL = 'INVALID';

      // @ts-ignore
      service.loadFromEnvironment();

      expect(service.getLevel('global')).toBe('INFO'); // Default
    });
  });
});
