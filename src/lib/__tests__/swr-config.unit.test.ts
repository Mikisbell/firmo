/**
 * Tests unitarios para configuración de SWR
 * 
 * Valida que las configuraciones de SWR están correctamente definidas
 * y cumplen con los requisitos de performance.
 * 
 * @module lib/__tests__/swr-config.unit.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  swrGlobalConfig,
  swrHighFrequencyConfig,
  swrLowFrequencyConfig,
  fetcher,
  authenticatedFetcher,
} from '../swr-config';

describe('SWR Config - Unit Tests', () => {
  // Limpiar mocks antes de cada test
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('swrGlobalConfig', () => {
    it('debe tener configuración de deduplicación correcta', () => {
      expect(swrGlobalConfig.dedupingInterval).toBe(2000);
    });

    it('debe tener revalidación en focus deshabilitada', () => {
      expect(swrGlobalConfig.revalidateOnFocus).toBe(false);
    });

    it('debe tener revalidación en reconnect habilitada', () => {
      expect(swrGlobalConfig.revalidateOnReconnect).toBe(true);
    });

    it('debe tener revalidateIfStale deshabilitado', () => {
      expect(swrGlobalConfig.revalidateIfStale).toBe(false);
    });

    it('debe tener provider de caché configurado', () => {
      expect(swrGlobalConfig.provider).toBeDefined();
      expect(typeof swrGlobalConfig.provider).toBe('function');
      
      // Verificar que el provider retorna un Map
      const cache = swrGlobalConfig.provider!(new Map());
      expect(cache).toBeInstanceOf(Map);
    });

    it('debe tener configuración de error retry correcta', () => {
      expect(swrGlobalConfig.errorRetryCount).toBe(3);
      expect(swrGlobalConfig.errorRetryInterval).toBe(5000);
    });

    it('debe tener suspense deshabilitado', () => {
      expect(swrGlobalConfig.suspense).toBe(false);
    });

    it('debe mantener datos previos durante revalidación', () => {
      expect(swrGlobalConfig.keepPreviousData).toBe(true);
    });
  });

  describe('swrHighFrequencyConfig', () => {
    it('debe heredar configuración global', () => {
      expect(swrHighFrequencyConfig.revalidateOnReconnect).toBe(true);
      expect(swrHighFrequencyConfig.errorRetryCount).toBe(3);
    });

    it('debe tener deduplicación más agresiva (1s)', () => {
      expect(swrHighFrequencyConfig.dedupingInterval).toBe(1000);
    });

    it('debe tener auto-refresh cada 5 segundos', () => {
      expect(swrHighFrequencyConfig.refreshInterval).toBe(5000);
    });

    it('debe tener revalidación en focus habilitada', () => {
      expect(swrHighFrequencyConfig.revalidateOnFocus).toBe(true);
    });
  });

  describe('swrLowFrequencyConfig', () => {
    it('debe heredar configuración global', () => {
      expect(swrLowFrequencyConfig.revalidateOnReconnect).toBe(true);
      expect(swrLowFrequencyConfig.errorRetryCount).toBe(3);
    });

    it('debe tener deduplicación más relajada (5s)', () => {
      expect(swrLowFrequencyConfig.dedupingInterval).toBe(5000);
    });

    it('debe tener revalidateIfStale habilitado', () => {
      expect(swrLowFrequencyConfig.revalidateIfStale).toBe(true);
    });

    it('debe tener auto-refresh deshabilitado', () => {
      expect(swrLowFrequencyConfig.refreshInterval).toBe(0);
    });
  });

  describe('fetcher', () => {
    it('debe ser una función', () => {
      expect(typeof fetcher).toBe('function');
    });

    it('debe retornar datos parseados en respuesta exitosa', async () => {
      // Mock de fetch exitoso
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      const result = await fetcher('/api/test');
      
      expect(result).toEqual({ data: 'test' });
      expect(global.fetch).toHaveBeenCalledWith('/api/test');
    });

    it('debe lanzar error en respuesta no exitosa', async () => {
      // Mock de fetch con error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(fetcher('/api/test')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('debe agregar información adicional al error', async () => {
      // Mock de fetch con error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      try {
        await fetcher('/api/test');
        expect.fail('Debería haber lanzado un error');
      } catch (error: any) {
        expect(error.status).toBe(500);
        expect(error.url).toBe('/api/test');
      }
    });
  });

  describe('authenticatedFetcher', () => {
    it('debe ser una función', () => {
      expect(typeof authenticatedFetcher).toBe('function');
    });

    it('debe incluir token en header Authorization', async () => {
      // Mock de fetch exitoso
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'secure' }),
      });

      const token = 'test-token-123';
      const result = await authenticatedFetcher('/api/secure', token);
      
      expect(result).toEqual({ data: 'secure' });
      expect(global.fetch).toHaveBeenCalledWith('/api/secure', {
        headers: {
          'Authorization': 'Bearer test-token-123',
        },
      });
    });

    it('debe lanzar error en respuesta no exitosa', async () => {
      // Mock de fetch con error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        authenticatedFetcher('/api/secure', 'invalid-token')
      ).rejects.toThrow('HTTP 401: Unauthorized');
    });

    it('debe agregar información adicional al error', async () => {
      // Mock de fetch con error
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      try {
        await authenticatedFetcher('/api/secure', 'token');
        expect.fail('Debería haber lanzado un error');
      } catch (error: any) {
        expect(error.status).toBe(403);
        expect(error.url).toBe('/api/secure');
      }
    });
  });

  describe('Validación de tipos TypeScript', () => {
    it('todas las configs deben ser válidas según SWRConfiguration', () => {
      // Este test pasa si TypeScript compila sin errores
      // Verifica que las configuraciones cumplen con el tipo SWRConfiguration
      expect(swrGlobalConfig).toBeDefined();
      expect(swrHighFrequencyConfig).toBeDefined();
      expect(swrLowFrequencyConfig).toBeDefined();
    });
  });
});
