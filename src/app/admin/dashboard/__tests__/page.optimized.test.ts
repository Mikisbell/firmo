/**
 * Tests de Optimización para Dashboard Page
 * 
 * Verifica que las optimizaciones de caché funcionan correctamente:
 * - Strategy 2: cachedFetch deduplica requests
 * - Caché respeta TTL configurado
 * - Invalidación de caché funciona
 * - Performance mejoró vs baseline
 * 
 * @module admin/dashboard/__tests__/page.optimized.test
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requestCache, cachedFetch, invalidateCachedFetch } from '@/src/lib/fetch-cache';

// Mock fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock data
const mockRealtimeMetrics = {
  total_sales_cents: 150000,
  orders_count: 25,
  avg_ticket_cents: 6000,
  business_date: '2026-02-14',
  shift_id: 'shift-1',
  last_updated: new Date().toISOString(),
};

describe('Dashboard Page - Optimizaciones de Caché', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestCache.clear();
    vi.useFakeTimers();
    
    // Setup mock responses
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/admin/analytics/realtime')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRealtimeMetrics),
        } as Response);
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Test 5.2.1: Requests se deduplicarán', () => {
    it('debe deduplicar requests dentro del TTL de 2s', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Primera llamada
      await cachedFetch(url, { method: 'GET' }, ttl);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Segunda llamada inmediata (dentro del TTL)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Solo debe haber 1 llamada a fetch (deduplicación funcionó)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('debe hacer nuevos requests después del TTL de 2s', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Primera llamada
      await cachedFetch(url, { method: 'GET' }, ttl);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Avanzar tiempo más allá del TTL
      vi.advanceTimersByTime(2100);
      
      // Segunda llamada (después del TTL)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Debe haber 2 llamadas a fetch
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe compartir caché entre múltiples llamadas concurrentes', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Múltiples llamadas concurrentes
      const promises = Array(10).fill(null).map(() =>
        cachedFetch(url, { method: 'GET' }, ttl)
      );
      
      await Promise.all(promises);
      
      // Solo debe haber 1 llamada a fetch (deduplicación perfecta)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('debe usar TTL diferente para datos históricos (5s)', async () => {
      const url = '/api/admin/analytics/history?from=2026-02-13&to=2026-02-13';
      const ttl = 5000; // 5s para datos históricos
      
      // Mock para este endpoint específico
      mockFetch.mockImplementation((fetchUrl: string) => {
        if (fetchUrl.includes('/api/admin/analytics/history')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ business_date: '2026-02-13', total_sales_cents: 100000 }]),
          } as Response);
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });
      
      // Primera llamada
      await cachedFetch(url, { method: 'GET' }, ttl);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Avanzar 2s (dentro del TTL de 5s)
      vi.advanceTimersByTime(2000);
      
      // Segunda llamada (aún dentro del TTL)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Debe seguir siendo 1 llamada (caché activo)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Avanzar otros 3.1s (total 5.1s, fuera del TTL)
      vi.advanceTimersByTime(3100);
      
      // Tercera llamada (después del TTL)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Ahora debe haber 2 llamadas
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Test 5.2.2: Invalidación de caché', () => {
    it('debe invalidar caché manualmente', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Primera llamada
      await cachedFetch(url, { method: 'GET' }, ttl);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Invalidar caché
      invalidateCachedFetch(url, { method: 'GET' });
      
      // Segunda llamada (caché invalidado)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Debe haber 2 llamadas (caché fue invalidado)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe limpiar caché automáticamente después del TTL', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Primera llamada
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Verificar que el caché tiene 1 entrada
      expect(requestCache.size()).toBe(1);
      
      // Avanzar tiempo más allá del TTL
      vi.advanceTimersByTime(2100);
      
      // Esperar a que se limpie el caché
      await vi.runAllTimersAsync();
      
      // Verificar que el caché está vacío
      expect(requestCache.size()).toBe(0);
    });
  });

  describe('Test 5.2.3: Manejo de errores', () => {
    it('debe propagar errores de fetch', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        } as Response);
      });
      
      const url = '/api/admin/analytics/realtime';
      
      await expect(cachedFetch(url, { method: 'GET' }, 2000)).rejects.toThrow(
        'HTTP 500: Internal Server Error'
      );
    });

    it('no debe cachear errores', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRealtimeMetrics),
        } as Response);
      });
      
      const url = '/api/admin/analytics/realtime';
      
      // Primera llamada (error)
      await expect(cachedFetch(url, { method: 'GET' }, 2000)).rejects.toThrow();
      
      // Segunda llamada (éxito)
      const result = await cachedFetch(url, { method: 'GET' }, 2000);
      
      // Debe haber 2 llamadas (error no se cacheó)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockRealtimeMetrics);
    });
  });

  describe('Test 5.2.4: Performance mejoró vs baseline', () => {
    it('debe reducir requests en 100% con múltiples llamadas dentro del TTL', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Simular 10 refreshes rápidos (como usuario haciendo click)
      for (let i = 0; i < 10; i++) {
        await cachedFetch(url, { method: 'GET' }, ttl);
        vi.advanceTimersByTime(100); // 100ms entre cada refresh
      }
      
      // Solo debe haber 1 llamada a fetch (100% de reducción)
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('debe manejar múltiples endpoints independientemente', async () => {
      const urls = [
        '/api/admin/analytics/realtime',
        '/api/admin/analytics/comparison',
        '/api/admin/analytics/top-products',
        '/api/admin/analytics/hourly',
      ];
      
      mockFetch.mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: `mock-${url}` }),
        } as Response);
      });
      
      // Llamar a todos los endpoints
      await Promise.all(urls.map(url => cachedFetch(url, { method: 'GET' }, 2000)));
      
      // Debe haber 4 llamadas (1 por endpoint)
      expect(mockFetch).toHaveBeenCalledTimes(4);
      
      // Llamar de nuevo a todos los endpoints (dentro del TTL)
      await Promise.all(urls.map(url => cachedFetch(url, { method: 'GET' }, 2000)));
      
      // Debe seguir siendo 4 llamadas (caché funcionó)
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('debe tener overhead mínimo de caché (<1ms)', async () => {
      const url = '/api/admin/analytics/realtime';
      const ttl = 2000;
      
      // Primera llamada (poblar caché)
      await cachedFetch(url, { method: 'GET' }, ttl);
      
      // Medir tiempo de cache hit
      const start = performance.now();
      await cachedFetch(url, { method: 'GET' }, ttl);
      const end = performance.now();
      
      const cacheHitTime = end - start;
      
      // Cache hit debe ser muy rápido (<1ms)
      expect(cacheHitTime).toBeLessThan(1);
    });
  });

  describe('Test 5.2.5: Casos edge', () => {
    it('debe manejar URLs con query params diferentes', async () => {
      const baseUrl = '/api/admin/analytics/history';
      const url1 = `${baseUrl}?from=2026-02-13&to=2026-02-13`;
      const url2 = `${baseUrl}?from=2026-02-14&to=2026-02-14`;
      
      mockFetch.mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url }),
        } as Response);
      });
      
      // Llamar a ambas URLs
      await cachedFetch(url1, { method: 'GET' }, 2000);
      await cachedFetch(url2, { method: 'GET' }, 2000);
      
      // Debe haber 2 llamadas (URLs diferentes)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      // Llamar de nuevo a la primera URL
      await cachedFetch(url1, { method: 'GET' }, 2000);
      
      // Debe seguir siendo 2 llamadas (caché de url1 funcionó)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe manejar métodos HTTP diferentes', async () => {
      const url = '/api/admin/analytics/realtime';
      
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRealtimeMetrics),
        } as Response);
      });
      
      // GET request
      await cachedFetch(url, { method: 'GET' }, 2000);
      
      // POST request (diferente método)
      await cachedFetch(url, { method: 'POST' }, 2000);
      
      // Debe haber 2 llamadas (métodos diferentes)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('debe manejar caché vacío correctamente', () => {
      // Verificar que el caché empieza vacío
      expect(requestCache.size()).toBe(0);
      
      // Limpiar caché vacío no debe causar error
      expect(() => requestCache.clear()).not.toThrow();
      
      // Invalidar key inexistente no debe causar error
      expect(() => invalidateCachedFetch('/nonexistent')).not.toThrow();
    });
  });
});
