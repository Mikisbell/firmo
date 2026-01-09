/**
 * PARK POS Metrics Service
 * 
 * Lightweight metrics collection for monitoring sync health,
 * API performance, and business metrics.
 * 
 * Uses a simple in-memory approach that can be exported to
 * Prometheus or other monitoring systems.
 */

export interface MetricValue {
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}

export interface HistogramBucket {
    le: number;  // less than or equal
    count: number;
}

export interface Histogram {
    buckets: HistogramBucket[];
    sum: number;
    count: number;
}

// Metric types
type MetricType = 'counter' | 'gauge' | 'histogram';

interface MetricDefinition {
    name: string;
    type: MetricType;
    description: string;
    unit?: string;
}

// In-memory metrics storage
const counters: Map<string, number> = new Map();
const gauges: Map<string, number> = new Map();
const histograms: Map<string, Histogram> = new Map();
const metricDefinitions: Map<string, MetricDefinition> = new Map();

// Default histogram buckets (in ms for latency)
const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Register a new metric
 */
function registerMetric(def: MetricDefinition): void {
    metricDefinitions.set(def.name, def);
    
    if (def.type === 'counter') {
        counters.set(def.name, 0);
    } else if (def.type === 'gauge') {
        gauges.set(def.name, 0);
    } else if (def.type === 'histogram') {
        histograms.set(def.name, {
            buckets: DEFAULT_BUCKETS.map(le => ({ le, count: 0 })),
            sum: 0,
            count: 0,
        });
    }
}

// ============================================
// Sync Metrics
// ============================================

registerMetric({
    name: 'sync_latency_ms',
    type: 'histogram',
    description: 'Sync batch latency in milliseconds',
    unit: 'ms',
});

registerMetric({
    name: 'sync_backlog',
    type: 'gauge',
    description: 'Number of unsynced events',
});

registerMetric({
    name: 'sync_events_processed_total',
    type: 'counter',
    description: 'Total events successfully synced',
});

registerMetric({
    name: 'sync_errors_total',
    type: 'counter',
    description: 'Total sync errors',
});

registerMetric({
    name: 'sync_batches_total',
    type: 'counter',
    description: 'Total sync batches attempted',
});

// ============================================
// API Metrics
// ============================================

registerMetric({
    name: 'ingest_latency_ms',
    type: 'histogram',
    description: 'Event ingest latency in milliseconds',
    unit: 'ms',
});

registerMetric({
    name: 'ingest_batch_size',
    type: 'histogram',
    description: 'Number of events per ingest batch',
});

registerMetric({
    name: 'ingest_events_total',
    type: 'counter',
    description: 'Total events ingested',
});

registerMetric({
    name: 'projection_errors_total',
    type: 'counter',
    description: 'Total projection errors',
});

// ============================================
// Circuit Breaker Metrics
// ============================================

registerMetric({
    name: 'circuit_breaker_state',
    type: 'gauge',
    description: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
});

registerMetric({
    name: 'circuit_breaker_failures_total',
    type: 'counter',
    description: 'Total circuit breaker failures',
});

// ============================================
// Business Metrics
// ============================================

registerMetric({
    name: 'orders_created_total',
    type: 'counter',
    description: 'Total orders created',
});

registerMetric({
    name: 'orders_completed_total',
    type: 'counter',
    description: 'Total orders completed (invoiced)',
});

registerMetric({
    name: 'order_total_cents',
    type: 'histogram',
    description: 'Order total in cents',
});

// ============================================
// Metric Operations
// ============================================

/**
 * Increment a counter
 */
export function incrementCounter(name: string, value: number = 1): void {
    const current = counters.get(name) ?? 0;
    counters.set(name, current + value);
}

/**
 * Set a gauge value
 */
export function setGauge(name: string, value: number): void {
    gauges.set(name, value);
}

/**
 * Record a histogram observation
 */
export function recordHistogram(name: string, value: number): void {
    const hist = histograms.get(name);
    if (!hist) return;
    
    hist.sum += value;
    hist.count += 1;
    
    for (const bucket of hist.buckets) {
        if (value <= bucket.le) {
            bucket.count += 1;
        }
    }
}

/**
 * Get current value of a counter
 */
export function getCounter(name: string): number {
    return counters.get(name) ?? 0;
}

/**
 * Get current value of a gauge
 */
export function getGauge(name: string): number {
    return gauges.get(name) ?? 0;
}

/**
 * Get histogram data
 */
export function getHistogram(name: string): Histogram | undefined {
    return histograms.get(name);
}

/**
 * Calculate percentile from histogram
 */
