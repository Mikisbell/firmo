/**
 * Lazy-Loaded Admin Components
 * 
 * This module provides lazy-loaded versions of heavy admin panel components
 * to improve initial bundle size and page load performance.
 * 
 * Task 11.2: Implement lazy loading for non-critical components
 * Requirements: 10.7
 * 
 * @module lazy-admin-components
 */

import React, { lazy, Suspense, ComponentType } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading fallback component for lazy-loaded admin panels
 */
export function AdminLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
        <p className="text-sm text-zinc-400">Cargando panel...</p>
      </div>
    </div>
  );
}

/**
 * Wrapper component that adds Suspense boundary to lazy-loaded components
 */
export function withLazyLoading<P extends object>(
  Component: ComponentType<P>,
  fallback: React.ReactNode = <AdminLoadingFallback />
) {
  return function LazyComponent(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    );
  };
}

/**
 * Lazy-loaded admin panel pages
 * These are heavy components that should only be loaded when accessed
 */

// Reports page - includes charts and data visualization
export const LazyReportsPage = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/reportes/page'))
);

// Analytics dashboard - includes real-time metrics and charts
export const LazyAnalyticsDashboard = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/dashboard/page'))
);

// Audit page - includes large data tables
export const LazyAuditoriaPage = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/auditoria/page'))
);

// Security page - includes security monitoring components
export const LazySecurityPage = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/security/page'))
);

// Cross-tenant dashboard - includes multi-tenant analytics
export const LazyCrossTenantDashboard = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/cross-tenant/dashboard/page'))
);

// Tenant dashboard - includes tenant-specific analytics
export const LazyTenantDashboard = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/tenant/dashboard/page'))
);

// Tenant provisioning - includes provisioning forms
export const LazyTenantProvisioning = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/tenant/provisioning/page'))
);

// Delivery management - includes delivery tracking
export const LazyDeliveryPage = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/delivery/page'))
);

// Delivery history - includes historical data
export const LazyDeliveryHistory = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/delivery/historial/page'))
);

// Notifications page - includes notification management
export const LazyNotificationsPage = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/notificaciones/page'))
);

/**
 * Lazy-loaded admin components (not full pages)
 * These are heavy components used within pages
 */

// Data table component - used in multiple pages
export const LazyDataTable = withLazyLoading(
  React.lazy(() => import('@/src/app/admin/components/DataTable').then(mod => ({ default: mod.DataTable })))
);

// Security alerts panel - used in audit and security pages
export const LazySecurityAlertsPanel = withLazyLoading(
  React.lazy(() => import('@/src/components/admin/SecurityAlertsPanel'))
);

/**
 * Preload functions for critical admin components
 * Call these when user hovers over navigation links
 */
export const preloadAdminComponents = {
  reports: () => import('@/src/app/admin/reportes/page'),
  dashboard: () => import('@/src/app/admin/dashboard/page'),
  auditoria: () => import('@/src/app/admin/auditoria/page'),
  security: () => import('@/src/app/admin/security/page'),
  crossTenant: () => import('@/src/app/admin/cross-tenant/dashboard/page'),
  tenantDashboard: () => import('@/src/app/admin/tenant/dashboard/page'),
  tenantProvisioning: () => import('@/src/app/admin/tenant/provisioning/page'),
  delivery: () => import('@/src/app/admin/delivery/page'),
  deliveryHistory: () => import('@/src/app/admin/delivery/historial/page'),
  notifications: () => import('@/src/app/admin/notificaciones/page'),
};

/**
 * Hook to preload admin components on navigation hover
 * 
 * @example
 * ```tsx
 * const { preloadOnHover } = useAdminPreload();
 * 
 * <Link 
 *   href="/admin/reportes" 
 *   onMouseEnter={() => preloadOnHover('reports')}
 * >
 *   Reportes
 * </Link>
 * ```
 */
export function useAdminPreload() {
  const preloadOnHover = (component: keyof typeof preloadAdminComponents) => {
    // Only preload on desktop (not on mobile to save bandwidth)
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      preloadAdminComponents[component]();
    }
  };

  return { preloadOnHover };
}
