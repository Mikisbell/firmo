/**
 * useStationOrders Hook
 * 
 * Fetches active orders for a KDS station from the API
 * Supports pagination and real-time updates via polling
 * 
 * Requirements: 2.2.1, 2.2.2, 2.2.3, 2.2.4, 2.2.5
 */

import { useState, useEffect, useCallback } from 'react';

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  status: 'PENDING' | 'COOKING' | 'READY' | 'COMPLETED';
  notes?: string;
}

export interface StationOrder {
  orderId: string;
  orderNumber: string;
  tableNumber?: string;
  waiterName?: string;
  items: OrderItem[];
  status: 'PENDING' | 'COOKING' | 'READY';
  waitTime: number; // in minutes
  submittedAt: string;
}

interface UseStationOrdersOptions {
  stationId: string;
  enabled?: boolean;
  limit?: number;
  pollingInterval?: number; // in milliseconds, default 15000 (15 seconds)
}

interface UseStationOrdersReturn {
  orders: StationOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Hook to fetch and manage station orders
 */
export function useStationOrders({
  stationId,
  enabled = true,
  limit = 20,
  pollingInterval = 15000,
}: UseStationOrdersOptions): UseStationOrdersReturn {
  const [orders, setOrders] = useState<StationOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const fetchOrders = useCallback(async (currentOffset: number = 0, append: boolean = false) => {
    if (!enabled || !stationId) {
      return;
    }

    try {
      setError(null);
      if (!append) {
        setIsLoading(true);
      }

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString(),
      });

      const response = await fetch(
        `/api/admin/stations/${stationId}/orders?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        }
      );

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
      
      if (append) {
        setOrders((prev) => [...prev, ...data.orders]);
      } else {
        setOrders(data.orders);
      }

      setHasMore(data.hasMore || false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar órdenes';
      setError(errorMessage);
      console.error('Error fetching station orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [stationId, enabled, limit]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      setIsLoading(true);
      setOffset(0);
      fetchOrders(0, false);
    }
  }, [enabled, fetchOrders]);

  // Polling for real-time updates (only refresh current page, don't append)
  useEffect(() => {
    if (!enabled || pollingInterval <= 0) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchOrders(0, false);
      setOffset(0);
    }, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, pollingInterval, fetchOrders]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) {
      return;
    }

    const newOffset = offset + limit;
    setOffset(newOffset);
    await fetchOrders(newOffset, true);
  }, [hasMore, isLoading, offset, limit, fetchOrders]);

  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchOrders(0, false);
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch,
    hasMore,
    loadMore,
  };
}
