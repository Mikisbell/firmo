/**
 * Caché de requests con TTL y deduplicación
 * 
 * Este módulo implementa un sistema de caché manual para requests HTTP
 * que no usan SWR. Proporciona:
 * 
 * - Deduplicación automática de requests en vuelo
 * - TTL (Time To Live) configurable por request
 * - Limpieza automática de caché expirado
 * - Type-safe con TypeScript generics
 * - Invalidación manual de caché
 * - Performance monitoring integrado
 * 
 * @module lib/fetch-cache
 * @see {@link https://github.com/park-pos/docs/02-architecture/PERFORMANCE.md}
 */

import { perfMonitor } from './performance-monitor';

/**
 * Entrada de caché con promise, timestamp y TTL
 * 
 * @template T - Tipo de datos que retorna el promise
 */
interface CacheEntry<T> {
  /** Promise del request en vuelo o completado */
  promise: Promise<T>;
  
  /** Timestamp de cuando se creó la entrada (Date.now()) */
  timestamp: number;
  
  /** Time to live en milisegundos */
  ttl: number;
}

/**
 * Clase de caché de requests con TTL y deduplicación
 * 
 * Implementa un caché en memoria para requests HTTP con las siguientes características:
 * 
 * 1. **Deduplicación**: Requests idénticos en vuelo retornan el mismo promise
 * 2. **TTL**: Caché expira automáticamente después del tiempo configurado
 * 3. **Limpieza**: Entradas expiradas se eliminan automáticamente
 * 4. **Type Safety**: Completamente tipado con TypeScript generics
 * 
 * @example
 * ```typescript
 * const cache = new RequestCache();
 * 
 * // Primera llamada: hace el request
 * const data1 = await cache.get('users', () => fetch('/api/users').then(r => r.json()));
 * 
 * // Segunda llamada (dentro del TTL): retorna caché
 * const data2 = await cache.get('users', () => fetch('/api/users').then(r => r.json()));
 * 
 * // data1 === data2 (mismo promise)
 * ```
 */
export class RequestCache {
  /** Map interno que almacena las entradas de caché */
  private cache = new Map<string, CacheEntry<any>>();
  
  /**
   * Obtener datos con caché y deduplicación
   * 
   * Si existe una entrada válida en caché (dentro del TTL), retorna el promise existente.
   * Si no existe o expiró, ejecuta el fetcher y cachea el resultado.
   * 
   * **Deduplicación**: Múltiples llamadas concurrentes con la misma key retornan
   * el mismo promise, evitando requests duplicados.
   * 
   * @template T - Tipo de datos que retorna el fetcher
   * @param key - Clave única del request (ej: URL + params)
   * @param fetcher - Función que obtiene los datos (debe retornar Promise)
   * @param ttl - Time to live en milisegundos (default: 5000ms = 5s)
   * @returns Promise con los datos
   * 
   * @example
   * ```typescript
   * // Caché de 5 segundos (default)
   * const users = await cache.get(
   *   'users-list',
   *   () => fetch('/api/users').then(r => r.json())
   * );
   * 
   * // Caché de 10 segundos
   * const stats = await cache.get(
   *   'dashboard-stats',
   *   () => fetch('/api/stats').then(r => r.json()),
   *   10000
   * );
   * ```
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5000
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);
    
    // Cache hit: retornar promise existente si está dentro del TTL
    if (entry && (now - entry.timestamp) < entry.ttl) {
      // Registrar cache hit (duración = 0 porque no hay request real)
      perfMonitor.recordRequest(key, true, 0);
      return entry.promise;
    }
    
    // Cache miss: crear nuevo request
    const startTime = Date.now();
    const promise = fetcher()
      .then((result) => {
        // Registrar cache miss con duración real
        const duration = Date.now() - startTime;
        perfMonitor.recordRequest(key, false, duration);
        return result;
      })
      .finally(() => {
        // Limpiar caché después del TTL
        // Esto previene memory leaks al eliminar entradas viejas
        setTimeout(() => {
          this.cache.delete(key);
          // Actualizar tamaño de caché después de eliminar
          perfMonitor.updateCacheSize(this.cache.size);
        }, ttl);
      });
    
    // Guardar en caché inmediatamente (antes de que resuelva)
    // Esto permite deduplicación de requests concurrentes
    this.cache.set(key, { promise, timestamp: now, ttl });
    
    // Actualizar tamaño de caché
    perfMonitor.updateCacheSize(this.cache.size);
    
    return promise;
  }
  
  /**
   * Invalidar entrada específica del caché
   * 
   * Útil después de mutaciones (POST, PUT, DELETE) para forzar
   * un refresh de los datos en el próximo request.
   * 
   * @param key - Clave de la entrada a invalidar
   * 
   * @example
   * ```typescript
   * // Después de crear un usuario
   * await createUser(userData);
   * cache.invalidate('users-list'); // Forzar refresh
   * ```
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Limpiar todo el caché
   * 
   * Útil para:
   * - Logout (limpiar datos del usuario anterior)
   * - Cambio de tenant (limpiar datos del tenant anterior)
   * - Testing (reset entre tests)
   * 
   * @example
   * ```typescript
   * // Al hacer logout
   * cache.clear();
   * ```
   */
  clear(): void {
    this.cache.clear();
    // Actualizar tamaño de caché a 0
    perfMonitor.updateCacheSize(0);
  }
  
