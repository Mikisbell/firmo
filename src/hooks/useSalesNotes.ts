'use client';

/**
 * useSalesNotes - SWR hook para listar notas de venta (documento interno NO fiscal).
 *
 * @module hooks/useSalesNotes
 */

import useSWR, { type SWRConfiguration } from 'swr';
import { fetcher } from '@/src/lib/swr-config';

export interface SalesNoteListItem {
  id: string;
  serie: string;
  numero: string;
  total_cents: number;
  status: 'OPEN' | 'CONVERTED' | 'VOIDED';
  invoice_id: string | null;
  invoice_type: string | null;
  converted_at: string | null;
  voided_at: string | null;
  created_at: string;
}

interface SalesNoteListResponse {
  items: SalesNoteListItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export function useSalesNotes(
  filters?: {
    page?: number;
    limit?: number;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
  },
  config?: SWRConfiguration,
) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.search) params.set('search', filters.search);

  const qs = params.toString();
  const url = `/api/admin/sales-notes${qs ? `?${qs}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<SalesNoteListResponse>(
    url,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      ...config,
    },
  );

  return {
    salesNotes: data?.items ?? [],
    pagination: data?.pagination ?? null,
    error,
    isLoading,
    mutate,
  };
}
