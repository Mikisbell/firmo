/**
 * Metrics Collector for FIRMO POS
 * 
 * Tracks business and technical metrics for monitoring and analytics.
 * Implements batching and flushing for efficient metric collection.
 * 
 * @module observability/metrics
 */

/**
 * Standard metric names used throughout the application
 */
export const MetricNames = {
  // Employee metrics
  EMPLOYEES_CREATED_TOTAL: 'employees_created_total',
  EMPLOYEES_ACTIVE: 'employees_active',
  
  // Order metrics
  ORDERS_CREATED_TOTAL: 'orders_created_total',
  ORDERS_COMPLETED_TOTAL: 'orders_completed_total',
  
  // Sync metrics
  SYNC_EVENTS_PROCESSED_TOTAL: 'sync_events_processed_total',
  SYNC_BACKLOG: 'sync_backlog',
  SYNC_ERRORS_TOTAL: 'sync_errors_total',
  SYNC_BATCHES_TOTAL: 'sync_batches_total',
  SYNC_LATENCY_MS: 'sync_latency_ms',
  
  // API metrics
  INGEST_EVENTS_TOTAL: 'ingest_events_total',
  INGEST_LATENCY_MS: 'ingest_latency_ms',
  INGEST_BATCH_SIZE: 'ingest_batch_size',
  PROJECTION_ERRORS_TOTAL: 'projection_errors_total',
  
  // Cache metrics
  CACHE_HITS_TOTAL: 'cache_hits_total',
  CACHE_MISSES_TOTAL: 'cache_misses_total',
  
  // HTTP metrics
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_ms',
  
  // Error metrics
  API_ERRORS_TOTAL: 'api_errors_total',
  
  // Circuit breaker metrics
  CIRCUIT_BREAKER_STATE: 'circuit_breaker_state',
  CIRCUIT_BREAKER_FAILURES_TOTAL: 'circuit_breaker_failures_total',
} as const;

export interface MetricTags {
  tenantId?: string;
  terminalId?: string;
  eventType?: string;
  endpoint?: string;
  role?: string;
  [key: string]: string | undefined;
}

export interface MetricsCollector {
  increment(metric: string, tags?: MetricTags): void;
  decrement(metric: string, tags?: MetricTags): void;
  gauge(metric: string, value: number, tags?: MetricTags): void;
  histogram(metric: string, value: number, tags?: MetricTags): void;
  timing(metric: string, duration: number, tags?: MetricTags): void;
  flush(): Promise<void>;
}

interface MetricEntry {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timing';
  tags: Record<string, string>;
  timestamp: number;
}

/**
 * Vercel-compatible metrics collector with batching and flushing
 */
export class VercelMetricsCollector implements MetricsCollector {
  private metrics: Map<string, MetricEntry> = new Map();
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly batchSize = 100;
  private readonly flushIntervalMs = 10000; // 10 seconds
  
