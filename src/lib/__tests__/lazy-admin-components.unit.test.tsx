/**
 * Unit Tests for Lazy Admin Components
 * 
 * Task 11.2: Implement lazy loading for non-critical components
 * Requirements: 10.7
 * 
 * NOTE: These tests use only Vitest utilities (no @testing-library/react)
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  AdminLoadingFallback, 
  withLazyLoading,
  useAdminPreload,
  preloadAdminComponents 
} from '../lazy-admin-components';

describe('AdminLoadingFallback', () => {
  it('should be a valid React component', () => {
    expect(AdminLoadingFallback).toBeDefined();
    expect(typeof AdminLoadingFallback).toBe('function');
  });

  it('should return JSX element', () => {
    const result = AdminLoadingFallback();
    expect(result).toBeDefined();
    expect(result.type).toBe('div');
  });

  it('should have loading text in props', () => {
    const result = AdminLoadingFallback();
    const textElement = result.props.children.props.children[1];
    expect(textElement.props.children).toBe('Cargando panel...');
  });
});

describe('withLazyLoading', () => {
  it('should return a function', () => {
    const TestComponent = () => <div>Test Content</div>;
    const LazyComponent = withLazyLoading(TestComponent);
    
    expect(typeof LazyComponent).toBe('function');
  });

  it('should accept custom fallback', () => {
    const TestComponent = () => <div>Test Content</div>;
    const customFallback = <div>Custom Loading...</div>;
    const LazyComponent = withLazyLoading(TestComponent, customFallback);
    
    expect(typeof LazyComponent).toBe('function');
  });

  it('should preserve component type', () => {
    interface TestProps {
      title: string;
      count: number;
    }
    
    const TestComponent = ({ title, count }: TestProps) => (
      <div>
        {title}: {count}
      </div>
    );
    
    const LazyComponent = withLazyLoading(TestComponent);
    
    // Should accept same props as original component
    expect(typeof LazyComponent).toBe('function');
  });
});

describe('useAdminPreload', () => {
  it('should return object with preloadOnHover function', () => {
    const result = useAdminPreload();
    
    expect(result).toBeDefined();
    expect(result.preloadOnHover).toBeDefined();
    expect(typeof result.preloadOnHover).toBe('function');
  });

  it('should not throw when calling preloadOnHover', () => {
    const { preloadOnHover } = useAdminPreload();
    
    // Should not throw for valid keys
    expect(() => {
      preloadOnHover('reports');
    }).not.toThrow();
  });

  it('should handle all preload keys without throwing', () => {
    const { preloadOnHover } = useAdminPreload();
    
    const keys: Array<keyof typeof preloadAdminComponents> = [
      'reports',
      'dashboard',
      'auditoria',
      'security',
      'crossTenant',
      'tenantDashboard',
      'tenantProvisioning',
      'delivery',
      'deliveryHistory',
      'notifications',
    ];

    // Should not throw for any key
    keys.forEach(key => {
      expect(() => {
        preloadOnHover(key);
      }).not.toThrow();
    });
  });
});

describe('preloadAdminComponents', () => {
  it('should have preload functions for all admin pages', () => {
    const expectedKeys = [
      'reports',
      'dashboard',
      'auditoria',
      'security',
      'crossTenant',
      'tenantDashboard',
      'tenantProvisioning',
      'delivery',
      'deliveryHistory',
      'notifications',
    ];

    expectedKeys.forEach(key => {
      expect(preloadAdminComponents).toHaveProperty(key);
      expect(typeof preloadAdminComponents[key as keyof typeof preloadAdminComponents]).toBe('function');
    });
  });

  it('should return promises from preload functions', () => {
    const result = preloadAdminComponents.reports();
    
    expect(result).toBeInstanceOf(Promise);
  });
});

describe('Lazy Component Exports', () => {
  it('should export all lazy-loaded page components', async () => {
    const { 
      LazyReportsPage,
      LazyAnalyticsDashboard,
      LazyAuditoriaPage,
      LazySecurityPage,
      LazyCrossTenantDashboard,
      LazyTenantDashboard,
      LazyTenantProvisioning,
      LazyDeliveryPage,
      LazyDeliveryHistory,
      LazyNotificationsPage,
    } = await import('../lazy-admin-components');

    expect(LazyReportsPage).toBeDefined();
    expect(LazyAnalyticsDashboard).toBeDefined();
    expect(LazyAuditoriaPage).toBeDefined();
    expect(LazySecurityPage).toBeDefined();
    expect(LazyCrossTenantDashboard).toBeDefined();
    expect(LazyTenantDashboard).toBeDefined();
    expect(LazyTenantProvisioning).toBeDefined();
    expect(LazyDeliveryPage).toBeDefined();
    expect(LazyDeliveryHistory).toBeDefined();
    expect(LazyNotificationsPage).toBeDefined();
    
    // All should be functions (React components)
    expect(typeof LazyReportsPage).toBe('function');
    expect(typeof LazyAnalyticsDashboard).toBe('function');
  });

  it('should export lazy-loaded component exports', async () => {
    const { 
      LazyDataTable,
      LazySecurityAlertsPanel,
    } = await import('../lazy-admin-components');

    expect(LazyDataTable).toBeDefined();
    expect(LazySecurityAlertsPanel).toBeDefined();
    
    // Both should be functions (React components)
    expect(typeof LazyDataTable).toBe('function');
    expect(typeof LazySecurityAlertsPanel).toBe('function');
  });
});

describe('Loading State Functionality', () => {
  it('should provide accessible loading component', () => {
    const fallback = AdminLoadingFallback();
    expect(fallback).toBeDefined();
  });

  it('should export all required utilities', () => {
    expect(AdminLoadingFallback).toBeDefined();
    expect(withLazyLoading).toBeDefined();
    expect(useAdminPreload).toBeDefined();
    expect(preloadAdminComponents).toBeDefined();
  });
});
