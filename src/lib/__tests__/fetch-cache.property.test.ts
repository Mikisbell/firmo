/**
 * Property-Based Tests para RequestCache
 * 
 * Valida propiedades universales del caché:
 * - Deduplicación dentro de TTL
 * - Expiración después de TTL
 * - Invalidación limpia caché
 * - Requests concurrentes retornan mismo promise
 * - Tamaño de caché no excede límites razonables
 * 
 * @module lib/__tests__/fetch-cache.property.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { RequestCache, cachedFetch, invalidateCachedFetch } from '../fetch-cache';

describe('RequestCache Property-Based Tests', () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 2.1: Deduplication within TTL
   * 
   * ∀ (key, ttl, n) where n > 0:
   *   Múltiples requests con la misma key dentro del TTL
   *   deben deduplicarse (fetcher se llama solo 1 vez)
   */
  it('Property 2.1: Deduplication within TTL', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 100, max: 5000 }), // ttl
        fc.integer({ min: 2, max: 20 }), // número de requests
        async (key, ttl, numRequests) => {
          const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

          // Hacer múltiples requests concurrentes
          const promises = Array(numRequests)
            .fill(null)
            .map(() => cache.get(key, fetcher, ttl));

          await Promise.all(promises);

          // Fetcher solo debe llamarse 1 vez (deduplicación)
          expect(fetcher).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.2: TTL Expiration
   * 
   * ∀ (key, ttl, ε) where ε > 0:
   *   Request después de (ttl + ε) debe ejecutar fetcher de nuevo
   */
  it('Property 2.2: TTL Expiration', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 100, max: 2000 }), // ttl
        fc.integer({ min: 1, max: 100 }), // epsilon (tiempo extra)
        async (key, ttl, epsilon) => {
          const fetcher = vi.fn()
            .mockResolvedValueOnce({ data: 'first' })
            .mockResolvedValueOnce({ data: 'second' });

          // Primera llamada
          await cache.get(key, fetcher, ttl);

          // Avanzar tiempo más allá del TTL
          vi.advanceTimersByTime(ttl + epsilon);

          // Segunda llamada (después del TTL)
          await cache.get(key, fetcher, ttl);

          // Fetcher debe llamarse 2 veces (caché expiró)
          expect(fetcher).toHaveBeenCalledTimes(2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.3: Invalidation clears cache
   * 
   * ∀ (key):
   *   cache.invalidate(key) ⟹ próximo get() ejecuta fetcher
   */
  it('Property 2.3: Invalidation clears cache', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 100, max: 5000 }), // ttl
        async (key, ttl) => {
          const fetcher = vi.fn()
            .mockResolvedValueOnce({ data: 'first' })
            .mockResolvedValueOnce({ data: 'second' });

          // Primera llamada
          await cache.get(key, fetcher, ttl);
          expect(fetcher).toHaveBeenCalledTimes(1);

          // Invalidar caché
          cache.invalidate(key);

          // Segunda llamada (después de invalidar)
          await cache.get(key, fetcher, ttl);

          // Fetcher debe llamarse 2 veces
          expect(fetcher).toHaveBeenCalledTimes(2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.4: Concurrent requests return same promise
   * 
   * ∀ (key, ttl, n) where n > 0:
   *   Múltiples requests concurrentes deben retornar el mismo promise
   */
  it('Property 2.4: Concurrent requests return same promise', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 100, max: 5000 }), // ttl
        fc.integer({ min: 2, max: 10 }), // número de requests
        async (key, ttl, numRequests) => {
          const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

          // Hacer múltiples requests concurrentes
          const promises = Array(numRequests)
            .fill(null)
            .map(() => cache.get(key, fetcher, ttl));

          // Todos los promises deben ser el mismo objeto
          const firstPromise = promises[0];
          promises.forEach(promise => {
            expect(promise).toBe(firstPromise);
          });

          await Promise.all(promises);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.5: Cache size never exceeds reasonable limit
   * 
   * ∀ (keys):
   *   cache.size() === número de keys únicas cacheadas
   */
  it('Property 2.5: Cache size reflects unique keys', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }), // keys
        fc.integer({ min: 100, max: 5000 }), // ttl
        async (keys, ttl) => {
          const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

          // Cachear todas las keys
          for (const key of keys) {
            await cache.get(key, fetcher, ttl);
          }

          // Tamaño del caché debe ser igual al número de keys únicas
          const uniqueKeys = new Set(keys);
          expect(cache.size()).toBe(uniqueKeys.size);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.6: Clear removes all entries
   * 
   * ∀ (keys):
   *   cache.clear() ⟹ cache.size() === 0
   */
  it('Property 2.6: Clear removes all entries', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }), // keys
        fc.integer({ min: 100, max: 5000 }), // ttl
        async (keys, ttl) => {
          const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

          // Cachear todas las keys
          for (const key of keys) {
            await cache.get(key, fetcher, ttl);
          }

          // Verificar que hay entradas
          expect(cache.size()).toBeGreaterThan(0);

          // Limpiar caché
          cache.clear();

          // Tamaño debe ser 0
          expect(cache.size()).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('cachedFetch Property-Based Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 2.7: cachedFetch deduplicates by URL + options
   * 
   * ∀ (url, options):
   *   Múltiples cachedFetch con mismo url + options deben deduplicarse
   */
  it('Property 2.7: cachedFetch deduplicates by URL + options', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // url
        fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'), // method
        fc.integer({ min: 2, max: 10 }), // número de requests
        async (url, method, numRequests) => {
          const mockData = { data: 'test' };
          let fetchCallCount = 0;

          global.fetch = vi.fn().mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({
              ok: true,
              json: async () => mockData,
            } as Response);
          });

          // Hacer múltiples requests concurrentes
          const promises = Array(numRequests)
            .fill(null)
            .map(() => cachedFetch(url, { method }));

          await Promise.all(promises);

          // Fetch solo debe llamarse 1 vez (deduplicación)
          expect(fetchCallCount).toBe(1);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2.8: Different URLs are cached independently
   * 
   * ∀ (url1, url2) where url1 ≠ url2:
   *   cachedFetch(url1) y cachedFetch(url2) deben hacer 2 requests
   */
  it('Property 2.8: Different URLs are cached independently', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // url1
        fc.webUrl(), // url2
        async (url1, url2) => {
          // Skip si las URLs son iguales
          fc.pre(url1 !== url2);

          let fetchCallCount = 0;

          global.fetch = vi.fn().mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: 'test' }),
            } as Response);
          });

          await cachedFetch(url1);
          await cachedFetch(url2);

          // Fetch debe llamarse 2 veces (URLs diferentes)
          expect(fetchCallCount).toBe(2);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2.9: HTTP errors are thrown
   * 
   * ∀ (url, statusCode) where statusCode >= 400:
   *   cachedFetch debe lanzar error si response.ok === false
   */
  it('Property 2.9: HTTP errors are thrown', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // url
        fc.integer({ min: 400, max: 599 }), // status code
        async (url, statusCode) => {
          global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: statusCode,
            statusText: 'Error',
          } as Response);

          // Debe lanzar error
          await expect(cachedFetch(url)).rejects.toThrow(`HTTP ${statusCode}: Error`);
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property 2.10: invalidateCachedFetch forces refetch
   * 
   * ∀ (url):
   *   invalidateCachedFetch(url) ⟹ próximo cachedFetch(url) hace nuevo request
   */
  it('Property 2.10: invalidateCachedFetch forces refetch', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // url
        async (url) => {
          let fetchCallCount = 0;

          global.fetch = vi.fn().mockImplementation(() => {
            fetchCallCount++;
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: `call-${fetchCallCount}` }),
            } as Response);
          });

          // Primera llamada
          await cachedFetch(url);
          expect(fetchCallCount).toBe(1);

          // Invalidar caché
          invalidateCachedFetch(url);

          // Segunda llamada (después de invalidar)
          await cachedFetch(url);

          // Fetch debe llamarse 2 veces
          expect(fetchCallCount).toBe(2);
        }
      ),
      { numRuns: 30 }
    );
  });
});

