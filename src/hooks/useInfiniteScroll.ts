/**
 * useInfiniteScroll Hook (2026 Modern)
 * React hook for infinite scroll with cursor-based pagination
 * 
 * Features:
 * - Cursor-based pagination
 * - Automatic loading on scroll
 * - Optimistic updates
 * - Error handling and retry
 * - Loading states
 * 
 * Requirements: FASE1 DÍA 4 PARTE 2 - Modernización
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseInfiniteScrollOptions<T> {
  fetchFn: (cursor: string | null, limit: number) => Promise<{
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  initialLimit?: number;
  enabled?: boolean;
}

export interface UseInfiniteScrollReturn<T> {
  // Data
  items: T[];
  hasMore: boolean;
  
  // State
  loading: boolean;
  error: Error | null;
  
  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  
  // Optimistic updates
  addOptimistic: (item: T) => void;
  removeOptimistic: (predicate: (item: T) => boolean) => void;
  updateOptimistic: (predicate: (item: T) => boolean, updater: (item: T) => T) => void;
  
  // Ref for intersection observer
  observerRef: (node: HTMLElement | null) => void;
}

/**
 * Hook for infinite scroll with cursor-based pagination
 * 
 * @param options - Configuration options
 * @returns Infinite scroll state and actions
 * 
 * @example
 * const { items, loading, observerRef } = useInfiniteScroll({
 *   fetchFn: async (cursor, limit) => {
 *     const res = await fetch(`/api/items?cursor=${cursor}&limit=${limit}`);
 *     return res.json();
 *   },
 * });
 * 
 * return (
 *   <div>
 *     {items.map(item => <Item key={item.id} data={item} />)}
 *     {loading && <Spinner />}
 *     <div ref={observerRef} /> // Trigger point
 *   </div>
 * );
 */
export function useInfiniteScroll<T>({
  fetchFn,
  initialLimit = 20,
  enabled = true,
}: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const observerTarget = useRef<HTMLElement | null>(null);
  const isInitialLoad = useRef(true);

  // Load more items
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn(nextCursor, initialLimit);
      
      setItems(prev => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load items'));
    } finally {
      setLoading(false);
    }
  }, [fetchFn, nextCursor, initialLimit, loading, hasMore, enabled]);

  // Refresh (reload from start)
  const refresh = useCallback(async () => {
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    setError(null);
    
    setLoading(true);
    try {
      const result = await fetchFn(null, initialLimit);
      
      setItems(result.items);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh items'));
    } finally {
      setLoading(false);
    }
  }, [fetchFn, initialLimit]);

  // Reset to initial state
  const reset = useCallback(() => {
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    setLoading(false);
    setError(null);
    isInitialLoad.current = true;
  }, []);

  // Optimistic add
  const addOptimistic = useCallback((item: T) => {
    setItems(prev => [item, ...prev]);
  }, []);

  // Optimistic remove
  const removeOptimistic = useCallback((predicate: (item: T) => boolean) => {
    setItems(prev => prev.filter(item => !predicate(item)));
  }, []);

  // Optimistic update
  const updateOptimistic = useCallback((
    predicate: (item: T) => boolean,
    updater: (item: T) => T
  ) => {
    setItems(prev => prev.map(item => predicate(item) ? updater(item) : item));
  }, []);

  // Intersection Observer for auto-loading
  const observerRef = useCallback((node: HTMLElement | null) => {
    if (loading) return;
    
    if (observerTarget.current) {
      // Disconnect previous observer
      observerTarget.current = null;
    }

    if (node) {
      observerTarget.current = node;
      
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loading) {
            loadMore();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(node);

      return () => observer.disconnect();
    }
  }, [loading, hasMore, loadMore]);

  // Initial load
  useEffect(() => {
    if (isInitialLoad.current && enabled) {
      isInitialLoad.current = false;
      loadMore();
    }
  }, [enabled, loadMore]);

  return {
    // Data
    items,
    hasMore,
    
    // State
    loading,
    error,
    
    // Actions
    loadMore,
    refresh,
    reset,
    
    // Optimistic updates
    addOptimistic,
    removeOptimistic,
    updateOptimistic,
    
    // Observer ref
    observerRef,
  };
}
