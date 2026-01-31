/**
 * useStationAlerts Hook
 * 
 * Fetches alerts for KDS stations from the API
 * Supports filtering by station and severity
 * Handles alert dismissal
 * 
 * Requirements: 2.3.4, 2.3.5
 */

import { useState, useEffect, useCallback } from 'react';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type MetricType = 'AVG_TIME' | 'LOAD' | 'EFFICIENCY';

export interface StationAlert {
  id: string;
  stationId: string;
  stationName: string;
  stationCode: string;
  message: string;
  severity: AlertSeverity;
  metricType: MetricType;
  metricValue: number;
  threshold: number;
  isDismissed: boolean;
  dismissedAt: string | null;
  dismissedBy: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
}

interface UseStationAlertsOptions {
  stationId?: string; // Optional: filter by specific station
  severity?: AlertSeverity; // Optional: filter by severity
  includeDismissed?: boolean;
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds, default 60000 (1 minute)
}

interface UseStationAlertsReturn {
  alerts: StationAlert[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  isDismissing: boolean;
}

/**
 * Hook to fetch and manage station alerts
 */
export function useStationAlerts({
  stationId,
  severity,
  includeDismissed = false,
  enabled = true,
  pollingInterval = 60000,
}: UseStationAlertsOptions = {}): UseStationAlertsReturn {
  const [alerts, setAlerts] = useState<StationAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!enabled) {
      return;
    }

    try {
      setError(null);

      const params = new URLSearchParams();
      if (stationId) {
        params.append('stationId', stationId);
      }
      if (severity) {
        params.append('severity', severity);
      }
      if (includeDismissed) {
        params.append('includeDismissed', 'true');
      }

      const queryString = params.toString();
      const url = `/api/admin/stations/alerts${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('No autorizado');
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar alertas';
      setError(errorMessage);
      console.error('Error fetching station alerts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [stationId, severity, includeDismissed, enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      setIsLoading(true);
      fetchAlerts();
    }
  }, [enabled, fetchAlerts]);

  // Polling for real-time updates
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchAlerts();
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, fetchAlerts]);

  const dismissAlert = useCallback(async (alertId: string) => {
    setIsDismissing(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/stations/alerts/${alertId}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Alerta no encontrada');
        } else if (response.status === 400) {
          const data = await response.json();
          throw new Error(data.error || 'Alerta ya fue descartada');
        } else if (response.status === 401) {
          throw new Error('No autorizado');
        } else {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
      }

      // Update local state to remove dismissed alert
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al descartar alerta';
      setError(errorMessage);
      console.error('Error dismissing alert:', err);
      throw err; // Re-throw so caller can handle
    } finally {
      setIsDismissing(false);
    }
  }, []);

  return {
    alerts,
    isLoading,
    error,
    refetch: fetchAlerts,
    dismissAlert,
    isDismissing,
  };
}
