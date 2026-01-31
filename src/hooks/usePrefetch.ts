/**
 * usePrefetch Hook
 * Prefetch routes on hover/focus for faster navigation
 * 
 * Task 14.4 - Mobile Responsive Spec
 * Requirements: 9.4
 */

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

interface UsePrefetchOptions {
  /** Delay before prefetching (ms) */
  delay?: number;
  /** Only prefetch on desktop (skip mobile) */
  desktopOnly?: boolean;
}

/**
 * Hook to prefetch a route on hover
 * Returns handlers to attach to elements
 */
export function usePrefetch(href: string, options: UsePrefetchOptions = {}) {
  const { delay = 100, desktopOnly = false } = options;
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prefetchedRef = useRef(false);

  const prefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    
    // Skip on mobile if desktopOnly
    if (desktopOnly && typeof window !== "undefined" && window.innerWidth < 768) {
      return;
    }

    router.prefetch(href);
    prefetchedRef.current = true;
  }, [href, router, desktopOnly]);

  const onMouseEnter = useCallback(() => {
    if (prefetchedRef.current) return;
    
    timeoutRef.current = setTimeout(prefetch, delay);
  }, [prefetch, delay]);

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const onFocus = useCallback(() => {
    prefetch();
  }, [prefetch]);

  return {
    onMouseEnter,
    onMouseLeave,
    onFocus,
    prefetch,
  };
}

/**
 * Hook to prefetch multiple routes
 */
export function usePrefetchRoutes(routes: string[]) {
  const router = useRouter();
  const prefetchedRef = useRef<Set<string>>(new Set());

  const prefetchAll = useCallback(() => {
    routes.forEach((route) => {
      if (!prefetchedRef.current.has(route)) {
        router.prefetch(route);
        prefetchedRef.current.add(route);
      }
    });
  }, [routes, router]);

  const prefetchOne = useCallback((route: string) => {
    if (!prefetchedRef.current.has(route)) {
      router.prefetch(route);
      prefetchedRef.current.add(route);
    }
  }, [router]);

  return {
    prefetchAll,
    prefetchOne,
    isPrefetched: (route: string) => prefetchedRef.current.has(route),
  };
}

export default usePrefetch;