  constructor() {
    // Start auto-flush in production
    if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
      this.startAutoFlush();
    }
  }
  
  /**
   * Increment a counter metric
   */
  increment(metric: string, tags?: MetricTags): void {
    const key = this.buildKey(metric, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + 1);
    
    this.storeMetric({
      name: metric,
      value: current + 1,
      type: 'counter',
      tags: this.normalizeTags(tags),
      timestamp: Date.now(),
    });
    
    this.checkFlush();
  }
  
  /**
   * Decrement a counter metric
   */
  decrement(metric: string, tags?: MetricTags): void {
    const key = this.buildKey(metric, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current - 1);
    
    this.storeMetric({
      name: metric,
      value: current - 1,
      type: 'counter',
      tags: this.normalizeTags(tags),
      timestamp: Date.now(),
    });
    
    this.checkFlush();
  }
  
  /**
   * Set a gauge metric (overwrites previous value)
   */
  gauge(metric: string, value: number, tags?: MetricTags): void {
    const key = this.buildKey(metric, tags);
    
    this.storeMetric({
      name: metric,
      value,
      type: 'gauge',
      tags: this.normalizeTags(tags),
      timestamp: Date.now(),
    });
    
    this.checkFlush();
  }
  
  /**
   * Set a gauge metric (alias for gauge)
   * @deprecated Use gauge() instead
   */
  set(metric: string, value: number, tags?: MetricTags): void {
    this.gauge(metric, value, tags);
  }
  
  /**
   * Record a histogram value (appends to distribution)
   */
  histogram(metric: string, value: number, tags?: MetricTags): void {
    const key = this.buildKey(metric, tags);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.storeMetric({
      name: metric,
      value,
      type: 'histogram',
      tags: this.normalizeTags(tags),
      timestamp: Date.now(),
    });
    
    this.checkFlush();
  }
  
  /**
   * Record a timing metric (special case of histogram)
   */
  timing(metric: string, duration: number, tags?: MetricTags): void {
    this.histogram(`${metric}.duration`, duration, tags);
  }
  
  /**
   * Flush all pending metrics
   */
  async flush(): Promise<void> {
    if (this.metrics.size === 0) {
      return;
    }
    
    try {
      const metricsToSend = Array.from(this.metrics.values());
      
      // In production, send to Vercel Analytics or custom endpoint
      if (process.env.NODE_ENV === 'production') {
        await this.sendToAnalytics(metricsToSend);
      }
      
      // Clear flushed metrics
      this.metrics.clear();
    } catch (error) {
      // Graceful degradation - log error but don't throw
      console.error('Failed to flush metrics:', error);
    }
  }
  
  /**
   * Build a unique key for metric storage
   */
  private buildKey(metric: string, tags?: MetricTags): string {
    if (!tags) return metric;
    
    const tagString = Object.entries(tags)
      .filter(([_, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
      .map(([key, value]) => `${key}:${value}`)
      .join(',');
    
    return tagString ? `${metric}{${tagString}}` : metric;
  }
  
  /**
   * Normalize tags to remove undefined values
   */
  private normalizeTags(tags?: MetricTags): Record<string, string> {
    if (!tags) return {};
    
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (value !== undefined) {
        normalized[key] = value;
      }
    }
    return normalized;
  }
  
  /**
   * Store a metric entry
   */
  private storeMetric(entry: MetricEntry): void {
    const key = this.buildKey(entry.name, entry.tags);
    
    // For counters and gauges, overwrite previous value
    // For histograms, we keep all values in the histograms map
    if (entry.type === 'counter' || entry.type === 'gauge') {
      this.metrics.set(key, entry);
    } else {
      // For histograms, store each value separately with timestamp
      const timestampedKey = `${key}:${entry.timestamp}`;
      this.metrics.set(timestampedKey, entry);
    }
  }
  
  /**
   * Check if we should flush based on batch size
   */
  private checkFlush(): void {
    if (this.metrics.size >= this.batchSize) {
      void this.flush();
    }
  }
  
  /**
   * Start automatic flushing
   */
  private startAutoFlush(): void {
    if (this.flushInterval) {
      return;
    }
    
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    
    // Ensure cleanup on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        if (this.flushInterval) {
          clearInterval(this.flushInterval);
          this.flushInterval = null;
        }
        void this.flush();
      });
    }
  }
  
  /**
   * Send metrics to analytics service
   */
  private async sendToAnalytics(metrics: MetricEntry[]): Promise<void> {
    // In production, this would send to Vercel Analytics or custom endpoint
    // For now, we'll just log to console in a structured format
    
    if (process.env.VERCEL_ANALYTICS_ENDPOINT) {
      try {
        const response = await fetch(process.env.VERCEL_ANALYTICS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.VERCEL_ANALYTICS_TOKEN || ''}`,
          },
          body: JSON.stringify({ metrics }),
        });
        
        if (!response.ok) {
          throw new Error(`Analytics API returned ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to send metrics to analytics:', error);
        // Graceful degradation - continue without throwing
      }
    }
  }
  
  /**
   * Get current metric values (for testing and debugging)
   */
  getMetrics(): Map<string, MetricEntry> {
    return new Map(this.metrics);
  }
  
  /**
   * Get counter values (for testing and debugging)
   */
  getCounters(): Map<string, number> {
    return new Map(this.counters);
  }
  
  /**
   * Get histogram values (for testing and debugging)
   */
  getHistograms(): Map<string, number[]> {
    return new Map(this.histograms);
  }
  
  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.metrics.clear();
    this.counters.clear();
    this.histograms.clear();
  }
}

// Singleton instance
export const metrics = new VercelMetricsCollector();

/**
 * Legacy API compatibility layer
 * These functions provide backward compatibility with the old metrics API
 */

/**
 * Reset all metrics (alias for clear)
 * @deprecated Use metrics.clear() instead
 */
export function resetMetrics(): void {
  metrics.clear();
}

/**
 * Increment a counter
 * @deprecated Use metrics.increment() instead
 */
export function incrementCounter(name: string, value: number = 1, tags?: MetricTags): void {
  for (let i = 0; i < value; i++) {
    metrics.increment(name, tags);
  }
}

/**
 * Set a gauge value
 * @deprecated Use metrics.gauge() instead
 */
export function setGauge(name: string, value: number, tags?: MetricTags): void {
  metrics.gauge(name, value, tags);
}

/**
 * Record a histogram observation
 * @deprecated Use metrics.histogram() instead
 */
export function recordHistogram(name: string, value: number, tags?: MetricTags): void {
  metrics.histogram(name, value, tags);
}

