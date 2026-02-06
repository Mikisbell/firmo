/**
 * Dynamic Import Utilities for Code Splitting
 * 
 * This module provides utilities for lazy loading components to improve
 * initial bundle size and page load performance.
 * 
 * @module dynamic-imports
 */

import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

/**
 * Options for dynamic imports
 */
interface DynamicImportOptions {
  /** Whether to enable server-side rendering for this component */
  ssr?: boolean;
  /** Custom loading component */
  loading?: ComponentType;
}

/**
 * Creates a dynamically imported component with default loading state
 * 
 * @param importFn - Function that returns a dynamic import promise
 * @param options - Configuration options for the dynamic import
 * @returns Dynamically imported component
 * 
 * @example
 * ```tsx
 * const AdminDashboard = createDynamicComponent(
 *   () => import('./AdminDashboard'),
 *   { ssr: false }
 * );
 * ```
 */
export function createDynamicComponent<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: DynamicImportOptions = {}
) {
  const dynamicOptions: any = {
    ssr: options.ssr ?? true,
  };
  
  if (options.loading) {
    dynamicOptions.loading = options.loading;
  }
  
  return dynamic(importFn, dynamicOptions);
}

/**
 * Creates a dynamically imported component without SSR
 * Useful for components that rely on browser APIs
 * 
 * @param importFn - Function that returns a dynamic import promise
 * @returns Dynamically imported component without SSR
 * 
 * @example
 * ```tsx
 * const ChartComponent = createClientOnlyComponent(
 *   () => import('./ChartComponent')
 * );
 * ```
 */
export function createClientOnlyComponent<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>
) {
  return createDynamicComponent(importFn, { ssr: false });
}

/**
 * Pre-defined dynamic imports for documentation components
 * These are loaded on-demand when users access documentation
 */
export const DynamicDocComponents = {
  /** Swagger UI for API documentation */
  SwaggerUI: createClientOnlyComponent(
    () => import('swagger-ui-react')
  ),
};

/**
 * Helper function to create dynamic page imports
 * Use this to lazy load heavy page components
 * 
 * @example
 * ```tsx
 * const DynamicAdminDashboard = createDynamicPage(
 *   () => import('@/app/admin/dashboard/page')
 * );
 * ```
 */
export function createDynamicPage<P = {}>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  ssr = false
) {
  return createDynamicComponent(importFn, { ssr });
}
