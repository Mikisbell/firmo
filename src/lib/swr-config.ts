/**
 * Configuración global de SWR para optimización de performance
 * 
 * Este archivo define las configuraciones de SWR para diferentes tipos de endpoints:
 * - Global: Configuración por defecto para todos los componentes
 * - High Frequency: Para datos en tiempo real (monitoring, alerts)
 * - Low Frequency: Para datos estáticos (configuración, catálogos)
 * 
 * @module lib/swr-config
 */

import { SWRConfiguration } from 'swr';

/**
 * Configuración global de SWR para optimización de performance
 * 
 * Features:
 * - Deduplicación automática de requests (2s window)
 * - Caché persistente en memoria
 * - Revalidación inteligente
 * - Error retry con backoff exponencial
 * 
 * @example
 * ```tsx
 * import { SWRConfig } from 'swr';
 * import { swrGlobalConfig } from '@/lib/swr-config';
 * 
 * export default function Layout({ children }) {
 *   return (
 *     <SWRConfig value={swrGlobalConfig}>
 *       {children}
 *     </SWRConfig>
 *   );
 * }
 * ```
 */
export const swrGlobalConfig: SWRConfiguration = {
  // === DEDUPLICATION ===
  // Requests idénticos dentro de 2s se deduplicarán automáticamente
  // Esto previene llamadas duplicadas cuando múltiples componentes
  // solicitan los mismos datos simultáneamente
  dedupingInterval: 2000,
  
  // === REVALIDATION ===
  // No revalidar en focus (evita requests innecesarios cuando el usuario
  // cambia de tab y regresa)
  revalidateOnFocus: false,
  
  // Revalidar al reconectar (importante para offline-first)
  // Cuando el usuario recupera conexión, refrescar datos automáticamente
  revalidateOnReconnect: true,
  
  // No revalidar en mount si hay datos en caché
  // Esto mejora la percepción de velocidad mostrando datos cacheados inmediatamente
  revalidateIfStale: false,
  
  // === CACHE ===
  // Provider personalizado para caché persistente en memoria
  // Usa Map nativo de JavaScript para máxima performance
  provider: () => new Map(),
  
  // === ERROR HANDLING ===
  // Retry 3 veces con 5s de intervalo
  // Esto maneja errores transitorios de red automáticamente
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // === PERFORMANCE ===
  // Suspense mode deshabilitado (no compatible con auto-refresh)
  suspense: false,
  
  // Keep previous data mientras revalida
  // Esto previene "flashing" de loading states
  keepPreviousData: true,
};

/**
 * Configuración específica para endpoints de alta frecuencia
 * 
 * Usar para datos que cambian frecuentemente y requieren actualizaciones
 * en tiempo real:
 * - Monitoring metrics
 * - Alertas activas
 * - Estados de estaciones KDS
 * - Órdenes en progreso
 * 
 * @example
 * ```tsx
 * import useSWR from 'swr';
 * import { swrHighFrequencyConfig } from '@/lib/swr-config';
 * 
 * export function MonitoringPage() {
 *   const { data } = useSWR(
 *     '/api/admin/monitoring/metrics',
 *     fetcher,
 *     swrHighFrequencyConfig
 *   );
 * }
 * ```
 */
export const swrHighFrequencyConfig: SWRConfiguration = {
  ...swrGlobalConfig,
  
  // Deduplicación más agresiva (1s) para datos en tiempo real
  dedupingInterval: 1000,
  
  // Auto-refresh cada 5 segundos
  // Mantiene los datos actualizados sin intervención del usuario
  refreshInterval: 5000,
  
  // Revalidar en focus para datos críticos
  // Cuando el usuario regresa a la página, refrescar inmediatamente
  revalidateOnFocus: true,
};

/**
 * Configuración específica para endpoints de baja frecuencia
 * 
 * Usar para datos que cambian raramente:
 * - Configuración del sistema
 * - Catálogos de productos
 * - Lista de empleados
 * - Templates de tenant
 * 
 * @example
 * ```tsx
 * import useSWR from 'swr';
 * import { swrLowFrequencyConfig } from '@/lib/swr-config';
 * 
 * export function ConfigPage() {
 *   const { data } = useSWR(
 *     '/api/admin/config',
 *     fetcher,
 *     swrLowFrequencyConfig
 *   );
 * }
 * ```
 */
export const swrLowFrequencyConfig: SWRConfiguration = {
  ...swrGlobalConfig,
  
  // Deduplicación más relajada (5s) para datos estáticos
  dedupingInterval: 5000,
  
  // Revalidar si los datos son muy viejos
  // Esto asegura que datos estáticos eventualmente se actualicen
  revalidateIfStale: true,
  
  // No auto-refresh (datos cambian raramente)
  refreshInterval: 0,
};

/**
 * Fetcher por defecto para SWR
 * 
 * Esta función se usa como fetcher estándar en todos los hooks useSWR.
 * Maneja errores HTTP automáticamente y parsea JSON.
 * 
 * @param url - URL del endpoint a consultar
 * @returns Promise con los datos parseados
 * @throws Error si la respuesta no es OK (status >= 400)
 * 
 * @example
 * ```tsx
 * import useSWR from 'swr';
 * import { fetcher } from '@/lib/swr-config';
 * 
 * const { data, error } = useSWR('/api/admin/employees', fetcher);
 * ```
 */
export const fetcher = async <T = any>(url: string): Promise<T> => {
  const response = await fetch(url);
  
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    // Agregar información adicional al error para debugging
    (error as any).status = response.status;
    (error as any).url = url;
    throw error;
  }
  
  return response.json();
};

/**
 * Fetcher con autenticación para endpoints protegidos
 * 
 * Similar al fetcher estándar pero incluye el token de autenticación
 * en el header Authorization.
 * 
 * @param url - URL del endpoint a consultar
 * @param token - Token JWT de autenticación
 * @returns Promise con los datos parseados
 * @throws Error si la respuesta no es OK
 * 
 * @example
 * ```tsx
 * import useSWR from 'swr';
 * import { authenticatedFetcher } from '@/lib/swr-config';
 * 
 * const token = getAuthToken();
 * const { data } = useSWR(
 *   ['/api/admin/secure-data', token],
 *   ([url, token]) => authenticatedFetcher(url, token)
 * );
 * ```
 */
export const authenticatedFetcher = async <T = any>(
  url: string,
  token: string
): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
    (error as any).status = response.status;
    (error as any).url = url;
    throw error;
  }
  
  return response.json();
};
