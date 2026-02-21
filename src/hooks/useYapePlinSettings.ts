'use client';

/**
 * useYapePlinSettings - SWR hook for Yape/Plin merchant config
 *
 * @module hooks/useYapePlinSettings
 */

import useSWR, { type SWRConfiguration } from 'swr';
import { fetcher } from '@/src/lib/swr-config';

export interface YapePlinSettings {
  yape_merchant_phone: string | null;
  yape_merchant_name: string | null;
  plin_merchant_phone: string | null;
  plin_merchant_name: string | null;
}

export function useYapePlinSettings(config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<YapePlinSettings>(
    '/api/admin/settings/yape-plin',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...config,
    },
  );

  return {
    settings: data ?? null,
    error,
    isLoading,
    mutate,
  };
}
