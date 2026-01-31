/**
 * usePagination Hook
 * React hook for managing pagination state in frontend components
 * 
 * Features:
 * - Page state management
 * - Navigation functions (next, prev, goTo, first, last)
 * - Computed values (hasNext, hasPrev, totalPages)
 * - Loading state
 * 
 * Requirements: FASE1 DÍA 3 - Paginación
 */

import { useState, useCallback, useMemo } from 'react';

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  total?: number;
}

export interface UsePaginationReturn {
  // State
  page: number;
  limit: number;
  total: number;
  loading: boolean;

  // Computed
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  startIndex: number;
  endIndex: number;

  // Actions
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setTotal: (total: number) => void;
  setLoading: (loading: boolean) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  goToPage: (page: number) => void;
}

/**
 * Hook for managing pagination state
 * 
 * @param options - Configuration options
 * @returns Pagination state and actions
 * 
 * @example
 * const pagination = usePagination({ initialLimit: 20 });
 * 
 * // In your component
 * <button onClick={pagination.prevPage} disabled={!pagination.hasPrev}>
 *   Previous
 * </button>
 * <span>Page {pagination.page} of {pagination.totalPages}</span>
 * <button onClick={pagination.nextPage} disabled={!pagination.hasNext}>
 *   Next
 * </button>
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialLimit = 10,
    total: initialTotal = 0,
  } = options;

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  // Computed values
  const totalPages = useMemo(() => {
    return Math.ceil(total / limit) || 0;
  }, [total, limit]);

  const hasNext = useMemo(() => {
    return page < totalPages;
  }, [page, totalPages]);

  const hasPrev = useMemo(() => {
    return page > 1;
  }, [page]);

  const startIndex = useMemo(() => {
    return (page - 1) * limit + 1;
  }, [page, limit]);

  const endIndex = useMemo(() => {
    return Math.min(page * limit, total);
  }, [page, limit, total]);

  // Navigation actions
  const nextPage = useCallback(() => {
    if (hasNext) {
      setPage(prev => prev + 1);
    }
  }, [hasNext]);

  const prevPage = useCallback(() => {
    if (hasPrev) {
      setPage(prev => prev - 1);
    }
  }, [hasPrev]);

  const firstPage = useCallback(() => {
    setPage(1);
  }, []);

  const lastPage = useCallback(() => {
    if (totalPages > 0) {
      setPage(totalPages);
    }
  }, [totalPages]);

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  }, [totalPages]);

  return {
    // State
    page,
    limit,
    total,
    loading,

    // Computed
    totalPages,
    hasNext,
    hasPrev,
    startIndex,
    endIndex,

    // Actions
    setPage,
    setLimit,
    setTotal,
    setLoading,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    goToPage,
  };
}

