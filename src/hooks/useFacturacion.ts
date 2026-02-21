'use client';

/**
 * useFacturacion - SWR hooks for invoice management
 *
 * @module hooks/useFacturacion
 */

import useSWR, { type SWRConfiguration } from 'swr';
import { fetcher } from '@/src/lib/swr-config';

// ============================================================================
// Types
// ============================================================================

interface InvoiceListItem {
  id: string;
  invoice_type: string;
  series: string | null;
  invoice_number: string | null;
  customer_doc_type: string | null;
  customer_doc: string | null;
  total_cents: number;
  status: string;
  created_at: string;
}

interface InvoiceListResponse {
  items: InvoiceListItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

interface InvoiceStats {
  totalCount: number;
  totalAmountCents: number;
  boletaCount: number;
  facturaCount: number;
  voidedCount: number;
  pendingSunatCount: number;
}

interface InvoiceDetail extends InvoiceListItem {
  order_id: string;
  check_id: string;
  payment_summary: any;
  void_reason: string | null;
  voided_at: string | null;
  credit_notes: any[];
  sunat_status: string;
  cdr: {
    response_code: string;
    response_message: string;
    hash: string | null;
    received_at: string;
  } | null;
}

// ============================================================================
// Hooks
// ============================================================================

export function useInvoices(
  filters?: {
    page?: number;
    limit?: number;
    type?: string;
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
  if (filters?.type) params.set('type', filters.type);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  if (filters?.search) params.set('search', filters.search);

  const qs = params.toString();
  const url = `/api/admin/facturacion${qs ? `?${qs}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<InvoiceListResponse>(
    url,
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      ...config,
    },
  );

  return {
    invoices: data?.items ?? [],
    pagination: data?.pagination ?? null,
    error,
    isLoading,
    mutate,
  };
}

export function useInvoice(invoiceId: string | null, config?: SWRConfiguration) {
  const { data, error, isLoading, mutate } = useSWR<InvoiceDetail>(
    invoiceId ? `/api/admin/facturacion/${invoiceId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      ...config,
    },
  );

  return {
    invoice: data ?? null,
    error,
    isLoading,
    mutate,
  };
}

export function useInvoiceStats(
  from?: string,
  to?: string,
  config?: SWRConfiguration,
) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();

  const { data, error, isLoading } = useSWR<InvoiceStats>(
    `/api/admin/facturacion/stats${qs ? `?${qs}` : ''}`,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
      ...config,
    },
  );

  return {
    stats: data ?? null,
    error,
    isLoading,
  };
}
