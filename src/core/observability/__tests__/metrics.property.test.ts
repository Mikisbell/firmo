/**
 * Property-Based Tests for Metrics Collector
 * 
 * These tests verify universal properties that should hold true
 * across all valid inputs and execution scenarios.
 * 
 * Uses fast-check for property-based testing with 100+ iterations per property.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { VercelMetricsCollector } from '../metrics';
import type { MetricTags } from '../metrics';

// Configure fast-check for comprehensive testing
fc.configureGlobal({
  numRuns: 100, // Minimum 100 iterations per property
  verbose: false,
});

// Arbitraries for generating test data
const metricNameArbitrary = fc.constantFrom(
  'orders.created',
  'payments.completed',
  'events.synced',
  'users.login',
  'orders.cancelled',
  'sync.failed',
  'cache.hit',
  'cache.miss'
);

const eventTypeArbitrary = fc.constantFrom(
  'ORDER_CREATED',
  'PAYMENT_COMPLETED',
  'EVENT_SYNCED',
  'USER_LOGIN',
  'ORDER_CANCELLED',
  'ITEM_ADDED',
  'ITEM_REMOVED'
);

const roleArbitrary = fc.constantFrom(
  'CASHIER',
  'WAITER',
  'ADMIN',
  'KDS',
  'MANAGER'
);

const endpointArbitrary = fc.constantFrom(
  '/api/orders',
  '/api/payments',
  '/api/events/ingest',
  '/api/auth/login',
  '/api/products',
  '/api/employees'
);

const metricTagsArbitrary = fc.record({
  tenantId: fc.option(fc.uuid(), { nil: undefined }),
  terminalId: fc.option(fc.uuid(), { nil: undefined }),
  eventType: fc.option(eventTypeArbitrary, { nil: undefined }),
  endpoint: fc.option(endpointArbitrary, { nil: undefined }),
  role: fc.option(roleArbitrary, { nil: undefined }),
});

const positiveNumberArbitrary = fc.integer({ min: 1, max: 10000 });
const durationArbitrary = fc.integer({ min: 1, max: 5000 }); // 1ms to 5s

describe('Metrics Collector - Property Tests', () => {
  let collector: VercelMetricsCollector;

  beforeEach(() => {
    collector = new VercelMetricsCollector();
  });

  afterEach(() => {
    collector.clear();
  });

  /**
   * Property 5: Business Event Metrics
   * 
   * For any business event (order created, payment completed, event synced, user login),
   * the Metrics_Collector SHALL emit a corresponding counter metric with appropriate
   * tags (tenantId, terminalId, eventType, role).
   * 
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4
   */
  describe('Property 5: Business Event Metrics', () => {
    it('should emit counter metrics for any business event with appropriate tags', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          metricTagsArbitrary,
          (metricName, tags) => {
            // Clear previous metrics
            collector.clear();

            // Emit business event metric
            collector.increment(metricName, tags);

            // Verify metric was recorded
            const metrics = collector.getMetrics();
            expect(metrics.size).toBeGreaterThan(0);

            // Verify counter was incremented
            const counters = collector.getCounters();
            expect(counters.size).toBeGreaterThan(0);

            // Find the metric entry
            const metricEntries = Array.from(metrics.values());
            const matchingEntry = metricEntries.find(entry => entry.name === metricName);

            expect(matchingEntry).toBeDefined();
            expect(matchingEntry?.type).toBe('counter');
            expect(matchingEntry?.value).toBeGreaterThan(0);

            // Verify tags are preserved
            if (tags.tenantId) {
              expect(matchingEntry?.tags.tenantId).toBe(tags.tenantId);
            }
            if (tags.terminalId) {
              expect(matchingEntry?.tags.terminalId).toBe(tags.terminalId);
            }
            if (tags.eventType) {
              expect(matchingEntry?.tags.eventType).toBe(tags.eventType);
            }
            if (tags.role) {
              expect(matchingEntry?.tags.role).toBe(tags.role);
            }
          }
        ) as any,
        {
          examples: [
            ['orders.created', { tenantId: '123', terminalId: '456', eventType: 'ORDER_CREATED' }],
            ['payments.completed', { tenantId: '789', role: 'CASHIER' }],
            ['users.login', { role: 'WAITER' }],
          ],
        }
      );
    });

    it('should accumulate counter values for repeated events', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          metricTagsArbitrary,
          fc.integer({ min: 1, max: 10 }),
          (metricName, tags, count) => {
            collector.clear();

            // Emit the same event multiple times
            for (let i = 0; i < count; i++) {
              collector.increment(metricName, tags);
            }

            // Verify counter accumulated correctly
            const counters = collector.getCounters();
            const counterValues = Array.from(counters.values());
            
            // Should have at least one counter with value >= count
            const maxValue = Math.max(...counterValues);
            expect(maxValue).toBeGreaterThanOrEqual(count);
          }
        )
      );
    });

    it('should track different events independently', () => {
      fc.assert(
        fc.property(
          fc.tuple(metricNameArbitrary, metricNameArbitrary).filter(([a, b]) => a !== b),
          metricTagsArbitrary,
          ([metric1, metric2], tags) => {
            collector.clear();

            // Emit two different events
            collector.increment(metric1, tags);
            collector.increment(metric2, tags);

            // Verify both metrics were recorded
            const metrics = collector.getMetrics();
            const metricNames = Array.from(metrics.values()).map(m => m.name);

            expect(metricNames).toContain(metric1);
            expect(metricNames).toContain(metric2);
          }
        )
      );
    });
  });

  /**
   * Property 6: API Response Time Metrics
   * 
   * For any API endpoint call, the Metrics_Collector SHALL record the response
   * time as a histogram metric with endpoint and tenant tags.
   * 
   * Validates: Requirements 3.5
   */
  describe('Property 6: API Response Time Metrics', () => {
    it('should record response time as histogram for any endpoint', () => {
      fc.assert(
        fc.property(
          endpointArbitrary,
          durationArbitrary,
          fc.uuid(),
          (endpoint, duration, tenantId) => {
            collector.clear();

            // Record API response time
            collector.histogram('api.response_time', duration, {
              endpoint,
              tenantId,
            });

            // Verify histogram was recorded
            const histograms = collector.getHistograms();
            expect(histograms.size).toBeGreaterThan(0);

            // Verify the value was stored
            const histogramValues = Array.from(histograms.values());
            const allValues = histogramValues.flat();
            expect(allValues).toContain(duration);

            // Verify metric entry
            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const matchingEntry = metricEntries.find(
              entry => entry.name === 'api.response_time' && entry.value === duration
            );

            expect(matchingEntry).toBeDefined();
            expect(matchingEntry?.type).toBe('histogram');
            expect(matchingEntry?.tags.endpoint).toBe(endpoint);
            expect(matchingEntry?.tags.tenantId).toBe(tenantId);
          }
        )
      );
    });

    it('should use timing method as shorthand for histogram', () => {
      fc.assert(
        fc.property(
          endpointArbitrary,
          durationArbitrary,
          fc.uuid(),
          (endpoint, duration, tenantId) => {
            collector.clear();

            // Record using timing method
            collector.timing('api.request', duration, {
              endpoint,
              tenantId,
            });

            // Verify histogram was created with .duration suffix
            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const matchingEntry = metricEntries.find(
              entry => entry.name === 'api.request.duration'
            );

            expect(matchingEntry).toBeDefined();
            expect(matchingEntry?.type).toBe('histogram');
            expect(matchingEntry?.value).toBe(duration);
          }
        )
      );
    });

    it('should store multiple response times for the same endpoint', () => {
      fc.assert(
        fc.property(
          endpointArbitrary,
          fc.array(durationArbitrary, { minLength: 2, maxLength: 10 }),
          fc.uuid(),
          (endpoint, durations, tenantId) => {
            collector.clear();

            // Record multiple response times
            durations.forEach(duration => {
              collector.histogram('api.response_time', duration, {
                endpoint,
                tenantId,
              });
            });

            // Verify all values were stored
            const histograms = collector.getHistograms();
            const histogramValues = Array.from(histograms.values());
            const allValues = histogramValues.flat();

            durations.forEach(duration => {
              expect(allValues).toContain(duration);
            });
          }
        )
      );
    });
  });

  /**
   * Property 7: Session Tracking Metrics
   * 
   * For any active session, the Metrics_Collector SHALL track the session
   * count by tenant and terminal as a gauge metric.
   * 
   * Validates: Requirements 3.6
   */
  describe('Property 7: Session Tracking Metrics', () => {
    it('should track session count as gauge for any tenant and terminal', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          positiveNumberArbitrary,
          (tenantId, terminalId, sessionCount) => {
            collector.clear();

            // Record session count
            collector.gauge('sessions.active', sessionCount, {
              tenantId,
              terminalId,
            });

            // Verify gauge was recorded
            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const matchingEntry = metricEntries.find(
              entry => entry.name === 'sessions.active'
            );

            expect(matchingEntry).toBeDefined();
            expect(matchingEntry?.type).toBe('gauge');
            expect(matchingEntry?.value).toBe(sessionCount);
            expect(matchingEntry?.tags.tenantId).toBe(tenantId);
            expect(matchingEntry?.tags.terminalId).toBe(terminalId);
          }
        )
      );
    });

    it('should overwrite gauge value on subsequent updates', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.tuple(positiveNumberArbitrary, positiveNumberArbitrary),
          (tenantId, terminalId, [value1, value2]) => {
            collector.clear();

            // Record initial gauge value
            collector.gauge('sessions.active', value1, {
              tenantId,
              terminalId,
            });

            // Update gauge value
            collector.gauge('sessions.active', value2, {
              tenantId,
              terminalId,
            });

            // Verify gauge was overwritten (not accumulated)
            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const matchingEntry = metricEntries.find(
              entry => entry.name === 'sessions.active'
            );

            expect(matchingEntry).toBeDefined();
            expect(matchingEntry?.value).toBe(value2); // Should be the latest value
          }
        )
      );
    });

    it('should track sessions independently per tenant and terminal', () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.uuid(), fc.uuid()),
          fc.tuple(fc.uuid(), fc.uuid()),
          fc.tuple(positiveNumberArbitrary, positiveNumberArbitrary),
          ([tenant1, terminal1], [tenant2, terminal2], [count1, count2]) => {
            // Ensure different tenant/terminal combinations
            if (tenant1 === tenant2 && terminal1 === terminal2) {
              return; // Skip if same combination
            }

            collector.clear();

            // Record sessions for two different tenant/terminal combinations
            collector.gauge('sessions.active', count1, {
              tenantId: tenant1,
              terminalId: terminal1,
            });

            collector.gauge('sessions.active', count2, {
              tenantId: tenant2,
              terminalId: terminal2,
            });

            // Verify both metrics exist independently
            const metrics = collector.getMetrics();
            expect(metrics.size).toBeGreaterThanOrEqual(2);
          }
        )
      );
    });
  });

  /**
   * Property 24: Metrics Idempotency
   * 
   * For any metric operation (increment, gauge, histogram), calling the operation
   * multiple times with the same parameters SHALL produce consistent results
   * (counters accumulate, gauges overwrite, histograms append).
   * 
   * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
   */
  describe('Property 24: Metrics Idempotency', () => {
    it('should accumulate counter values consistently', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          metricTagsArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (metricName, tags, iterations) => {
            collector.clear();

            // Increment counter multiple times
            for (let i = 0; i < iterations; i++) {
              collector.increment(metricName, tags);
            }

            // Verify counter accumulated correctly
            const counters = collector.getCounters();
            const counterValues = Array.from(counters.values());
            const maxValue = Math.max(...counterValues);

            expect(maxValue).toBe(iterations);
          }
        )
      );
    });

    it('should overwrite gauge values consistently', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.array(positiveNumberArbitrary, { minLength: 2, maxLength: 5 }),
          (tenantId, values) => {
            collector.clear();

            // Set gauge multiple times
            values.forEach(value => {
              collector.gauge('test.gauge', value, { tenantId });
            });

            // Verify gauge has the last value
            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const gaugeEntry = metricEntries.find(entry => entry.name === 'test.gauge');

            expect(gaugeEntry).toBeDefined();
            expect(gaugeEntry?.value).toBe(values[values.length - 1]);
          }
        )
      );
    });

    it('should append histogram values consistently', () => {
      fc.assert(
        fc.property(
          endpointArbitrary,
          fc.array(durationArbitrary, { minLength: 2, maxLength: 5 }),
          (endpoint, durations) => {
            collector.clear();

            // Record multiple histogram values
            durations.forEach(duration => {
              collector.histogram('test.histogram', duration, { endpoint });
            });

            // Verify all values were appended
            const histograms = collector.getHistograms();
            const histogramValues = Array.from(histograms.values());
            const allValues = histogramValues.flat();

            expect(allValues.length).toBeGreaterThanOrEqual(durations.length);
            durations.forEach(duration => {
              expect(allValues).toContain(duration);
            });
          }
        )
      );
    });

    it('should handle decrement operations consistently', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          metricTagsArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (metricName, tags, iterations) => {
            collector.clear();

            // Increment then decrement
            for (let i = 0; i < iterations; i++) {
              collector.increment(metricName, tags);
            }
            for (let i = 0; i < iterations; i++) {
              collector.decrement(metricName, tags);
            }

            // Verify counter is back to 0
            const counters = collector.getCounters();
            const counterValues = Array.from(counters.values());
            
            // Should have a counter with value 0 or close to 0
            const finalValue = counterValues[counterValues.length - 1];
            expect(Math.abs(finalValue)).toBeLessThanOrEqual(1);
          }
        )
      );
    });
  });

  /**
   * Additional Property: Tag Normalization
   * 
   * For any metric with tags containing undefined values, the collector
   * SHALL normalize tags by removing undefined values.
   */
  describe('Property: Tag Normalization', () => {
    it('should remove undefined tag values', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          fc.record({
            tenantId: fc.option(fc.uuid(), { nil: undefined }),
            terminalId: fc.option(fc.uuid(), { nil: undefined }),
            undefinedField: fc.constant(undefined),
          }),
          (metricName, tags) => {
            collector.clear();

            collector.increment(metricName, tags);

            const metrics = collector.getMetrics();
            const metricEntries = Array.from(metrics.values());
            const entry = metricEntries[0];

            // Verify undefined fields are not in tags
            expect(entry.tags).not.toHaveProperty('undefinedField');
          }
        )
      );
    });
  });

  /**
   * Additional Property: Metric Key Consistency
   * 
   * For any metric with the same name and tags, the collector SHALL
   * generate the same key consistently.
   */
  describe('Property: Metric Key Consistency', () => {
    it('should generate consistent keys for same metric and tags', () => {
      fc.assert(
        fc.property(
          metricNameArbitrary,
          metricTagsArbitrary,
          (metricName, tags) => {
            collector.clear();

            // Record metric twice
            collector.increment(metricName, tags);
            const metrics1 = collector.getMetrics();
            const keys1 = Array.from(metrics1.keys());

            collector.clear();
            collector.increment(metricName, tags);
            const metrics2 = collector.getMetrics();
            const keys2 = Array.from(metrics2.keys());

            // Keys should be identical
            expect(keys1).toEqual(keys2);
          }
        )
      );
    });
  });
});

