/**
 * Performance Metrics Service
 * Prometheus-compatible metrics for monitoring
 * 
 * Features:
 * - Counter metrics
 * - Histogram metrics
 * - Gauge metrics
 * - Labels support
 * - Prometheus export format
 */

import { pinoLogger } from './logger-pino';

/**
 * Metric types
 */
type MetricType = 'counter' | 'histogram' | 'gauge';

/**
 * Metric value with labels
 */
interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

/**
 * Metric definition
 */
interface Metric {
  name: string;
  type: MetricType;
  help: string;
  values: Map<string, MetricValue>;
}

/**
 * Metrics Registry
 */
class MetricsRegistry {
  private metrics: Map<string, Metric> = new Map();

  /**
   * Register a new metric
   */
  private register(name: string, type: MetricType, help: string): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        help,
        values: new Map(),
      });
    }
  }

  /**
   * Generate label key from labels object
   */
  private getLabelKey(labels: Record<string, string>): string {
    const sortedKeys = Object.keys(labels).sort();
    return sortedKeys.map((key) => `${key}="${labels[key]}"`).join(',');
  }

  /**
   * Increment a counter
   */
  increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    this.register(name, 'counter', `Counter metric: ${name}`);
    
    const metric = this.metrics.get(name)!;
    const labelKey = this.getLabelKey(labels);
    
    const existing = metric.values.get(labelKey);
    if (existing) {
      existing.value += value;
      existing.timestamp = Date.now();
    } else {
      metric.values.set(labelKey, {
        value,
        labels,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Record a histogram value (for timing)
   */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    this.register(name, 'histogram', `Histogram metric: ${name}`);
    
    const metric = this.metrics.get(name)!;
    const labelKey = this.getLabelKey(labels);
    
    // For simplicity, we store the latest value
    // In production, you'd want to use a proper histogram implementation
    metric.values.set(labelKey, {
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Set a gauge value
   */
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    this.register(name, 'gauge', `Gauge metric: ${name}`);
    
    const metric = this.metrics.get(name)!;
    const labelKey = this.getLabelKey(labels);
    
    metric.values.set(labelKey, {
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Start a timer and return a function to end it
   */
  startTimer(name: string, labels: Record<string, string> = {}): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.observe(name, duration, labels);
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getMetrics(): string {
    const lines: string[] = [];
    
    for (const metric of this.metrics.values()) {
      // Add HELP line
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      
      // Add TYPE line
      lines.push(`# TYPE ${metric.name} ${metric.type}`);
      
      // Add metric values
      for (const [labelKey, metricValue] of metric.values.entries()) {
        const labelsStr = labelKey ? `{${labelKey}}` : '';
        lines.push(`${metric.name}${labelsStr} ${metricValue.value}`);
      }
      
      lines.push(''); // Empty line between metrics
    }
    
    return lines.join('\n');
  }

  /**
   * Get metrics as JSON
   */
  getMetricsJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const metric of this.metrics.values()) {
      result[metric.name] = {
        type: metric.type,
        help: metric.help,
        values: Array.from(metric.values.values()),
      };
    }
    
    return result;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }

  /**
   * Get metric count
   */
  getMetricCount(): number {
    return this.metrics.size;
  }
}

/**
 * Global metrics instance
 */
export const metrics = new MetricsRegistry();

/**
 * Pre-defined metric names
 */
export const MetricNames = {
  // HTTP metrics
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_REQUEST_DURATION_MS: 'http_request_duration_milliseconds',
  HTTP_RESPONSE_SIZE_BYTES: 'http_response_size_bytes',
  
  // Database metrics
  DB_QUERY_DURATION_MS: 'db_query_duration_milliseconds',
  DB_QUERIES_TOTAL: 'db_queries_total',
  DB_CONNECTIONS_ACTIVE: 'db_connections_active',
  
  // Cache metrics
  CACHE_HITS_TOTAL: 'cache_hits_total',
  CACHE_MISSES_TOTAL: 'cache_misses_total',
  CACHE_SIZE_BYTES: 'cache_size_bytes',
  
  // Business metrics
  EMPLOYEES_CREATED_TOTAL: 'employees_created_total',
  EMPLOYEES_ACTIVE: 'employees_active',
  API_ERRORS_TOTAL: 'api_errors_total',
  
  // Saga metrics
  SAGA_STARTED_TOTAL: 'saga_started_total',
  SAGA_COMPLETED_TOTAL: 'saga_completed_total',
  SAGA_FAILED_TOTAL: 'saga_failed_total',
  SAGA_COMPENSATED_TOTAL: 'saga_compensated_total',
  SAGA_DURATION_MS: 'saga_duration_milliseconds',
  SAGA_STEP_DURATION_MS: 'saga_step_duration_milliseconds',
  SAGA_STEP_RETRIES_TOTAL: 'saga_step_retries_total',
  SAGA_COMPENSATION_DURATION_MS: 'saga_compensation_duration_milliseconds',
  SAGA_RECOVERY_ATTEMPTS_TOTAL: 'saga_recovery_attempts_total',
};

/**
 * Helper functions for common metrics
 */
export const metricsHelpers = {
  /**
   * Record HTTP request
   */
  recordHttpRequest(method: string, path: string, status: number, durationMs: number): void {
    metrics.increment(MetricNames.HTTP_REQUESTS_TOTAL, {
      method,
      path,
      status: status.toString(),
    });
    
    metrics.observe(MetricNames.HTTP_REQUEST_DURATION_MS, durationMs, {
      method,
      path,
      status: status.toString(),
    });
  },

  /**
   * Record database query
   */
  recordDbQuery(operation: string, table: string, durationMs: number): void {
    metrics.increment(MetricNames.DB_QUERIES_TOTAL, {
      operation,
      table,
    });
    
    metrics.observe(MetricNames.DB_QUERY_DURATION_MS, durationMs, {
      operation,
      table,
    });
  },

  /**
   * Record cache hit
   */
  recordCacheHit(key: string): void {
    metrics.increment(MetricNames.CACHE_HITS_TOTAL, { key });
  },

  /**
   * Record cache miss
   */
  recordCacheMiss(key: string): void {
    metrics.increment(MetricNames.CACHE_MISSES_TOTAL, { key });
  },

  /**
   * Record API error
   */
  recordApiError(endpoint: string, errorType: string): void {
    metrics.increment(MetricNames.API_ERRORS_TOTAL, {
      endpoint,
      error_type: errorType,
    });
  },

  /**
   * Record saga started
   */
  recordSagaStarted(sagaType: string, tenantId: string): void {
    metrics.increment(MetricNames.SAGA_STARTED_TOTAL, {
      saga_type: sagaType,
      tenant_id: tenantId,
    });
  },

  /**
   * Record saga completed
   */
  recordSagaCompleted(sagaType: string, tenantId: string, durationMs: number): void {
    metrics.increment(MetricNames.SAGA_COMPLETED_TOTAL, {
      saga_type: sagaType,
      tenant_id: tenantId,
    });
    
    metrics.observe(MetricNames.SAGA_DURATION_MS, durationMs, {
      saga_type: sagaType,
      tenant_id: tenantId,
      status: 'completed',
    });
  },

  /**
   * Record saga failed
   */
  recordSagaFailed(sagaType: string, tenantId: string, durationMs: number, failureReason: string): void {
    metrics.increment(MetricNames.SAGA_FAILED_TOTAL, {
      saga_type: sagaType,
      tenant_id: tenantId,
      failure_reason: failureReason,
    });
    
    metrics.observe(MetricNames.SAGA_DURATION_MS, durationMs, {
      saga_type: sagaType,
      tenant_id: tenantId,
      status: 'failed',
    });
  },

  /**
   * Record saga compensated
   */
  recordSagaCompensated(sagaType: string, tenantId: string, durationMs: number, compensationDurationMs: number): void {
    metrics.increment(MetricNames.SAGA_COMPENSATED_TOTAL, {
      saga_type: sagaType,
      tenant_id: tenantId,
    });
    
    metrics.observe(MetricNames.SAGA_DURATION_MS, durationMs, {
      saga_type: sagaType,
      tenant_id: tenantId,
      status: 'compensated',
    });
    
    metrics.observe(MetricNames.SAGA_COMPENSATION_DURATION_MS, compensationDurationMs, {
      saga_type: sagaType,
      tenant_id: tenantId,
    });
  },

  /**
   * Record saga step duration
   */
  recordSagaStepDuration(sagaType: string, stepName: string, tenantId: string, durationMs: number, status: 'completed' | 'failed'): void {
    metrics.observe(MetricNames.SAGA_STEP_DURATION_MS, durationMs, {
      saga_type: sagaType,
      step_name: stepName,
      tenant_id: tenantId,
      status,
    });
  },

  /**
   * Record saga step retry
   */
  recordSagaStepRetry(sagaType: string, stepName: string, tenantId: string, errorType: string): void {
    metrics.increment(MetricNames.SAGA_STEP_RETRIES_TOTAL, {
      saga_type: sagaType,
      step_name: stepName,
      tenant_id: tenantId,
      error_type: errorType,
    });
  },

  /**
   * Record saga recovery attempt
   */
  recordSagaRecoveryAttempt(sagaType: string, tenantId: string, success: boolean): void {
    metrics.increment(MetricNames.SAGA_RECOVERY_ATTEMPTS_TOTAL, {
      saga_type: sagaType,
      tenant_id: tenantId,
      success: success.toString(),
    });
  },
};

/**
 * Log metrics periodically
 */
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const metricsData = metrics.getMetricsJSON();
    const metricCount = metrics.getMetricCount();
    
    if (metricCount > 0) {
      pinoLogger.debug({
        type: 'metrics_snapshot',
        metricCount,
        metrics: metricsData,
      }, 'Metrics snapshot');
    }
  }, 60000); // Log every minute
}
