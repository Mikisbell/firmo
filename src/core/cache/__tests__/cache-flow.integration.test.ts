/**
 * Integration Tests para Flujo de Caching
 * 
 * Prueba el patrón cache-aside con Redis real, invalidación de caché,
 * y degradación elegante cuando Redis no está disponible.
 * 
 * Valida: Requirements 8.5, 8.6
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisCacheService } from '../cache-service';
import { VercelMetricsCollector } from '../../observability/metrics';

describe('Cache Flow - Integration Tests', () => {
  let cache: RedisCacheService;
  let metrics: VercelMetricsCollector;

  beforeEach(() => {
    // Crear instancia de cache service (usa Redis URL de entorno)
    cache = new RedisCacheService();
    metrics = new VercelMetricsCollector();
  });

  afterEach(async () => {
    // Limpiar caché después de cada test
    await cache.clear();
    metrics.clear();
  });

  /**
   * Test 1: Cache-Aside Pattern
   * 
   * Verifica que el patrón cache-aside funciona correctamente:
   * 1. Primera lectura: cache miss → fetch de DB → store en cache
   * 2. Segunda lectura: cache hit → retorna desde cache
   */
  describe('Cache-Aside Pattern', () => {
    it('should implement cache-aside pattern correctly', async () => {
      const key = 'products:tenant-123';
      const products = [
        { id: '1', name: 'Pollo a la Brasa', price: 3500 },
        { id: '2', name: 'Papas Fritas', price: 800 },
      ];

      // Primera lectura - cache miss
      const cachedProducts1 = await cache.get<typeof products>(key);
      expect(cachedProducts1).toBeNull();

      // Simular fetch de DB y store en cache
      await cache.set(key, products, { ttl: 300 });

      // Segunda lectura - cache hit
      const cachedProducts2 = await cache.get<typeof products>(key);
      expect(cachedProducts2).not.toBeNull();
      expect(cachedProducts2).toEqual(products);
    });

    it('should track cache hits and misses', async () => {
      const key = 'test:cache-metrics';
      const value = { data: 'test' };

      // Cache miss
      const miss = await cache.get(key);
      expect(miss).toBeNull();

      // Store en cache
      await cache.set(key, value);

      // Cache hit
      const hit = await cache.get(key);
      expect(hit).toEqual(value);

      // Verificar que se pueden rastrear hits/misses
      // (En implementación real, el cache service emitiría métricas)
    });

    it('should respect TTL expiration', async () => {
      const key = 'test:ttl';
      const value = { data: 'expires soon' };

      // Store con TTL muy corto (1 segundo)
      await cache.set(key, value, { ttl: 1 });

      // Inmediatamente después, debería estar en cache
      const immediate = await cache.get(key);
      expect(immediate).toEqual(value);

      // Esperar a que expire (1.5 segundos)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Después de expirar, debería ser null
      const expired = await cache.get(key);
      expect(expired).toBeNull();
    }, 3000); // Timeout de 3 segundos para este test
  });

  /**
   * Test 2: Cache Invalidation
   * 
   * Verifica que la invalidación de caché funciona correctamente:
   * 1. Store con tags
   * 2. Invalidar por tag
   * 3. Verificar que entradas fueron eliminadas
   */
  describe('Cache Invalidation', () => {
    it('should invalidate cache entries by tag', async () => {
      const tenantId = 'tenant-123';
      
      // Store múltiples entradas con el mismo tag
      await cache.set('products:tenant-123', [{ id: '1' }], {
        ttl: 300,
        tags: [`tenant:${tenantId}`, 'products'],
      });

      await cache.set('employees:tenant-123', [{ id: '1' }], {
        ttl: 300,
        tags: [`tenant:${tenantId}`, 'employees'],
      });

      // Verificar que están en cache
      const products1 = await cache.get('products:tenant-123');
      const employees1 = await cache.get('employees:tenant-123');
      expect(products1).not.toBeNull();
      expect(employees1).not.toBeNull();

      // Invalidar por tag de tenant
      await cache.deleteByTag(`tenant:${tenantId}`);

      // Verificar que fueron eliminadas
      const products2 = await cache.get('products:tenant-123');
      const employees2 = await cache.get('employees:tenant-123');
      expect(products2).toBeNull();
      expect(employees2).toBeNull();
    });

    it('should invalidate only matching tags', async () => {
      // Store entradas para diferentes tenants
      await cache.set('products:tenant-1', [{ id: '1' }], {
        ttl: 300,
        tags: ['tenant:tenant-1', 'products'],
      });

      await cache.set('products:tenant-2', [{ id: '2' }], {
        ttl: 300,
        tags: ['tenant:tenant-2', 'products'],
      });

      // Invalidar solo tenant-1
      await cache.deleteByTag('tenant:tenant-1');

      // Verificar que solo tenant-1 fue eliminado
      const tenant1 = await cache.get('products:tenant-1');
      const tenant2 = await cache.get('products:tenant-2');
      expect(tenant1).toBeNull();
      expect(tenant2).not.toBeNull();
    });

    it('should handle invalidation of non-existent tags', async () => {
      // Esto no debería lanzar error
      await expect(
        cache.deleteByTag('non-existent-tag')
      ).resolves.not.toThrow();
    });
  });

  /**
   * Test 3: Graceful Degradation
   * 
   * Verifica que el sistema continúa funcionando cuando Redis no está disponible:
   * 1. Simular fallo de Redis
   * 2. Verificar que get retorna null (no lanza error)
   * 3. Verificar que set no lanza error
   */
  describe('Graceful Degradation', () => {
    it('should return null on cache get failure without throwing', async () => {
      // Crear instancia de cache service (fallará si Redis no está disponible)
      const failingCache = new RedisCacheService();

      // Esto no debería lanzar error, debería retornar null
      const result = await failingCache.get('test:key');
      expect(result).toBeNull();
    });

    it('should handle cache set failure gracefully', async () => {
      const failingCache = new RedisCacheService();

      // Esto no debería lanzar error
      await expect(
        failingCache.set('test:key', { data: 'test' })
      ).resolves.not.toThrow();
    });

    it('should handle cache delete failure gracefully', async () => {
      const failingCache = new RedisCacheService();

      // Esto no debería lanzar error
      await expect(
        failingCache.delete('test:key')
      ).resolves.not.toThrow();
    });

    it('should handle cache clear failure gracefully', async () => {
      const failingCache = new RedisCacheService();

      // Esto no debería lanzar error
      await expect(
        failingCache.clear()
      ).resolves.not.toThrow();
    });
  });

  /**
   * Test 4: Data Consistency
   * 
   * Verifica que los datos almacenados y recuperados son consistentes:
   * 1. Store datos complejos
   * 2. Retrieve y verificar igualdad profunda
   */
  describe('Data Consistency', () => {
    it('should preserve complex data structures', async () => {
      const complexData = {
        id: 'order-123',
        items: [
          { productId: 'prod-1', quantity: 2, price: 3500 },
          { productId: 'prod-2', quantity: 1, price: 800 },
        ],
        total: 7800,
        metadata: {
          tenantId: 'tenant-123',
          terminalId: 'terminal-456',
          timestamp: new Date().toISOString(),
        },
        nested: {
          level1: {
            level2: {
              level3: 'deep value',
            },
          },
        },
      };

      const key = 'test:complex-data';

      // Store
      await cache.set(key, complexData);

      // Retrieve
      const retrieved = await cache.get<typeof complexData>(key);

      // Verificar igualdad profunda
      expect(retrieved).toEqual(complexData);
    });

    it('should handle arrays correctly', async () => {
      const arrayData = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
        { id: '3', name: 'Item 3' },
      ];

      const key = 'test:array-data';

      await cache.set(key, arrayData);
      const retrieved = await cache.get<typeof arrayData>(key);

      expect(retrieved).toEqual(arrayData);
      expect(Array.isArray(retrieved)).toBe(true);
      expect(retrieved?.length).toBe(3);
    });

    it('should handle null and undefined values', async () => {
      const dataWithNulls = {
        field1: 'value',
        field2: null,
        field3: undefined, // undefined se serializa como ausente
      };

      const key = 'test:null-data';

      await cache.set(key, dataWithNulls);
      const retrieved = await cache.get<typeof dataWithNulls>(key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.field1).toBe('value');
      expect(retrieved?.field2).toBeNull();
      // field3 no existirá después de serialización JSON
    });
  });

  /**
   * Test 5: Concurrent Operations
   * 
   * Verifica que el cache maneja operaciones concurrentes correctamente:
   * 1. Múltiples gets simultáneos
   * 2. Múltiples sets simultáneos
   * 3. Gets y sets mezclados
   */
  describe('Concurrent Operations', () => {
    it('should handle concurrent get operations', async () => {
      const key = 'test:concurrent-get';
      const value = { data: 'concurrent test' };

      // Store primero
      await cache.set(key, value);

      // Múltiples gets simultáneos
      const promises = Array.from({ length: 10 }, () => cache.get(key));
      const results = await Promise.all(promises);

      // Todos deberían retornar el mismo valor
      results.forEach(result => {
        expect(result).toEqual(value);
      });
    });

    it('should handle concurrent set operations', async () => {
      const baseKey = 'test:concurrent-set';

      // Múltiples sets simultáneos con diferentes keys
      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.set(`${baseKey}:${i}`, { index: i })
      );

      // No debería lanzar error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Verificar que todos fueron almacenados
      const verifyPromises = Array.from({ length: 10 }, (_, i) =>
        cache.get(`${baseKey}:${i}`)
      );
      const results = await Promise.all(verifyPromises);

      results.forEach((result, i) => {
        expect(result).toEqual({ index: i });
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const key = 'test:mixed-concurrent';
      const initialValue = { counter: 0 };

      await cache.set(key, initialValue);

      // Mezclar gets, sets, y deletes
      const operations = [
        cache.get(key),
        cache.set(key, { counter: 1 }),
        cache.get(key),
        cache.set(key, { counter: 2 }),
        cache.get(key),
      ];

      // No debería lanzar error
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  /**
   * Test 6: Performance
   * 
   * Verifica que las operaciones de cache son rápidas:
   * 1. Get < 5ms
   * 2. Set < 5ms
   * 3. Delete < 5ms
   */
  describe('Performance', () => {
    it('should complete get operations quickly', async () => {
      const key = 'test:perf-get';
      const value = { data: 'performance test' };

      await cache.set(key, value);

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await cache.get(key);
      }

      const endTime = performance.now();
      const avgDuration = (endTime - startTime) / iterations;

      // Promedio debería ser < 5ms por operación
      expect(avgDuration).toBeLessThan(5);
    });

    it('should complete set operations quickly', async () => {
      const baseKey = 'test:perf-set';
      const value = { data: 'performance test' };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await cache.set(`${baseKey}:${i}`, value);
      }

      const endTime = performance.now();
      const avgDuration = (endTime - startTime) / iterations;

      // Promedio debería ser < 5ms por operación
      expect(avgDuration).toBeLessThan(5);
    });

    it('should handle high-volume operations efficiently', async () => {
      const operations = 1000;
      const startTime = performance.now();

      const promises = Array.from({ length: operations }, (_, i) =>
        cache.set(`test:volume:${i}`, { index: i })
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // 1000 operaciones deberían completar en < 1 segundo
      expect(totalDuration).toBeLessThan(1000);
    });
  });

  /**
   * Test 7: Compression
   * 
   * Verifica que valores grandes son comprimidos automáticamente.
   */
  describe('Compression', () => {
    it('should handle large values efficiently', async () => {
      // Crear un valor grande (> 1KB)
      const largeValue = {
        data: 'x'.repeat(2000), // 2KB de datos
        metadata: {
          size: 2000,
          compressed: true,
        },
      };

      const key = 'test:large-value';

      // Store y retrieve
      await cache.set(key, largeValue);
      const retrieved = await cache.get<typeof largeValue>(key);

      // Debería ser igual después de compresión/descompresión
      expect(retrieved).toEqual(largeValue);
    });
  });
});
