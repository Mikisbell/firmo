/**
 * Performance Monitor para React Cache Optimization
 * 
 * Monitorea y registra métricas de performance del sistema de caché:
 * - Request metrics (total, cached, hit rate)
 * - Timing metrics (avg, p95, p99)
 * - Memory metrics (cache size, memory usage)
 * 
 * @module lib/performance-monitor
 */

/**
 * Métricas de performance del sistema de caché
 */
export interface PerformanceMetrics {
  // === REQUEST METRICS ===
  /** Total de requests realizados */
  totalRequests: number;
  
  /** Requests que usaron caché (cache hits) */
  cachedRequests: number;
  
  /** Tasa de aciertos de caché (0-1) */
  cacheHitRate: number;
  
  // === TIMING METRICS ===
  /** Tiempo promedio de respuesta (ms) */
  avgResponseTime: number;
  
  /** Percentil 95 de tiempo de respuesta (ms) */
  p95ResponseTime: number;
  
  /** Percentil 99 de tiempo de respuesta (ms) */
  p99ResponseTime: number;
  
  // === MEMORY METRICS ===
  /** Número de entradas en caché */
  cacheSize: number;
  
  /** Uso de memoria estimado (bytes) */
  memoryUsage: number;
}

/**
 * Entrada de timing para cálculo de percentiles
 */
interface TimingEntry {
  url: string;
  duration: number;
  cached: boolean;
  timestamp: number;
}

/**
 * Monitor de performance para sistema de caché
 * 
 * Registra y calcula métricas de performance en tiempo real.
 * Mantiene historial de timings para cálculo de percentiles.
 * 
 * @example
 * ```typescript
 * // Registrar un request
 * perfMonitor.recordRequest('/api/employees', false, 150);
 * 
 * // Obtener métricas actuales
 * const metrics = perfMonitor.getMetrics();
 * console.log(`Cache hit rate: ${metrics.cacheHitRate * 100}%`);
 * ```
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private timings: TimingEntry[];
  private maxTimings: number;
  
  /**
   * Crear nuevo monitor de performance
   * 
   * @param maxTimings - Máximo de timings a mantener en memoria (default: 1000)
   */
  constructor(maxTimings: number = 1000) {
    this.maxTimings = maxTimings;
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      cacheSize: 0,
      memoryUsage: 0,
    };
    this.timings = [];
  }
  
  /**
   * Registrar un request y actualizar métricas
   * 
   * @param url - URL del request
   * @param cached - Si el request usó caché
   * @param duration - Duración del request en ms
   */
  recordRequest(url: string, cached: boolean, duration: number): void {
    // Actualizar contadores
    this.metrics.totalRequests++;
    if (cached) {
      this.metrics.cachedRequests++;
    }
    
    // Calcular cache hit rate
    this.metrics.cacheHitRate = this.metrics.cachedRequests / this.metrics.totalRequests;
    
    // Agregar timing
    this.timings.push({
      url,
      duration,
      cached,
      timestamp: Date.now(),
    });
    
    // Mantener solo los últimos N timings
    if (this.timings.length > this.maxTimings) {
      this.timings.shift();
    }
    
    // Recalcular timing metrics
    this.updateTimingMetrics();
  }
  
  /**
   * Actualizar tamaño de caché
   * 
   * @param size - Número de entradas en caché
   */
  updateCacheSize(size: number): void {
    this.metrics.cacheSize = size;
    
    // Estimar uso de memoria (aproximado)
    // Asumimos ~1KB por entrada de caché
    this.metrics.memoryUsage = size * 1024;
  }
  
  /**
   * Obtener métricas actuales
   * 
   * @returns Copia de las métricas actuales
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Resetear todas las métricas
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      cacheSize: 0,
      memoryUsage: 0,
    };
    this.timings = [];
  }
  
  /**
   * Obtener historial de timings
   * 
   * @returns Array de timings registrados
   */
  getTimings(): TimingEntry[] {
    return [...this.timings];
  }
  
  /**
   * Actualizar métricas de timing (avg, p95, p99)
   * 
   * Calcula:
   * - Tiempo promedio de respuesta
   * - Percentil 95 (95% de requests son más rápidos)
   * - Percentil 99 (99% de requests son más rápidos)
   */
  private updateTimingMetrics(): void {
    if (this.timings.length === 0) {
      this.metrics.avgResponseTime = 0;
      this.metrics.p95ResponseTime = 0;
      this.metrics.p99ResponseTime = 0;
      return;
    }
    
    // Calcular promedio
    const sum = this.timings.reduce((acc, t) => acc + t.duration, 0);
    this.metrics.avgResponseTime = Math.round(sum / this.timings.length);
    
    // Calcular percentiles
    const sorted = [...this.timings].sort((a, b) => a.duration - b.duration);
    
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    this.metrics.p95ResponseTime = sorted[p95Index]?.duration || 0;
    this.metrics.p99ResponseTime = sorted[p99Index]?.duration || 0;
  }
}

/**
 * Singleton instance del monitor de performance
 * 
 * Usar esta instancia en toda la aplicación para métricas consistentes.
 * 
 * @example
 * ```typescript
 * import { perfMonitor } from '@/lib/performance-monitor';
 * 
 * // En fetch-cache.ts
 * const start = Date.now();
 * const result = await fetch(url);
 * perfMonitor.recordRequest(url, cached, Date.now() - start);
 * ```
 */
export const perfMonitor = new PerformanceMonitor();
