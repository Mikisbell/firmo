/**
 * Tests unitarios para RequestCache y helpers
 * 
 * Valida:
 * - Cache hit dentro de TTL
 * - Cache miss después de TTL
 * - Deduplicación de requests concurrentes
 * - Invalidación manual
 * - Clear de todo el caché
 * - Error handling
 * - Type safety
 * 
 * @module lib/__tests__/fetch-cache.unit.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RequestCache,
  requestCache,
  cachedFetch,
  invalidateCachedFetch,
} from '../fetch-cache';

describe('RequestCache', () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('get()', () => {
    it('should cache requests within TTL', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

      // Primera llamada: ejecuta fetcher
      const result1 = await cache.get('key1', fetcher, 5000);

      // Segunda llamada (dentro del TTL): retorna caché
      const result2 = await cache.get('key1', fetcher, 5000);

      // Fetcher solo se llamó 1 vez
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Ambos resultados son iguales
      expect(result1).toEqual(result2);
      expect(result1).toEqual({ data: 'test' });
    });

    it('should expire cache after TTL', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      // Primera llamada
      const result1 = await cache.get('key1', fetcher, 1000);
      expect(result1).toEqual({ data: 'first' });

      // Avanzar tiempo más allá del TTL
      vi.advanceTimersByTime(1001);

      // Segunda llamada (después del TTL): ejecuta fetcher de nuevo
      const result2 = await cache.get('key1', fetcher, 1000);
      expect(result2).toEqual({ data: 'second' });

      // Fetcher se llamó 2 veces
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should deduplicate concurrent requests', async () => {
      const fetcher = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 100))
      );

      // Múltiples requests concurrentes con la misma key
      const promises = [
        cache.get('key1', fetcher, 5000),
        cache.get('key1', fetcher, 5000),
        cache.get('key1', fetcher, 5000),
        cache.get('key1', fetcher, 5000),
        cache.get('key1', fetcher, 5000),
      ];

      // Avanzar tiempo para que el fetcher resuelva
      vi.advanceTimersByTime(100);

      const results = await Promise.all(promises);

      // Fetcher solo se llamó 1 vez (deduplicación)
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Todos los resultados son iguales
      results.forEach(result => {
        expect(result).toEqual({ data: 'test' });
      });
    });

    it('should handle different keys independently', async () => {
      const fetcher1 = vi.fn().mockResolvedValue({ data: 'key1' });
      const fetcher2 = vi.fn().mockResolvedValue({ data: 'key2' });

      const result1 = await cache.get('key1', fetcher1, 5000);
      const result2 = await cache.get('key2', fetcher2, 5000);

      // Ambos fetchers se llamaron
      expect(fetcher1).toHaveBeenCalledTimes(1);
      expect(fetcher2).toHaveBeenCalledTimes(1);

      // Resultados son diferentes
      expect(result1).toEqual({ data: 'key1' });
      expect(result2).toEqual({ data: 'key2' });
    });

    it('should use default TTL of 5000ms', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      // Primera llamada (sin especificar TTL)
      await cache.get('key1', fetcher);

      // Avanzar 4999ms (dentro del TTL default)
      vi.advanceTimersByTime(4999);
      await cache.get('key1', fetcher);

      // Solo 1 llamada (caché activo)
      expect(fetcher).toHaveBeenCalledTimes(1);

      // Avanzar 2ms más (total 5001ms, fuera del TTL)
      vi.advanceTimersByTime(2);
      await cache.get('key1', fetcher);

      // 2 llamadas (caché expiró)
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidate()', () => {
    it('should invalidate specific cache entry', async () => {
      const fetcher = vi.fn()
        .mockResolvedValueOnce({ data: 'first' })
        .mockResolvedValueOnce({ data: 'second' });

      // Primera llamada
      const result1 = await cache.get('key1', fetcher, 5000);
      expect(result1).toEqual({ data: 'first' });

      // Invalidar caché
      cache.invalidate('key1');

      // Segunda llamada (después de invalidar): ejecuta fetcher de nuevo
      const result2 = await cache.get('key1', fetcher, 5000);
      expect(result2).toEqual({ data: 'second' });

      // Fetcher se llamó 2 veces
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it('should not affect other cache entries', async () => {
      const fetcher1 = vi.fn().mockResolvedValue({ data: 'key1' });
      const fetcher2 = vi.fn().mockResolvedValue({ data: 'key2' });

      // Cachear ambas keys
      await cache.get('key1', fetcher1, 5000);
      await cache.get('key2', fetcher2, 5000);

      // Invalidar solo key1
      cache.invalidate('key1');

      // key2 sigue en caché
      await cache.get('key2', fetcher2, 5000);
      expect(fetcher2).toHaveBeenCalledTimes(1); // No se llamó de nuevo

      // key1 fue invalidada
      await cache.get('key1', fetcher1, 5000);
      expect(fetcher1).toHaveBeenCalledTimes(2); // Se llamó de nuevo
    });
  });

  describe('clear()', () => {
    it('should clear all cache entries', async () => {
      const fetcher1 = vi.fn().mockResolvedValue({ data: 'key1' });
      const fetcher2 = vi.fn().mockResolvedValue({ data: 'key2' });
      const fetcher3 = vi.fn().mockResolvedValue({ data: 'key3' });

      // Cachear múltiples keys
      await cache.get('key1', fetcher1, 5000);
      await cache.get('key2', fetcher2, 5000);
      await cache.get('key3', fetcher3, 5000);

      expect(cache.size()).toBe(3);

      // Limpiar todo el caché
      cache.clear();

      expect(cache.size()).toBe(0);

      // Todas las keys fueron limpiadas
      await cache.get('key1', fetcher1, 5000);
      await cache.get('key2', fetcher2, 5000);
      await cache.get('key3', fetcher3, 5000);

      expect(fetcher1).toHaveBeenCalledTimes(2);
      expect(fetcher2).toHaveBeenCalledTimes(2);
      expect(fetcher3).toHaveBeenCalledTimes(2);
    });
  });

  describe('size()', () => {
    it('should return correct cache size', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

      expect(cache.size()).toBe(0);

      await cache.get('key1', fetcher, 5000);
      expect(cache.size()).toBe(1);

      await cache.get('key2', fetcher, 5000);
      expect(cache.size()).toBe(2);

      await cache.get('key3', fetcher, 5000);
      expect(cache.size()).toBe(3);

      cache.invalidate('key2');
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
    });

    it('should not count expired entries', async () => {
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

      await cache.get('key1', fetcher, 1000);
      expect(cache.size()).toBe(1);

      // Avanzar tiempo más allá del TTL + cleanup
      vi.advanceTimersByTime(1001);

      // El cleanup automático debería haber eliminado la entrada
      expect(cache.size()).toBe(0);
    });
  });
});

describe('cachedFetch()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should fetch and cache data', async () => {
    const mockData = { users: ['Alice', 'Bob'] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    const result = await cachedFetch<typeof mockData>('/api/users');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockData);
  });

  it('should deduplicate concurrent requests', async () => {
    const mockData = { users: ['Alice', 'Bob'] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    // Múltiples requests concurrentes
    const promises = [
      cachedFetch('/api/users'),
      cachedFetch('/api/users'),
      cachedFetch('/api/users'),
    ];

    const results = await Promise.all(promises);

    // Fetch solo se llamó 1 vez
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Todos los resultados son iguales
    results.forEach(result => {
      expect(result).toEqual(mockData);
    });
  });

  it('should throw error on HTTP error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    await expect(cachedFetch('/api/users')).rejects.toThrow('HTTP 404: Not Found');
  });

  it('should handle different URLs independently', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'users' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'products' }),
      } as Response);

    const result1 = await cachedFetch('/api/users');
    const result2 = await cachedFetch('/api/products');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ data: 'users' });
    expect(result2).toEqual({ data: 'products' });
  });

  it('should handle different options independently', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'GET' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'POST' }),
      } as Response);

    const result1 = await cachedFetch('/api/users', { method: 'GET' });
    const result2 = await cachedFetch('/api/users', { method: 'POST' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ data: 'GET' });
    expect(result2).toEqual({ data: 'POST' });
  });

  it('should respect custom TTL', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'first' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'second' }),
      } as Response);

    // Primera llamada con TTL de 2s
    await cachedFetch('/api/users', {}, 2000);

    // Avanzar 1999ms (dentro del TTL)
    vi.advanceTimersByTime(1999);
    await cachedFetch('/api/users', {}, 2000);

    // Solo 1 llamada (caché activo)
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Avanzar 2ms más (total 2001ms, fuera del TTL)
    vi.advanceTimersByTime(2);
    await cachedFetch('/api/users', {}, 2000);

    // 2 llamadas (caché expiró)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateCachedFetch()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestCache.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should invalidate cached fetch', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'first' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'second' }),
      } as Response);

    // Primera llamada
    const result1 = await cachedFetch('/api/users');
    expect(result1).toEqual({ data: 'first' });

    // Invalidar caché
    invalidateCachedFetch('/api/users');

    // Segunda llamada (después de invalidar)
    const result2 = await cachedFetch('/api/users');
    expect(result2).toEqual({ data: 'second' });

    // Fetch se llamó 2 veces
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should match options when invalidating', async () => {
    global.fetch = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

    // Cachear con opciones específicas
    await cachedFetch('/api/users', { method: 'GET' });

    // Invalidar con las mismas opciones
    invalidateCachedFetch('/api/users', { method: 'GET' });

    // Debe hacer nuevo fetch
    await cachedFetch('/api/users', { method: 'GET' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should not invalidate different options', async () => {
    global.fetch = vi.fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      } as Response);

    // Cachear con GET
    await cachedFetch('/api/users', { method: 'GET' });

    // Invalidar con POST (diferente)
    invalidateCachedFetch('/api/users', { method: 'POST' });

    // GET sigue en caché
    await cachedFetch('/api/users', { method: 'GET' });

    // Solo 1 llamada (caché activo)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Type Safety', () => {
  it('should infer correct types', async () => {
    interface User {
      id: number;
      name: string;
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: 'Alice' }),
    } as Response);

    // TypeScript debe inferir el tipo correctamente
    const user = await cachedFetch<User>('/api/users/1');

    // Estas propiedades deben existir
    expect(user.id).toBe(1);
    expect(user.name).toBe('Alice');

    // user.email would be a type error here (property doesn't exist on User)
  });

  it('should work with arrays', async () => {
    interface Product {
      id: number;
      name: string;
      price: number;
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, name: 'Product 1', price: 100 },
        { id: 2, name: 'Product 2', price: 200 },
      ],
    } as Response);

    const products = await cachedFetch<Product[]>('/api/products');

    expect(Array.isArray(products)).toBe(true);
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe('Product 1');
  });
});
