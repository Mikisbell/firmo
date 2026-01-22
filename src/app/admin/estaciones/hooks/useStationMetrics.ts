/**
 * useStationMetrics Hook
 * 
 * Fetches real-time metrics for a KDS station from the API
 * Implements polling fallback (30 seconds) for real-time updates
 * 
 * Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.1.5
 */

import { useState, useEffect, useCallback } from 'react';

export interface StationMetrics {
  stationId: string;
  stationCode: string;
  activeOrders: number;
  avgTime: number; // in minutes
  efficiency: number; // percentage 0-100
  load: number; // percentage 0-100
  estimatedTime: number; // in minutes
  lastUpdated: string;
}

interface UseStationMetricsOptions {
  stationId: string;
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds, default 30000 (30 seconds)
}

interface UseStationMetricsReturn {
  metrics: StationMetrics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage station metrics
 */
export function useStationMetrics({
  stationId,
  enabled = true,
  pollingInterval = 30000,
}: UseStationMetricsOptions): UseStationMetricsReturn {
  const [metrics, setMetrics] = useState<StationMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!enabled || !stationId) {
      return;
    }

    try {
      setError(null);
      
      const response = await fetch(`/api/admin/stations/${stationId}/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Estación no encontrada');
        } else if (response.status === 401) {
          throw new Error('No autorizado');
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar métricas';
      setError(errorMessage);
      console.error('Error fetching station metrics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [stationId, enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      setIsLoading(true);
      fetchMetrics();
    }
  }, [enabled, fetchMetrics]);

  // Polling for real-time updates
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchMetrics();
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, fetchMetrics]);

  return {
    metrics,
    isLoading,
    error,
    refetch: fetchMetrics,
  };
}
