/**
 * Unit tests for Web Vitals tracking
 * 
 * Tests that Web Vitals are collected and sent to metrics service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  reportWebVitals, 
  WebVitalsMetric,
  WebVitalsThresholds,
  WebVitalsMetricNames
} from '../web-vitals';

// Mock the metrics module
vi.mock('../../core/observability/metrics', () => ({
  metrics: {
    histogram: vi.fn(),
    gauge: vi.fn(),
  },
}));

// Import after mocking
import { metrics } from '../../core/observability/metrics';

// Mock window object for browser APIs
const mockWindow = {
  sessionStorage: {
    getItem: (key: string) => {
      if (key === 'tenantId') return 'test-tenant-123';
      if (key === 'terminalId') return 'test-terminal-456';
      return null;
    },
  },
  location: {
    pathname: '/test-route',
  },
};

// Set up global window mock
(global as any).window = mockWindow;

describe('Web Vitals Tracking - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reportWebVitals', () => {
    it('should report TTFB metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'ttfb-123',
        name: 'TTFB',
        value: 150,
        rating: 'good',
        delta: 150,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.TTFB,
        150,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
          navigationType: 'navigate',
          tenantId: 'test-tenant-123',
          terminalId: 'test-terminal-456',
        })
      );

      expect(metrics.gauge).toHaveBeenCalledWith(
        `${WebVitalsMetricNames.TTFB}.latest`,
        150,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report FCP metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'fcp-123',
        name: 'FCP',
        value: 1200,
        rating: 'good',
        delta: 1200,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.FCP,
        1200,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report LCP metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'lcp-123',
        name: 'LCP',
        value: 2000,
        rating: 'good',
        delta: 2000,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.LCP,
        2000,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report TTI metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'tti-123',
        name: 'TTI',
        value: 3500,
        rating: 'good',
        delta: 3500,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.TTI,
        3500,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report CLS metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'cls-123',
        name: 'CLS',
        value: 0.05,
        rating: 'good',
        delta: 0.05,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.CLS,
        0.05,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report FID metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'fid-123',
        name: 'FID',
        value: 80,
        rating: 'good',
        delta: 80,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.FID,
        80,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should report INP metric to metrics collector', () => {
      const metric: WebVitalsMetric = {
        id: 'inp-123',
        name: 'INP',
        value: 150,
        rating: 'good',
        delta: 150,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.INP,
        150,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
        })
      );
    });

    it('should handle unknown metric names gracefully', () => {
      const metric: WebVitalsMetric = {
        id: 'unknown-123',
        name: 'UNKNOWN' as any,
        value: 100,
        rating: 'good',
        delta: 100,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      // Should not call metrics collector for unknown metrics
      expect(metrics.histogram).not.toHaveBeenCalled();
      expect(metrics.gauge).not.toHaveBeenCalled();
    });

    it('should handle missing session storage gracefully', () => {
      // Mock sessionStorage to return null
      const originalWindow = (global as any).window;
      (global as any).window = {
        ...mockWindow,
        sessionStorage: {
          getItem: () => null,
        },
        location: {
          pathname: '/test-route',
        },
      };

      const metric: WebVitalsMetric = {
        id: 'ttfb-123',
        name: 'TTFB',
        value: 150,
        rating: 'good',
        delta: 150,
        navigationType: 'navigate',
      };

      reportWebVitals(metric);

      expect(metrics.histogram).toHaveBeenCalledWith(
        WebVitalsMetricNames.TTFB,
        150,
        expect.objectContaining({
          route: '/test-route',
          rating: 'good',
          tenantId: undefined,
          terminalId: undefined,
        })
      );

      // Restore
      (global as any).window = originalWindow;
    });

    it('should not throw errors on metrics collection failure', () => {
      // Mock metrics.histogram to throw error
      vi.mocked(metrics.histogram).mockImplementation(() => {
        throw new Error('Metrics collection failed');
      });

      const metric: WebVitalsMetric = {
        id: 'ttfb-123',
        name: 'TTFB',
        value: 150,
        rating: 'good',
        delta: 150,
        navigationType: 'navigate',
      };

      // Should not throw
      expect(() => reportWebVitals(metric)).not.toThrow();
    });
  });

  describe('Web Vitals Thresholds', () => {
    it('should have correct TTFB thresholds', () => {
      expect(WebVitalsThresholds.TTFB).toEqual({ good: 800, poor: 1800 });
    });

    it('should have correct FCP thresholds', () => {
      expect(WebVitalsThresholds.FCP).toEqual({ good: 1800, poor: 3000 });
    });

    it('should have correct LCP thresholds', () => {
      expect(WebVitalsThresholds.LCP).toEqual({ good: 2500, poor: 4000 });
    });

    it('should have correct TTI thresholds', () => {
      expect(WebVitalsThresholds.TTI).toEqual({ good: 3800, poor: 7300 });
    });

    it('should have correct CLS thresholds', () => {
      expect(WebVitalsThresholds.CLS).toEqual({ good: 0.1, poor: 0.25 });
    });

    it('should have correct FID thresholds', () => {
      expect(WebVitalsThresholds.FID).toEqual({ good: 100, poor: 300 });
    });

    it('should have correct INP thresholds', () => {
      expect(WebVitalsThresholds.INP).toEqual({ good: 200, poor: 500 });
    });
  });
});
