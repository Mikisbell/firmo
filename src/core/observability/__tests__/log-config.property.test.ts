/**
 * Property Tests: Log Configuration Service
 * 
 * Tests basados en propiedades para validar comportamiento universal
 * del servicio de configuración de niveles de log.
 * 
 * @module core/observability/__tests__/log-config.property.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { LogConfigService, LogLevel, LogModule } from '../log-config';
import prisma from '@/src/core/db/prisma';

// Mock de Prisma
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    logConfiguration: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    logConfigurationChange: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('LogConfigService - Property Tests', () => {
  let service: LogConfigService;

  beforeEach(() => {
    // Resetear mocks
    vi.clearAllMocks();
    
    // Crear nueva instancia para cada test
    // @ts-ignore - Acceder a constructor privado para testing
    service = new LogConfigService();
  });

  /**
   * Property: Log Level Configuration
   * 
   * Valida que los cambios de configuración se aplican correctamente.
   * 
   * Dado:
   * - Cualquier módulo válido (auth, sync, events, orders, global)
   * - Cualquier nivel válido (DEBUG, INFO, WARN, ERROR, FATAL)
   * 
   * Cuando:
   * - Se actualiza la configuración con setLevel()
   * 
   * Entonces:
   * - El nivel se aplica correctamente en memoria
   * - getLevel() retorna el nuevo nivel
   * - La configuración persiste entre llamadas
   * 
   * Validates: Requirements 12.3
   */
  it('Property: Log Level Configuration - cambios se aplican correctamente', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary para módulos válidos
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
        // Arbitrary para niveles válidos
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        async (module, level) => {
          // Aplicar configuración
          await service.setLevel(module, level);

          // Verificar que se aplicó correctamente
          const actualLevel = service.getLevel(module);
          expect(actualLevel).toBe(level);

          // Verificar que persiste entre llamadas
          const actualLevel2 = service.getLevel(module);
          expect(actualLevel2).toBe(level);
        }
      ),
      { numRuns: 100 } // 100 casos de prueba
    );
  });

  /**
   * Property: Configuration Idempotency
   * 
   * Valida que aplicar la misma configuración múltiples veces
   * produce el mismo resultado.
   * 
   * Dado:
   * - Cualquier módulo válido
   * - Cualquier nivel válido
   * 
   * Cuando:
   * - Se aplica la misma configuración N veces
   * 
   * Entonces:
   * - El resultado es siempre el mismo
   * - No hay efectos secundarios
   * 
   * Validates: Requirements 12.3
   */
  it('Property: Configuration Idempotency - aplicar misma config N veces produce mismo resultado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        fc.integer({ min: 1, max: 5 }), // Número de aplicaciones
        async (module, level, numApplications) => {
          // Aplicar configuración N veces
          for (let i = 0; i < numApplications; i++) {
            await service.setLevel(module, level);
          }

          // Verificar que el resultado es el esperado
          const actualLevel = service.getLevel(module);
          expect(actualLevel).toBe(level);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Configuration Precedence
   * 
   * Valida que la configuración específica de módulo
   * tiene precedencia sobre la configuración global.
   * 
   * Dado:
   * - Un módulo específico (no 'global')
   * - Un nivel para el módulo
   * - Un nivel diferente para global
   * 
   * Cuando:
   * - Se configuran ambos niveles
   * 
   * Entonces:
   * - getLevel(module) retorna el nivel específico del módulo
   * - getLevel(otroModulo) retorna el nivel global (si no tiene config específica)
   * 
   * Validates: Requirements 12.4
   */
  it('Property: Configuration Precedence - nivel específico tiene precedencia sobre global', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders'),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL').filter(level => level !== 'INFO'), // Evitar nivel default
        async (module, moduleLevel, globalLevel) => {
          // Resetear configuración para test limpio
          service.resetToDefaults();

          // Configurar nivel global PRIMERO
          await service.setLevel('global', globalLevel);

          // Configurar nivel específico del módulo
          await service.setLevel(module, moduleLevel);

          // Verificar precedencia: módulo específico tiene su nivel
          const actualModuleLevel = service.getLevel(module);
          expect(actualModuleLevel).toBe(moduleLevel);

          // Verificar que otros módulos sin configuración específica usan el nivel global
          const otherModules: LogModule[] = ['auth', 'sync', 'events', 'orders'];
          const otherModule = otherModules.find(m => m !== module);
          if (otherModule) {
            // Este módulo NO tiene configuración específica, debe usar global
            const otherLevel = service.getLevel(otherModule);
            expect(otherLevel).toBe(globalLevel);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Configuration Persistence
   * 
   * Valida que la configuración persiste en base de datos.
   * 
   * Dado:
   * - Cualquier módulo válido
   * - Cualquier nivel válido
   * 
   * Cuando:
   * - Se actualiza la configuración
   * 
   * Entonces:
   * - Se llama a prisma.log_configuration.upsert()
   * - Se llama a prisma.log_configurationChange.create()
   * 
   * Validates: Requirements 12.5, 12.7
   */
  it('Property: Configuration Persistence - cambios persisten en base de datos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        async (module, level) => {
          // Aplicar configuración
          await service.setLevel(module, level);

          // Verificar que se persistió en DB
          expect(prisma.log_configuration.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { module },
              update: expect.objectContaining({ level }),
              create: expect.objectContaining({ module, level }),
            })
          );

          // Verificar que se registró en audit trail
          expect(prisma.log_configurationChange.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                module,
                newLevel: level,
              }),
            })
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid Module Rejection
   * 
   * Valida que módulos inválidos son rechazados.
   * 
   * Dado:
   * - Cualquier string que NO sea un módulo válido
   * - Cualquier nivel válido
   * 
   * Cuando:
   * - Se intenta actualizar la configuración
   * 
   * Entonces:
   * - Se lanza un error
   * - La configuración NO se aplica
   * 
   * Validates: Requirements 12.6
   */
  it('Property: Invalid Module Rejection - módulos inválidos son rechazados', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary para strings que NO son módulos válidos
        fc.string().filter(s => !['auth', 'sync', 'events', 'orders', 'global'].includes(s)),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        async (invalidModule, level) => {
          // Intentar aplicar configuración con módulo inválido
          await expect(
            service.setLevel(invalidModule as LogModule, level)
          ).rejects.toThrow('Módulo inválido');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Invalid Level Rejection
   * 
   * Valida que niveles inválidos son rechazados.
   * 
   * Dado:
   * - Cualquier módulo válido
   * - Cualquier string que NO sea un nivel válido
   * 
   * Cuando:
   * - Se intenta actualizar la configuración
   * 
   * Entonces:
   * - Se lanza un error
   * - La configuración revierte a default (INFO)
   * 
   * Validates: Requirements 12.6, 12.8
   */
  it('Property: Invalid Level Rejection - niveles inválidos son rechazados y revierten a default', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
        // Arbitrary para strings que NO son niveles válidos
        fc.string().filter(s => !['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'].includes(s)),
        async (module, invalidLevel) => {
          // Intentar aplicar configuración con nivel inválido
          await expect(
            service.setLevel(module, invalidLevel as LogLevel)
          ).rejects.toThrow('Nivel de log inválido');

          // Verificar que revirtió a default
          const actualLevel = service.getLevel(module);
          expect(actualLevel).toBe('INFO'); // Default level
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Graceful Degradation on DB Failure
   * 
   * Valida que el servicio continúa funcionando si falla la base de datos.
   * 
   * Dado:
   * - Cualquier módulo válido
   * - Cualquier nivel válido
   * - Base de datos que falla
   * 
   * Cuando:
   * - Se actualiza la configuración
   * 
   * Entonces:
   * - NO se lanza error
   * - La configuración en memoria SÍ se actualiza
   * - getLevel() retorna el nuevo nivel
   * 
   * Validates: Requirements 12.8
   */
  it('Property: Graceful Degradation - servicio continúa funcionando si falla DB', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
        fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
        async (module, level) => {
          // Simular fallo de base de datos
          vi.mocked(prisma.log_configuration.upsert).mockRejectedValueOnce(
            new Error('DB connection failed')
          );

          // Aplicar configuración (NO debe lanzar error)
          await expect(
            service.setLevel(module, level)
          ).resolves.not.toThrow();

          // Verificar que la configuración en memoria SÍ se actualizó
          const actualLevel = service.getLevel(module);
          expect(actualLevel).toBe(level);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Configuration Consistency
   * 
   * Valida que getAllConfig() retorna configuración consistente con getLevel().
   * 
   * Dado:
   * - Múltiples configuraciones aplicadas
   * 
   * Cuando:
   * - Se obtiene toda la configuración con getAllConfig()
   * 
   * Entonces:
   * - Cada configuración en el array coincide con getLevel(module)
   * 
   * Validates: Requirements 12.3
   */
  it('Property: Configuration Consistency - getAllConfig() consistente con getLevel()', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Array de configuraciones (módulo, nivel)
        fc.array(
          fc.record({
            module: fc.constantFrom<LogModule>('auth', 'sync', 'events', 'orders', 'global'),
            level: fc.constantFrom<LogLevel>('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (configs) => {
          // Aplicar todas las configuraciones
          for (const config of configs) {
            await service.setLevel(config.module, config.level);
          }

          // Obtener toda la configuración
          const allConfig = service.getAllConfig();

          // Verificar consistencia
          for (const config of allConfig) {
            const levelFromGet = service.getLevel(config.module);
            expect(config.level).toBe(levelFromGet);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
