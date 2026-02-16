/**
 * Hooks reutilizables para operaciones CRUD en el Admin Panel
 * 
 * useAdminData: Hook para fetch de datos con manejo de loading/error (optimizado con SWR)
 * useAdminMutation: Hook para mutaciones (POST, PUT, DELETE)
 * 
 * Referencia: SOLUCIONES_IMPLEMENTACION.md #2
 * UX Improvement: P0 - Elimina duplicación de código de fetch
 * Performance: Optimizado con SWR para deduplicación y caché automático
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';

interface UseAdminDataOptions {
  autoFetch?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
  refreshInterval?: number; // Auto-refresh interval en ms (opcional)
}

/**
 * Fetcher function para SWR
 * Maneja respuestas paginadas y arrays directos
 */
async function fetcher<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Error al cargar datos' }));
    throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
  }
  
  const result = await res.json();
  // Handle paginated responses: { items: [...], pagination: {...} }
  const dataArray = result.items || result.data || result;
  return Array.isArray(dataArray) ? dataArray : [];
}

/**
 * Hook para fetch de datos con manejo automático de estados
 * Optimizado con SWR para deduplicación automática y caché
 * 
 * @example
 * const { data: employees, loading, error, refetch } = useAdminData<Employee>(
 *   '/api/admin/employees'
 * );
 * 
 * @example Con auto-refresh
 * const { data: stats } = useAdminData<Stat>(
 *   '/api/admin/stats',
 *   { refreshInterval: 5000 } // Refresh cada 5s
 * );
 */
export function useAdminData<T>(
  endpoint: string,
  options: UseAdminDataOptions = {}
) {
  const { autoFetch = true, onSuccess, onError, refreshInterval } = options;
  
  // Usar SWR para fetch con deduplicación automática
  const { data, error: swrError, mutate, isLoading, isValidating } = useSWR<T[]>(
    autoFetch ? endpoint : null, // null desactiva el fetch
    fetcher,
    {
      refreshInterval, // Auto-refresh si se especifica
      onSuccess: (data) => {
        onSuccess?.(data);
      },
      onError: (err) => {
        onError?.(err);
      },
    }
  );

  // Convertir error de SWR a string para compatibilidad
  const error = swrError ? (swrError instanceof Error ? swrError.message : 'Error al cargar datos') : null;
  
  // Loading es true si está cargando por primera vez O validando sin datos
  const loading = isLoading || (isValidating && !data);

  return { 
    data: data || [], 
    loading, 
    error, 
    refetch: mutate, // mutate() revalida los datos
    setData: mutate, // mutate(newData, false) actualiza sin revalidar (optimistic updates)
  };
}

/**
 * Hook para mutaciones (POST, PUT, DELETE) con manejo de estados
 * 
 * @example
 * const { mutate: createEmployee, loading: creating } = useAdminMutation<Employee>(
 *   '/api/admin/employees',
 *   'POST'
 * );
 * 
 * await createEmployee({ name: 'Juan', role: 'WAITER', pin: '1234' });
 */
export function useAdminMutation<T = unknown>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data?: T) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(endpoint, {
        method,
        headers: data ? { 'Content-Type': 'application/json' } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Error en la operación' }));
        throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
      }

      return method === 'DELETE' ? null : await res.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error en la operación';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method]);

  return { mutate, loading, error };
}
