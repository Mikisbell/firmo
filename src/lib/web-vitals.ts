/**
 * Web Vitals Tracking for PARK POS
 * 
 * Tracks Core Web Vitals metrics and sends them to the metrics collector.
 * Implements Next.js best practices for Web Vitals tracking.
 * 
 * Core Web Vitals:
 * - TTFB (Time to First Byte): Server response time
 * - FCP (First Contentful Paint): Time until first content renders
 * - LCP (Largest Contentful Paint): Time until largest content element renders
 * - TTI (Time to Interactive): Time until page becomes fully interactive
 * - CLS (Cumulative Layout Shift): Visual stability metric
 * - FID (First Input Delay): Interactivity metric
 * - INP (Interaction to Next Paint): Responsiveness metric
 * 
 * @module lib/web-vitals
 */

import { metrics } from '../core/observability/metrics';

/**
 * Web Vitals metric names
 */
export const WebVitalsMetricNames = {
  TTFB: 'web_vitals.ttfb',
  FCP: 'web_vitals.fcp',
  LCP: 'web_vitals.lcp',
  TTI: 'web_vitals.tti',
  CLS: 'web_vitals.cls',
  FID: 'web_vitals.fid',
  INP: 'web_vitals.inp',
} as const;

/**
 * Web Vitals metric interface
 */
export interface WebVitalsMetric {
  id: string;
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  navigationType: string;
}

/**
 * Web Vitals thresholds (in milliseconds, except CLS which is unitless)
 * Based on Google's Core Web Vitals recommendations
 */