export function getPercentile(name: string, percentile: number): number {
    const hist = histograms.get(name);
    if (!hist || hist.count === 0) return 0;
    
    const target = hist.count * (percentile / 100);
    
    for (const bucket of hist.buckets) {
        if (bucket.count >= target) {
            return bucket.le;
        }
    }
    
    return hist.buckets[hist.buckets.length - 1]?.le ?? 0;
}

/**
 * Reset all metrics (for testing)
 */
export function resetMetrics(): void {
    counters.forEach((_, key) => counters.set(key, 0));
    gauges.forEach((_, key) => gauges.set(key, 0));
    histograms.forEach((hist) => {
        hist.sum = 0;
        hist.count = 0;
        hist.buckets.forEach(b => b.count = 0);
    });
}

/**
 * Get all metrics in Prometheus format
 */
export function getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    // Counters
    counters.forEach((value, name) => {
        const def = metricDefinitions.get(name);
        if (def) {
            lines.push(`# HELP ${name} ${def.description}`);
            lines.push(`# TYPE ${name} counter`);
        }
        lines.push(`${name} ${value}`);
    });
    
    // Gauges
    gauges.forEach((value, name) => {
        const def = metricDefinitions.get(name);
        if (def) {
            lines.push(`# HELP ${name} ${def.description}`);
            lines.push(`# TYPE ${name} gauge`);
        }
        lines.push(`${name} ${value}`);
    });
    
    // Histograms
    histograms.forEach((hist, name) => {
        const def = metricDefinitions.get(name);
        if (def) {
            lines.push(`# HELP ${name} ${def.description}`);
            lines.push(`# TYPE ${name} histogram`);
        }
        
        for (const bucket of hist.buckets) {
            lines.push(`${name}_bucket{le="${bucket.le}"} ${bucket.count}`);
        }
        lines.push(`${name}_bucket{le="+Inf"} ${hist.count}`);
        lines.push(`${name}_sum ${hist.sum}`);
        lines.push(`${name}_count ${hist.count}`);
    });
    
    return lines.join('\n');
}

/**
 * Get metrics summary as JSON
 */
export function getMetricsSummary(): Record<string, any> {
    return {
        sync: {
            latency_p50_ms: getPercentile('sync_latency_ms', 50),
            latency_p95_ms: getPercentile('sync_latency_ms', 95),
            latency_p99_ms: getPercentile('sync_latency_ms', 99),
            backlog: getGauge('sync_backlog'),
            events_processed: getCounter('sync_events_processed_total'),
            errors: getCounter('sync_errors_total'),
            batches: getCounter('sync_batches_total'),
        },
        api: {
            ingest_latency_p95_ms: getPercentile('ingest_latency_ms', 95),
            events_ingested: getCounter('ingest_events_total'),
            projection_errors: getCounter('projection_errors_total'),
        },
        circuit_breaker: {
            state: getGauge('circuit_breaker_state'),
            failures: getCounter('circuit_breaker_failures_total'),
        },
        business: {
            orders_created: getCounter('orders_created_total'),
            orders_completed: getCounter('orders_completed_total'),
        },
    };
}

// ============================================
// Convenience Functions
// ============================================

export const syncMetrics = {
    recordLatency: (ms: number) => recordHistogram('sync_latency_ms', ms),
    setBacklog: (count: number) => setGauge('sync_backlog', count),
    incrementEventsProcessed: (count: number = 1) => incrementCounter('sync_events_processed_total', count),
    incrementErrors: () => incrementCounter('sync_errors_total'),
    incrementBatches: () => incrementCounter('sync_batches_total'),
};

export const apiMetrics = {
    recordIngestLatency: (ms: number) => recordHistogram('ingest_latency_ms', ms),
    recordBatchSize: (size: number) => recordHistogram('ingest_batch_size', size),
    incrementEventsIngested: (count: number = 1) => incrementCounter('ingest_events_total', count),
    incrementProjectionErrors: () => incrementCounter('projection_errors_total'),
};

export const circuitBreakerMetrics = {
    setState: (state: 'CLOSED' | 'HALF_OPEN' | 'OPEN') => {
        const stateValue = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
        setGauge('circuit_breaker_state', stateValue);
    },
    incrementFailures: () => incrementCounter('circuit_breaker_failures_total'),
};

export const businessMetrics = {
    incrementOrdersCreated: () => incrementCounter('orders_created_total'),
    incrementOrdersCompleted: () => incrementCounter('orders_completed_total'),
    recordOrderTotal: (cents: number) => recordHistogram('order_total_cents', cents),
};
