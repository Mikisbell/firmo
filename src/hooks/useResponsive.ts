/**
 * useResponsive Hook
 * Detects viewport size and provides responsive breakpoint flags
 * SSR-safe with hydration handling
 * 
 * Task 1.3 - Mobile Responsive Spec
 */

import { useState, useEffect, useCallback } from 'react';

// Breakpoints matching Tailwind defaults
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export interface ResponsiveState {
  // Viewport dimensions
  width: number;
  height: number;
  
  // Breakpoint flags (mobile-first: true if >= breakpoint)
  isSm: boolean;   // >= 640px
  isMd: boolean;   // >= 768px
  isLg: boolean;   // >= 1024px
  isXl: boolean;   // >= 1280px
  is2xl: boolean;  // >= 1536px
  
  // Convenience flags
  isMobile: boolean;     // < 768px (phones)
  isTablet: boolean;     // 768px - 1023px
  isDesktop: boolean;    // >= 1024px
  
  // Orientation
  isLandscape: boolean;
  isPortrait: boolean;
  
  // Touch device detection
  isTouchDevice: boolean;
  
  // Current breakpoint name
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

// Default state for SSR (assume mobile-first)
const DEFAULT_STATE: ResponsiveState = {
  width: 375,
  height: 667,
  isSm: false,
  isMd: false,
  isLg: false,
  isXl: false,
  is2xl: false,
  isMobile: true,
  isTablet: false,
  isDesktop: false,
  isLandscape: false,
  isPortrait: true,
  isTouchDevice: true,
  breakpoint: 'xs',
};

function getBreakpoint(width: number): ResponsiveState['breakpoint'] {
  if (width >= BREAKPOINTS['2xl']) return '2xl';
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

function calculateState(): ResponsiveState {
  if (typeof window === 'undefined') {
    return DEFAULT_STATE;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const isSm = width >= BREAKPOINTS.sm;
  const isMd = width >= BREAKPOINTS.md;
  const isLg = width >= BREAKPOINTS.lg;
  const isXl = width >= BREAKPOINTS.xl;
  const is2xl = width >= BREAKPOINTS['2xl'];
  
  const isTouchDevice = 
    'ontouchstart' in window || 
    navigator.maxTouchPoints > 0;

  return {
    width,
    height,
    isSm,
    isMd,
    isLg,
    isXl,
    is2xl,
    isMobile: !isMd,
    isTablet: isMd && !isLg,
    isDesktop: isLg,
    isLandscape: width > height,
    isPortrait: height >= width,
    isTouchDevice,
    breakpoint: getBreakpoint(width),
  };
}

/**
 * Hook to detect responsive breakpoints
 * 
 * @example
 * const { isMobile, isDesktop, breakpoint } = useResponsive();
 * 
 * if (isMobile) {
 *   return <MobileLayout />;
 * }
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(DEFAULT_STATE);
  const [isHydrated, setIsHydrated] = useState(false);

  const handleResize = useCallback(() => {
    setState(calculateState());
  }, []);

  useEffect(() => {
    // Initial calculation after hydration
    setState(calculateState());
    setIsHydrated(true);

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [handleResize]);

  // Return default state during SSR/hydration to prevent mismatch
  if (!isHydrated) {
    return DEFAULT_STATE;
  }

  return state;
}

/**
 * Hook to check if viewport matches a media query
 * 
 * @example
 * const isWide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Hook to detect if device prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook to detect if device is in dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

export { BREAKPOINTS };
export default useResponsive;