export const WebVitalsThresholds = {
  TTFB: { good: 800, poor: 1800 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTI: { good: 3800, poor: 7300 },
  CLS: { good: 0.1, poor: 0.25 },
  FID: { good: 100, poor: 300 },
  INP: { good: 200, poor: 500 },
} as const;

/**
 * Calculate rating based on value and thresholds
 */
function getRating(
  value: number,
  thresholds: { good: number; poor: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report Web Vitals metric to metrics collector
 */
export function reportWebVitals(metric: WebVitalsMetric): void {
  try {
    const { name, value, id, rating, navigationType } = metric;
    
    // Determine metric name
    let metricName: string;
    switch (name) {
      case 'TTFB':
        metricName = WebVitalsMetricNames.TTFB;
        break;
      case 'FCP':
        metricName = WebVitalsMetricNames.FCP;
        break;
      case 'LCP':
        metricName = WebVitalsMetricNames.LCP;
        break;
      case 'TTI':
        metricName = WebVitalsMetricNames.TTI;
        break;
      case 'CLS':
        metricName = WebVitalsMetricNames.CLS;
        break;
      case 'FID':
        metricName = WebVitalsMetricNames.FID;
        break;
      case 'INP':
        metricName = WebVitalsMetricNames.INP;
        break;
      default:
        // Unknown metric, skip
        return;
    }
    
    // Get current route from window location
    const route = typeof window !== 'undefined' ? window.location.pathname : 'unknown';
    
    // Get tenant and terminal IDs from session storage if available
    const tenantId = typeof window !== 'undefined' 
      ? window.sessionStorage?.getItem('tenantId') || undefined
      : undefined;
    const terminalId = typeof window !== 'undefined'
      ? window.sessionStorage?.getItem('terminalId') || undefined
      : undefined;
    
    // Record metric as histogram (for percentile calculations)
    metrics.histogram(metricName, value, {
      route,
      rating,
      navigationType,
      tenantId,
      terminalId,
    });
    
    // Also record as gauge for latest value
    metrics.gauge(`${metricName}.latest`, value, {
      route,
      rating,
      navigationType,
      tenantId,
      terminalId,
    });
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Web Vitals] ${name}:`, {
        value: Math.round(value),
        rating,
        route,
        id,
      });
    }
  } catch (error) {
    // Graceful degradation - don't throw errors from metrics collection
    console.error('Failed to report Web Vitals:', error);
  }
}

/**
 * Polyfill for Web Vitals using PerformanceObserver
 * This is a lightweight implementation that doesn't require the web-vitals library
 */
export function initWebVitals(): void {
  if (typeof window === 'undefined') {
    return; // Server-side, skip
  }
  
  try {
    // TTFB - Time to First Byte
    if ('PerformanceNavigationTiming' in window) {
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
        const rating = getRating(ttfb, WebVitalsThresholds.TTFB);
        reportWebVitals({
          id: 'ttfb-' + Date.now(),
          name: 'TTFB',
          value: ttfb,
          rating,
          delta: ttfb,
          navigationType: navigationEntry.type,
        });
      }
    }
    
    // FCP - First Contentful Paint
    if ('PerformanceObserver' in window) {
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              const fcp = entry.startTime;
              const rating = getRating(fcp, WebVitalsThresholds.FCP);
              reportWebVitals({
                id: 'fcp-' + Date.now(),
                name: 'FCP',
                value: fcp,
                rating,
                delta: fcp,
                navigationType: 'navigate',
              });
              fcpObserver.disconnect();
            }
          }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });
      } catch (e) {
        // PerformanceObserver not supported for paint timing
      }
      
      // LCP - Largest Contentful Paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          if (lastEntry) {
            const lcp = lastEntry.startTime;
            const rating = getRating(lcp, WebVitalsThresholds.LCP);
            reportWebVitals({
              id: 'lcp-' + Date.now(),
              name: 'LCP',
              value: lcp,
              rating,
              delta: lcp,
              navigationType: 'navigate',
            });
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {
        // PerformanceObserver not supported for LCP
      }
      
      // CLS - Cumulative Layout Shift
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value;
            }
          }
          const rating = getRating(clsValue, WebVitalsThresholds.CLS);
          reportWebVitals({
            id: 'cls-' + Date.now(),
            name: 'CLS',
            value: clsValue,
            rating,
            delta: clsValue,
            navigationType: 'navigate',
          });
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
      } catch (e) {
        // PerformanceObserver not supported for layout-shift
      }
      
      // FID - First Input Delay
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const fid = (entry as any).processingStart - entry.startTime;
            const rating = getRating(fid, WebVitalsThresholds.FID);
            reportWebVitals({
              id: 'fid-' + Date.now(),
              name: 'FID',
              value: fid,
              rating,
              delta: fid,
              navigationType: 'navigate',
            });
            fidObserver.disconnect();
          }
        });
        fidObserver.observe({ type: 'first-input', buffered: true });
      } catch (e) {
        // PerformanceObserver not supported for first-input
      }
      
      // INP - Interaction to Next Paint (newer metric)
      // Note: INP is still experimental and may not be supported in all browsers
      try {
        const inpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const inp = (entry as any).duration;
            const rating = getRating(inp, WebVitalsThresholds.INP);
            reportWebVitals({
              id: 'inp-' + Date.now(),
              name: 'INP',
              value: inp,
              rating,
              delta: inp,
              navigationType: 'navigate',
            });
          }
        });
        // INP uses event timing API which may not be fully supported
        inpObserver.observe({ type: 'event', buffered: true } as any);
      } catch (e) {
        // PerformanceObserver not supported for event timing
      }
    }
    
    // TTI - Time to Interactive (approximation using load event)
    if ('addEventListener' in window) {
      window.addEventListener('load', () => {
        // Use load time as approximation for TTI
        const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigationEntry) {
          const tti = navigationEntry.loadEventEnd - navigationEntry.fetchStart;
          const rating = getRating(tti, WebVitalsThresholds.TTI);
          reportWebVitals({
            id: 'tti-' + Date.now(),
            name: 'TTI',
            value: tti,
            rating,
            delta: tti,
            navigationType: navigationEntry.type,
          });
        }
      });
    }
  } catch (error) {
    // Graceful degradation - don't throw errors from Web Vitals initialization
    console.error('Failed to initialize Web Vitals:', error);
  }
}

/**
 * Helper function to get Web Vitals summary
 * Useful for debugging and monitoring dashboards
 */
export function getWebVitalsSummary(): Record<string, any> {
  if (typeof window === 'undefined') {
    return {};
  }
  
  const summary: Record<string, any> = {};
  
  try {
    // Get navigation timing
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      summary.ttfb = Math.round(navigationEntry.responseStart - navigationEntry.requestStart);
      summary.domContentLoaded = Math.round(navigationEntry.domContentLoadedEventEnd - navigationEntry.fetchStart);
      summary.loadComplete = Math.round(navigationEntry.loadEventEnd - navigationEntry.fetchStart);
    }
    
    // Get paint timing
    const paintEntries = performance.getEntriesByType('paint');
    for (const entry of paintEntries) {
      if (entry.name === 'first-contentful-paint') {
        summary.fcp = Math.round(entry.startTime);
      }
    }
    
    // Get resource timing summary
    const resourceEntries = performance.getEntriesByType('resource');
    summary.resourceCount = resourceEntries.length;
    summary.totalResourceSize = resourceEntries.reduce((sum, entry: any) => sum + (entry.transferSize || 0), 0);
  } catch (error) {
    console.error('Failed to get Web Vitals summary:', error);
  }
  
  return summary;
}

/**
 * Export for Next.js App Router
 * Use this in app/layout.tsx or app/page.tsx
 */
export { reportWebVitals as default };
