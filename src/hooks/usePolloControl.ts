/**
 * Hooks SWR para control de pollo
 */

import useSWR from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Error al cargar datos' }));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
};

export function usePolloDashboard(locationId: string | null) {
  const key = locationId
    ? `/api/admin/pollo-control?location_id=${locationId}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    refreshInterval: 15000, // Refresh cada 15s (tiempo real)
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  return {
    equivalents: data?.equivalents ?? null,
    summary: data?.summary ?? null,
    isLoading,
    error,
    mutate,
  };
}

interface UsePolloHistoryOptions {
  locationId?: string;
  page?: number;
  limit?: number;
}

export function usePolloHistory(options: UsePolloHistoryOptions = {}) {
  const params = new URLSearchParams();
  if (options.locationId) params.set('location_id', options.locationId);
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const key = `/api/admin/pollo-control/history${query ? `?${query}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  return {
    history: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
