'use client';

/**
 * useTableQRs - SWR hook for table QR codes
 *
 * @module hooks/useTableQRs
 */

import useSWR, { type SWRConfiguration } from 'swr';
import { fetcher } from '@/src/lib/swr-config';

interface TableQRItem {
  tableId: string;
  tableNumber: string;
  displayName: string;
  qrDataUrl: string;
  menuUrl: string;
}

interface TableQRsResponse {
  items: TableQRItem[];
}

export function useTableQRs(locationId: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<TableQRsResponse>(
    locationId ? `/api/admin/mesas/qr?location_id=${locationId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      ...config,
    },
  );

  return {
    items: data?.items ?? [],
    error,
    isLoading,
    mutate,
  };
}