describe('Edge Cases Property-Based Tests', () => {
  let cache: RequestCache;

  beforeEach(() => {
    cache = new RequestCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Property 2.11: Empty keys are handled correctly
   * 
   * Verificar que keys vacías o muy cortas funcionan correctamente
   */
  it('Property 2.11: Empty and short keys work correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 3 }), // keys muy cortas (incluyendo vacías)
        fc.integer({ min: 100, max: 5000 }), // ttl
        async (key, ttl) => {
          const fetcher = vi.fn().mockResolvedValue({ data: 'test' });

          // Primera llamada
          await cache.get(key, fetcher, ttl);

          // Segunda llamada (debe usar caché)
          await cache.get(key, fetcher, ttl);

          // Fetcher solo debe llamarse 1 vez
          expect(fetcher).toHaveBeenCalledTimes(1);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.12: Very short TTLs work correctly
   * 
   * Verificar que TTLs muy cortos (< 100ms) funcionan correctamente
   */
  it('Property 2.12: Very short TTLs work correctly', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 1, max: 50 }), // ttl muy corto
        async (key, ttl) => {
          const fetcher = vi.fn()
            .mockResolvedValueOnce({ data: 'first' })
            .mockResolvedValueOnce({ data: 'second' });

          // Primera llamada
          await cache.get(key, fetcher, ttl);

          // Avanzar tiempo más allá del TTL
          vi.advanceTimersByTime(ttl + 1);

          // Segunda llamada (después del TTL)
          await cache.get(key, fetcher, ttl);

          // Fetcher debe llamarse 2 veces (caché expiró)
          expect(fetcher).toHaveBeenCalledTimes(2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.13: Fetcher errors don't corrupt cache
   * 
   * ∀ (key):
   *   Si fetcher lanza error, próximo get() debe reintentar
   */
  it('Property 2.13: Fetcher errors do not corrupt cache', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // key
        fc.integer({ min: 100, max: 5000 }), // ttl
        async (key, ttl) => {
          const fetcher = vi.fn()
            .mockRejectedValueOnce(new Error('Network error'))
            .mockResolvedValueOnce({ data: 'success' });

          // Primera llamada (falla)
          await expect(cache.get(key, fetcher, ttl)).rejects.toThrow('Network error');

          // Segunda llamada (debe reintentar, no usar caché corrupto)
          const result = await cache.get(key, fetcher, ttl);

          // Fetcher debe llamarse 2 veces
          expect(fetcher).toHaveBeenCalledTimes(2);
          expect(result).toEqual({ data: 'success' });
        }
      ),
      { numRuns: 50 }
    );
  });
});