/**
 * Get counter value
 * @deprecated Use metrics.getCounters() instead
 */
export function getCounter(name: string): number {
  const counters = metrics.getCounters();
  for (const [key, value] of counters.entries()) {
    if (key.startsWith(name)) {
      return value;
    }
  }
  return 0;
}

/**
 * Get gauge value
 * @deprecated Use metrics.getMetrics() instead
 */
export function getGauge(name: string): number {
  const metricsMap = metrics.getMetrics();
  for (const [key, entry] of metricsMap.entries()) {
    if (key.startsWith(name) && entry.type === 'gauge') {
      return entry.value;
    }
  }
  return 0;
}

/**
 * Get histogram statistics
 * @deprecated Use metrics.getHistograms() instead
 */
export function getHistogram(name: string): { count: number; sum: number; buckets: Array<{ le: number; count: number }> } | null {
  const histograms = metrics.getHistograms();
  const values: number[] = [];
  
  for (const [key, vals] of histograms.entries()) {
    if (key.startsWith(name)) {
      values.push(...vals);
    }
  }
  
  if (values.length === 0) {
    return { count: 0, sum: 0, buckets: [] };
  }
  
  const sum = values.reduce((a, b) => a + b, 0);
  const buckets = [50, 100, 250, 500, 1000, 2500, 5000, 10000].map(le => ({
    le,
    count: values.filter(v => v <= le).length,
  }));
  
  return {
    count: values.length,
    sum,
    buckets,
  };
}

/**
 * Get percentile from histogram
 * @deprecated Use metrics.getHistograms() instead
 */
export function getPercentile(name: string, percentile: number): number {
  const hist = getHistogram(name);
  if (!hist || hist.count === 0) return 0;
  
  const targetCount = Math.ceil((percentile / 100) * hist.count);
  const bucket = hist.buckets.find(b => b.count >= targetCount);
  return bucket?.le || 0;
}

/**
 * Get Prometheus-formatted metrics
 * @deprecated Use metrics API endpoint instead
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = [];
  const metricsMap = metrics.getMetrics();
  const counters = metrics.getCounters();
  const histograms = metrics.getHistograms();
  
  // Always include help/type comments for known metrics
  const knownMetrics = [
    { name: 'sync_backlog', type: 'gauge', help: 'Number of events in sync backlog' },
    { name: 'sync_events_processed_total', type: 'counter', help: 'Total events processed' },
    { name: 'sync_latency_ms', type: 'histogram', help: 'Sync latency in milliseconds' },
  ];
  
  for (const metric of knownMetrics) {
    lines.push(`# HELP ${metric.name} ${metric.help}`);
    lines.push(`# TYPE ${metric.name} ${metric.type}`);
  }
  
  // Add counters
  for (const [key, value] of counters.entries()) {
    const name = key.split('{')[0];
    if (!knownMetrics.find(m => m.name === name)) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
    }
    lines.push(`${key} ${value}`);
  }
  
  // Add gauges
  for (const [key, entry] of metricsMap.entries()) {
    if (entry.type === 'gauge') {
      const name = key.split('{')[0];
      if (!knownMetrics.find(m => m.name === name)) {
        lines.push(`# HELP ${name} Gauge metric`);
        lines.push(`# TYPE ${name} gauge`);
      }
      lines.push(`${key} ${entry.value}`);
    }
  }
  
  // Add histograms
  for (const [key, values] of histograms.entries()) {
    const name = key.split('{')[0];
    const sum = values.reduce((a, b) => a + b, 0);
    if (!knownMetrics.find(m => m.name === name)) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
    }
    lines.push(`${name}_count ${values.length}`);
    lines.push(`${name}_sum ${sum}`);
  }
  
  return lines.join('\n');
}

/**
 * Get JSON summary of metrics
 * @deprecated Use metrics API endpoint instead
 */
export function getMetricsSummary(): any {
  return {
    sync: {
      events_processed: getCounter('sync_events_processed_total'),
      backlog: getGauge('sync_backlog'),
      errors: getCounter('sync_errors_total'),
      batches: getCounter('sync_batches_total'),
    },
    api: {
      events_ingested: getCounter('ingest_events_total'),
      projection_errors: getCounter('projection_errors_total'),
    },
    business: {
      orders_created: getCounter('orders_created_total'),
      orders_completed: getCounter('orders_completed_total'),
    },
  };
}

/**
 * Convenience functions for sync metrics
 */
export const syncMetrics = {
  recordLatency: (ms: number) => recordHistogram('sync_latency_ms', ms),
  setBacklog: (count: number) => setGauge('sync_backlog', count),
  incrementEventsProcessed: (count: number = 1) => incrementCounter('sync_events_processed_total', count),
  incrementErrors: () => incrementCounter('sync_errors_total', 1),
  incrementBatches: () => incrementCounter('sync_batches_total', 1),
};

