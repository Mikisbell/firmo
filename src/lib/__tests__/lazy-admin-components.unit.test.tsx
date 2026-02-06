/**
 * Unit Tests for Lazy Admin Components
 * 
 * Task 11.2: Implement lazy loading for non-critical components
 * Requirements: 10.7
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { 
  AdminLoadingFallback, 
  withLazyLoading,
  useAdminPreload,
  preloadAdminComponents 
} from '../lazy-admin-components';
import { renderHook } from '@testing-library/react';

describe('AdminLoadingFallback', () => {
  it('should render loading spinner and text', () => {
    render(<AdminLoadingFallback />);
    
    expect(screen.getByText('Cargando panel...')).toBeInTheDocument();
    // Check for spinner by class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should have minimum height for good UX', () => {
    const { container } = render(<AdminLoadingFallback />);
    const wrapper = container.firstChild as HTMLElement;
    
    expect(wrapper).toHaveClass('min-h-[400px]');
  });

  it('should center content', () => {
    const { container } = render(<AdminLoadingFallback />);
    const wrapper = container.firstChild as HTMLElement;
    
    expect(wrapper).toHaveClass('flex', 'items-center', 'justify-center');
  });
});

describe('withLazyLoading', () => {
  it('should wrap component with Suspense boundary', async () => {
    const TestComponent = () => <div>Test Content</div>;
    const LazyComponent = withLazyLoading(TestComponent);
    
    render(<LazyComponent />);
    
    // Component should render
    await waitFor(() => {
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  it('should show fallback while loading', () => {
    const TestComponent = () => <div>Test Content</div>;
    const customFallback = <div>Custom Loading...</div>;
    const LazyComponent = withLazyLoading(TestComponent, customFallback);
    
    render(<LazyComponent />);
    
    // Should show custom fallback initially
    expect(screen.getByText('Custom Loading...')).toBeInTheDocument();
  });

  it('should use default fallback when none provided', () => {
    const TestComponent = () => <div>Test Content</div>;
    const LazyComponent = withLazyLoading(TestComponent);
    
    render(<LazyComponent />);
    
    // Should show default loading text
    expect(screen.getByText('Cargando panel...')).toBeInTheDocument();
  });

  it('should pass props to wrapped component', async () => {
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
    
    render(<LazyComponent title="Items" count={5} />);
    
    await waitFor(() => {
      expect(screen.getByText('Items: 5')).toBeInTheDocument();
    });
  });
});

describe('useAdminPreload', () => {
  it('should return preloadOnHover function', () => {
    const { result } = renderHook(() => useAdminPreload());
    
    expect(result.current.preloadOnHover).toBeDefined();
    expect(typeof result.current.preloadOnHover).toBe('function');
  });

  it('should preload component on desktop', () => {
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    const { result } = renderHook(() => useAdminPreload());
    
    // Should not throw
    expect(() => {
      result.current.preloadOnHover('reports');
    }).not.toThrow();
  });

  it('should not preload on mobile to save bandwidth', () => {
    // Mock window.innerWidth for mobile
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    const importSpy = vi.spyOn(preloadAdminComponents, 'reports');
    
    const { result } = renderHook(() => useAdminPreload());
    result.current.preloadOnHover('reports');
    
    // Should not call import on mobile
    expect(importSpy).not.toHaveBeenCalled();
  });

  it('should handle all preload keys', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    });

    const { result } = renderHook(() => useAdminPreload());
    
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
        result.current.preloadOnHover(key);
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
  });

  it('should export lazy-loaded component exports', async () => {
    const { 
      LazyDataTable,
      LazySecurityAlertsPanel,
    } = await import('../lazy-admin-components');

    expect(LazyDataTable).toBeDefined();
    expect(LazySecurityAlertsPanel).toBeDefined();
  });
});

describe('Loading State UX', () => {
  it('should provide accessible loading state', () => {
    render(<AdminLoadingFallback />);
    
    // Should have text for screen readers
    const loadingText = screen.getByText('Cargando panel...');
    expect(loadingText).toBeInTheDocument();
  });

  it('should use appropriate colors for loading state', () => {
    const { container } = render(<AdminLoadingFallback />);
    
    // Spinner should use amber color (brand color)
    const spinner = container.querySelector('.text-amber-500');
    expect(spinner).toBeInTheDocument();
    
    // Text should use muted color
    const text = container.querySelector('.text-zinc-400');
    expect(text).toBeInTheDocument();
  });
});
