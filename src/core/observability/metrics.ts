/**
 * Metrics Collector for PARK POS
 * 
 * Tracks business and technical metrics for monitoring and analytics.
 * Implements batching and flushing for efficient metric collection.
 * 
 * @module observability/metrics
 */

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