/**
 * Convenience functions for API metrics
 */
export const apiMetrics = {
  recordIngestLatency: (ms: number) => recordHistogram('ingest_latency_ms', ms),
  recordBatchSize: (size: number) => recordHistogram('ingest_batch_size', size),
  incrementEventsIngested: (count: number = 1) => incrementCounter('ingest_events_total', count),
  incrementProjectionErrors: () => incrementCounter('projection_errors_total', 1),
};

/**
 * Convenience functions for circuit breaker metrics
 */
export const circuitBreakerMetrics = {
  setState: (state: 'CLOSED' | 'HALF_OPEN' | 'OPEN') => {
    const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    setGauge('circuit_breaker_state', stateValue);
  },
  incrementFailures: () => incrementCounter('circuit_breaker_failures_total', 1),
};

/**
 * Convenience functions for business metrics
 */
export const businessMetrics = {
  incrementOrdersCreated: () => incrementCounter('orders_created_total', 1),
  incrementOrdersCompleted: () => incrementCounter('orders_completed_total', 1),
  recordOrderTotal: (cents: number) => recordHistogram('order_total_cents', cents),
};

/**
 * Helper functions for common metric operations
 * Used by middleware and services
 */
export const metricsHelpers = {
  // Cache metrics
  recordCacheHit: (key: string) => {
    metrics.increment(MetricNames.CACHE_HITS_TOTAL, { key });
  },
  recordCacheMiss: (key: string) => {
    metrics.increment(MetricNames.CACHE_MISSES_TOTAL, { key });
  },
  
  // Rate limiting metrics
  recordRateLimitAllowed: (tenantId: string) => {
    metrics.increment('rate_limit.allowed', { tenant_id: tenantId });
  },
  recordRateLimitRejection: (tenantId: string, limitType: 'normal' | 'burst') => {
    metrics.increment('rate_limit.rejected', { tenant_id: tenantId, limit_type: limitType });
  },
  
  // HTTP metrics
  recordHttpRequest: (method: string, pathname: string, status: number, durationMs: number) => {
    metrics.increment(MetricNames.HTTP_REQUESTS_TOTAL, { method, pathname, status: String(status) });
    metrics.histogram(MetricNames.HTTP_REQUEST_DURATION_MS, durationMs, { method, pathname });
  },
  
  // Error metrics
  recordApiError: (pathname: string, errorType: string) => {
    metrics.increment(MetricNames.API_ERRORS_TOTAL, { pathname, errorType });
  },
  
  // Saga metrics
  recordSagaStarted: (sagaType: string, tenantId: string) => {
    metrics.increment('saga.started', { saga_type: sagaType, tenant_id: tenantId });
  },
  
  recordSagaCompleted: (sagaType: string, tenantId: string, durationMs: number) => {
    metrics.increment('saga.completed', { saga_type: sagaType, tenant_id: tenantId });
    metrics.histogram('saga.duration', durationMs, { saga_type: sagaType, tenant_id: tenantId, status: 'completed' });
  },
  
  recordSagaFailed: (sagaType: string, tenantId: string, durationMs: number, errorType: string) => {
    metrics.increment('saga.failed', { saga_type: sagaType, tenant_id: tenantId, error_type: errorType });
    metrics.histogram('saga.duration', durationMs, { saga_type: sagaType, tenant_id: tenantId, status: 'failed' });
  },
  
  recordSagaCompensated: (sagaType: string, tenantId: string, durationMs: number, compensationDurationMs: number) => {
    metrics.increment('saga.compensated', { saga_type: sagaType, tenant_id: tenantId });
    metrics.histogram('saga.duration', durationMs, { saga_type: sagaType, tenant_id: tenantId, status: 'compensated' });
    metrics.histogram('saga.compensation_duration', compensationDurationMs, { saga_type: sagaType, tenant_id: tenantId });
  },
  
  recordSagaStepDuration: (sagaType: string, stepName: string, tenantId: string, durationMs: number, status: 'completed' | 'failed') => {
    metrics.histogram('saga.step.duration', durationMs, { 
      saga_type: sagaType, 
      step_name: stepName, 
      tenant_id: tenantId,
      status 
    });
  },
  
  recordSagaStepRetry: (sagaType: string, stepName: string, tenantId: string, errorType: string) => {
    metrics.increment('saga.step.retry', { 
      saga_type: sagaType, 
      step_name: stepName, 
      tenant_id: tenantId,
      error_type: errorType 
    });
  },
  
  recordSagaRecoveryAttempt: (sagaType: string, tenantId: string, success: boolean) => {
    metrics.increment('saga.recovery.attempt', { 
      saga_type: sagaType, 
      tenant_id: tenantId,
      success: String(success)
    });
  },
};
