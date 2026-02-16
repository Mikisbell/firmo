/**
 * Tests Unitarios para PerformanceMonitor
 * 
 * Valida:
 * - Registro de métricas
 * - Cálculo de cache hit rate
 * - Cálculo de percentiles (p95, p99)
 * - Reset de métricas
 * - Actualización de tamaño de caché
 * 
 * @module lib/__tests__/performance-monitor.unit.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../performance-monitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  describe('recordRequest', () => {
    it('debe incrementar totalRequests', () => {
      monitor.recordRequest('/api/users', false, 100);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(1);
    });

    it('debe incrementar cachedRequests cuando cached=true', () => {
      monitor.recordRequest('/api/users', true, 0);
      
      const metrics = monitor.getMetrics();
      expect(metrics.cachedRequests).toBe(1);
    });

    it('no debe incrementar cachedRequests cuando cached=false', () => {
      monitor.recordRequest('/api/users', false, 100);
      
      const metrics = monitor.getMetrics();
      expect(metrics.cachedRequests).toBe(0);
    });

    it('debe calcular cache hit rate correctamente', () => {
      // 2 cache hits, 3 cache misses = 40% hit rate
      monitor.recordRequest('/api/users', true, 0);
      monitor.recordRequest('/api/users', true, 0);
      monitor.recordRequest('/api/products', false, 100);
      monitor.recordRequest('/api/orders', false, 150);
      monitor.recordRequest('/api/stats', false, 200);
      
      const metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(5);
      expect(metrics.cachedRequests).toBe(2);
      expect(metrics.cacheHitRate).toBeCloseTo(0.4, 2);
    });

    it('debe calcular avgResponseTime correctamente', () => {
      monitor.recordRequest('/api/users', false, 100);
      monitor.recordRequest('/api/products', false, 200);
      monitor.recordRequest('/api/orders', false, 300);
      
      const metrics = monitor.getMetrics();
      // Promedio: (100 + 200 + 300) / 3 = 200
      expect(metrics.avgResponseTime).toBe(200);
    });

    it('debe calcular p95ResponseTime correctamente', () => {
      // Agregar 100 requests con tiempos de 1-100ms
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest(`/api/test${i}`, false, i);
      }
      
      const metrics = monitor.getMetrics();
      // P95 de 1-100 debería ser ~95
      expect(metrics.p95ResponseTime).toBeGreaterThanOrEqual(90);
      expect(metrics.p95ResponseTime).toBeLessThanOrEqual(100);
    });

    it('debe calcular p99ResponseTime correctamente', () => {
      // Agregar 100 requests con tiempos de 1-100ms
      for (let i = 1; i <= 100; i++) {
        monitor.recordRequest(`/api/test${i}`, false, i);
      }
      
      const metrics = monitor.getMetrics();
      // P99 de 1-100 debería ser ~99
      expect(metrics.p99ResponseTime).toBeGreaterThanOrEqual(95);
      expect(metrics.p99ResponseTime).toBeLessThanOrEqual(100);
    });

    it('debe mantener solo maxTimings entradas', () => {
      const smallMonitor = new PerformanceMonitor(10); // Solo 10 timings
      
      // Agregar 20 requests
      for (let i = 0; i < 20; i++) {
        smallMonitor.recordRequest(`/api/test${i}`, false, 100);
      }
      
      const timings = smallMonitor.getTimings();
      expect(timings.length).toBe(10); // Solo los últimos 10
    });
  });

  describe('updateCacheSize', () => {
    it('debe actualizar cacheSize', () => {
      monitor.updateCacheSize(42);
      
      const metrics = monitor.getMetrics();
      expect(metrics.cacheSize).toBe(42);
    });

    it('debe estimar memoryUsage basado en cacheSize', () => {
      monitor.updateCacheSize(100);
      
      const metrics = monitor.getMetrics();
      // 100 entries * 1KB = 102400 bytes
      expect(metrics.memoryUsage).toBe(102400);
    });

    it('debe actualizar memoryUsage cuando cacheSize cambia', () => {
      monitor.updateCacheSize(50);
      let metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(51200); // 50 * 1024
      
      monitor.updateCacheSize(100);
      metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(102400); // 100 * 1024
    });
  });

  describe('getMetrics', () => {
    it('debe retornar copia de métricas', () => {
      monitor.recordRequest('/api/users', false, 100);
      
      const metrics1 = monitor.getMetrics();
      const metrics2 = monitor.getMetrics();
      
      // Deben ser objetos diferentes (copia)
      expect(metrics1).not.toBe(metrics2);
      
      // Pero con los mismos valores
      expect(metrics1).toEqual(metrics2);
    });

    it('debe retornar métricas iniciales correctas', () => {
      const metrics = monitor.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cachedRequests).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.p95ResponseTime).toBe(0);
      expect(metrics.p99ResponseTime).toBe(0);
      expect(metrics.cacheSize).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
    });
  });

  describe('reset', () => {
    it('debe resetear todas las métricas a 0', () => {
      // Agregar algunos datos
      monitor.recordRequest('/api/users', true, 100);
      monitor.recordRequest('/api/products', false, 200);
      monitor.updateCacheSize(50);
      
      // Verificar que hay datos
      let metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.cacheSize).toBeGreaterThan(0);
      
      // Reset
      monitor.reset();
      
      // Verificar que todo está en 0
      metrics = monitor.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cachedRequests).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.p95ResponseTime).toBe(0);
      expect(metrics.p99ResponseTime).toBe(0);
      expect(metrics.cacheSize).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
    });

    it('debe limpiar historial de timings', () => {
      // Agregar algunos timings
      monitor.recordRequest('/api/users', false, 100);
      monitor.recordRequest('/api/products', false, 200);
      
      expect(monitor.getTimings().length).toBe(2);
      
      // Reset
      monitor.reset();
      
      expect(monitor.getTimings().length).toBe(0);
    });
  });

  describe('getTimings', () => {
    it('debe retornar array de timings', () => {
      monitor.recordRequest('/api/users', false, 100);
      monitor.recordRequest('/api/products', true, 0);
      
      const timings = monitor.getTimings();
      
      expect(timings).toHaveLength(2);
      expect(timings[0]).toMatchObject({
        url: '/api/users',
        duration: 100,
        cached: false,
      });
      expect(timings[1]).toMatchObject({
        url: '/api/products',
        duration: 0,
        cached: true,
      });
    });

    it('debe retornar copia del array', () => {
      monitor.recordRequest('/api/users', false, 100);
      
      const timings1 = monitor.getTimings();
      const timings2 = monitor.getTimings();
      
      // Deben ser arrays diferentes (copia)
      expect(timings1).not.toBe(timings2);
      
      // Pero con los mismos valores
      expect(timings1).toEqual(timings2);
    });

    it('debe incluir timestamp en cada timing', () => {
      const before = Date.now();
      monitor.recordRequest('/api/users', false, 100);
      const after = Date.now();
      
      const timings = monitor.getTimings();
      
      expect(timings[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(timings[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('Edge Cases', () => {
    it('debe manejar 0 requests correctamente', () => {
      const metrics = monitor.getMetrics();
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
    });

    it('debe manejar 100% cache hit rate', () => {
      monitor.recordRequest('/api/users', true, 0);
      monitor.recordRequest('/api/users', true, 0);
      monitor.recordRequest('/api/users', true, 0);
      
      const metrics = monitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(1.0);
    });

    it('debe manejar 0% cache hit rate', () => {
      monitor.recordRequest('/api/users', false, 100);
      monitor.recordRequest('/api/products', false, 200);
      monitor.recordRequest('/api/orders', false, 300);
      
      const metrics = monitor.getMetrics();
      expect(metrics.cacheHitRate).toBe(0);
    });

    it('debe manejar duración 0ms', () => {
      monitor.recordRequest('/api/users', true, 0);
      
      const metrics = monitor.getMetrics();
      expect(metrics.avgResponseTime).toBe(0);
    });

    it('debe manejar duraciones muy grandes', () => {
      monitor.recordRequest('/api/slow', false, 10000); // 10 segundos
      
      const metrics = monitor.getMetrics();
      expect(metrics.avgResponseTime).toBe(10000);
    });

    it('debe manejar URLs muy largas', () => {
      const longUrl = '/api/' + 'x'.repeat(1000);
      monitor.recordRequest(longUrl, false, 100);
      
      const timings = monitor.getTimings();
      expect(timings[0].url).toBe(longUrl);
    });
  });

  describe('Percentile Calculation', () => {
    it('debe calcular percentiles con 1 solo request', () => {
      monitor.recordRequest('/api/users', false, 100);
      
      const metrics = monitor.getMetrics();
      expect(metrics.p95ResponseTime).toBe(100);
      expect(metrics.p99ResponseTime).toBe(100);
    });

    it('debe calcular percentiles con requests idénticos', () => {
      for (let i = 0; i < 10; i++) {
        monitor.recordRequest('/api/users', false, 100);
      }
      
      const metrics = monitor.getMetrics();
      expect(metrics.avgResponseTime).toBe(100);
      expect(metrics.p95ResponseTime).toBe(100);
      expect(metrics.p99ResponseTime).toBe(100);
    });

    it('debe calcular percentiles con distribución uniforme', () => {
      // 0, 10, 20, ..., 90, 100
      for (let i = 0; i <= 100; i += 10) {
        monitor.recordRequest('/api/test', false, i);
      }
      
      const metrics = monitor.getMetrics();
      // Promedio: (0+10+20+...+100) / 11 = 50
      expect(metrics.avgResponseTime).toBe(50);
      // P95 debería ser ~90-100
      expect(metrics.p95ResponseTime).toBeGreaterThanOrEqual(80);
    });
  });
});