  /**
   * Obtener tamaño actual del caché
   * 
   * Útil para:
   * - Debugging
   * - Monitoring de memory usage
   * - Alertas si el caché crece demasiado
   * 
   * @returns Número de entradas en caché
   * 
   * @example
   * ```typescript
   * console.log(`Cache size: ${cache.size()} entries`);
   * 
   * // Alerta si el caché es muy grande
   * if (cache.size() > 1000) {
   *   console.warn('Cache size exceeded 1000 entries');
   * }
   * ```
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Singleton instance del RequestCache
 * 
 * Usar esta instancia compartida en toda la aplicación para
 * maximizar la efectividad del caché.
 */
export const requestCache = new RequestCache();

/**
 * Helper function para fetch con caché automático
 * 
 * Wrapper conveniente alrededor de `fetch()` que agrega caché automático
 * con TTL configurable. Maneja errores HTTP y parsing JSON.
 * 
 * **Características**:
 * - Caché automático con TTL
 * - Deduplicación de requests concurrentes
 * - Error handling para HTTP errors
 * - Parsing JSON automático
 * - Type-safe con generics
 * 
 * @template T - Tipo de datos que retorna el endpoint
 * @param url - URL del endpoint
 * @param options - Opciones de fetch (method, headers, body, etc.)
 * @param ttl - Time to live en milisegundos (default: 5000ms = 5s)
 * @returns Promise con los datos parseados
 * @throws Error si el request falla (HTTP error o network error)
 * 
 * @example
 * ```typescript
 * // GET request con caché de 5s
 * const users = await cachedFetch<User[]>('/api/admin/employees');
 * 
 * // POST request (no se cachea porque tiene body)
 * const newUser = await cachedFetch<User>(
 *   '/api/admin/employees',
 *   { method: 'POST', body: JSON.stringify(userData) }
 * );
 * 
 * // GET con caché de 10s
 * const stats = await cachedFetch<Stats>(
 *   '/api/admin/dashboard/stats',
 *   { method: 'GET' },
 *   10000
 * );
 * ```
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  ttl: number = 5000
): Promise<T> {
  // Crear key única basada en URL + options
  // Esto asegura que requests con diferentes params/headers se cacheen por separado
  const key = `${url}-${JSON.stringify(options || {})}`;
  
  return requestCache.get(
    key,
    async () => {
      const response = await fetch(url, options);
      
      // Manejar errores HTTP
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Parsear JSON automáticamente
      return response.json();
    },
    ttl
  );
}

/**
 * Helper para invalidar caché de un endpoint específico
 * 
 * Útil después de mutaciones (POST, PUT, DELETE) para forzar
 * un refresh de los datos en el próximo request.
 * 
 * @param url - URL del endpoint a invalidar
 * @param options - Opciones de fetch (deben coincidir con las del cachedFetch original)
 * 
 * @example
 * ```typescript
 * // Después de crear un empleado
 * await cachedFetch('/api/admin/employees', {
 *   method: 'POST',
 *   body: JSON.stringify(employeeData)
 * });
 * 
 * // Invalidar lista de empleados para forzar refresh
 * invalidateCachedFetch('/api/admin/employees', { method: 'GET' });
 * 
 * // O simplemente
 * invalidateCachedFetch('/api/admin/employees');
 * ```
 */
export function invalidateCachedFetch(url: string, options?: RequestInit): void {
  const key = `${url}-${JSON.stringify(options || {})}`;
  requestCache.invalidate(key);
}
