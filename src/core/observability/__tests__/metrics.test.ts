/**
 * Metrics Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
    incrementCounter,
    setGauge,
    recordHistogram,
    getCounter,
    getGauge,
    getHistogram,
    getPercentile,
    resetMetrics,
    getPrometheusMetrics,
    getMetricsSummary,
    syncMetrics,
    apiMetrics,
    circuitBreakerMetrics,
    businessMetrics,
} from '../metrics';

describe('Metrics Service', () => {
    beforeEach(() => {
        resetMetrics();
    });

    describe('Counters', () => {
        it('increments counter by 1 by default', () => {
            incrementCounter('sync_events_processed_total');
            expect(getCounter('sync_events_processed_total')).toBe(1);
        });

        it('increments counter by specified value', () => {
            incrementCounter('sync_events_processed_total', 5);
            expect(getCounter('sync_events_processed_total')).toBe(5);
        });

        it('accumulates multiple increments', () => {
            incrementCounter('sync_events_processed_total', 3);
            incrementCounter('sync_events_processed_total', 7);
            expect(getCounter('sync_events_processed_total')).toBe(10);
        });

        it('returns 0 for unknown counter', () => {
            expect(getCounter('unknown_counter')).toBe(0);
        });
    });

    describe('Gauges', () => {
        it('sets gauge value', () => {
            setGauge('sync_backlog', 100);
            expect(getGauge('sync_backlog')).toBe(100);
        });

        it('overwrites previous gauge value', () => {
            setGauge('sync_backlog', 100);
            setGauge('sync_backlog', 50);
            expect(getGauge('sync_backlog')).toBe(50);
        });

        it('returns 0 for unknown gauge', () => {
            expect(getGauge('unknown_gauge')).toBe(0);
        });
    });

    describe('Histograms', () => {
        it('records histogram observation', () => {
            recordHistogram('sync_latency_ms', 100);
            const hist = getHistogram('sync_latency_ms');
            expect(hist?.count).toBe(1);
            expect(hist?.sum).toBe(100);
        });

        it('accumulates multiple observations', () => {
            recordHistogram('sync_latency_ms', 100);
            recordHistogram('sync_latency_ms', 200);
            recordHistogram('sync_latency_ms', 300);
            const hist = getHistogram('sync_latency_ms');
            expect(hist?.count).toBe(3);
            expect(hist?.sum).toBe(600);
        });

        it('updates bucket counts correctly', () => {
            recordHistogram('sync_latency_ms', 50);  // <= 50, 100, 250, ...
            recordHistogram('sync_latency_ms', 150); // <= 250, 500, ...
            recordHistogram('sync_latency_ms', 500); // <= 500, 1000, ...
            
            const hist = getHistogram('sync_latency_ms');
            const bucket50 = hist?.buckets.find(b => b.le === 50);
            const bucket100 = hist?.buckets.find(b => b.le === 100);
            const bucket250 = hist?.buckets.find(b => b.le === 250);
            const bucket500 = hist?.buckets.find(b => b.le === 500);
            
            expect(bucket50?.count).toBe(1);
            expect(bucket100?.count).toBe(1);
            expect(bucket250?.count).toBe(2);
            expect(bucket500?.count).toBe(3);
        });
    });

    describe('Percentiles', () => {
        it('calculates p50 correctly', () => {
            // Add values that span buckets
            for (let i = 0; i < 10; i++) {
                recordHistogram('sync_latency_ms', 50);
            }
            for (let i = 0; i < 10; i++) {
                recordHistogram('sync_latency_ms', 200);
            }
            
            const p50 = getPercentile('sync_latency_ms', 50);
            expect(p50).toBe(50); // First bucket that contains 50% of observations
        });

        it('returns 0 for empty histogram', () => {
            expect(getPercentile('sync_latency_ms', 95)).toBe(0);
        });
    });

    describe('Prometheus Export', () => {
        it('exports metrics in Prometheus format', () => {
            incrementCounter('sync_events_processed_total', 100);
            setGauge('sync_backlog', 50);
            recordHistogram('sync_latency_ms', 100);
            
            const output = getPrometheusMetrics();
            
            expect(output).toContain('sync_events_processed_total 100');
            expect(output).toContain('sync_backlog 50');
            expect(output).toContain('sync_latency_ms_count 1');
            expect(output).toContain('sync_latency_ms_sum 100');
        });

        it('includes HELP and TYPE comments', () => {
            const output = getPrometheusMetrics();
            
            expect(output).toContain('# HELP sync_backlog');
            expect(output).toContain('# TYPE sync_backlog gauge');
        });
    });

    describe('JSON Summary', () => {
        it('returns structured summary', () => {
            incrementCounter('sync_events_processed_total', 100);
            setGauge('sync_backlog', 50);
            
            const summary = getMetricsSummary();
            
            expect(summary.sync.events_processed).toBe(100);
            expect(summary.sync.backlog).toBe(50);
        });
    });

    describe('Convenience Functions', () => {
        it('syncMetrics works correctly', () => {
            syncMetrics.recordLatency(150);
            syncMetrics.setBacklog(25);
            syncMetrics.incrementEventsProcessed(10);
            syncMetrics.incrementErrors();
            syncMetrics.incrementBatches();
            
            expect(getHistogram('sync_latency_ms')?.count).toBe(1);
            expect(getGauge('sync_backlog')).toBe(25);
            expect(getCounter('sync_events_processed_total')).toBe(10);
            expect(getCounter('sync_errors_total')).toBe(1);
            expect(getCounter('sync_batches_total')).toBe(1);
        });

        it('apiMetrics works correctly', () => {
            apiMetrics.recordIngestLatency(200);
            apiMetrics.recordBatchSize(50);
            apiMetrics.incrementEventsIngested(50);
            apiMetrics.incrementProjectionErrors();
            
            expect(getHistogram('ingest_latency_ms')?.count).toBe(1);
            expect(getHistogram('ingest_batch_size')?.count).toBe(1);
            expect(getCounter('ingest_events_total')).toBe(50);
            expect(getCounter('projection_errors_total')).toBe(1);
        });

        it('circuitBreakerMetrics works correctly', () => {
            circuitBreakerMetrics.setState('CLOSED');
            expect(getGauge('circuit_breaker_state')).toBe(0);
            
            circuitBreakerMetrics.setState('HALF_OPEN');
            expect(getGauge('circuit_breaker_state')).toBe(1);
            
            circuitBreakerMetrics.setState('OPEN');
            expect(getGauge('circuit_breaker_state')).toBe(2);
            
            circuitBreakerMetrics.incrementFailures();
            expect(getCounter('circuit_breaker_failures_total')).toBe(1);
        });

        it('businessMetrics works correctly', () => {
            businessMetrics.incrementOrdersCreated();
            businessMetrics.incrementOrdersCompleted();
            businessMetrics.recordOrderTotal(5000);
            
            expect(getCounter('orders_created_total')).toBe(1);
            expect(getCounter('orders_completed_total')).toBe(1);
            expect(getHistogram('order_total_cents')?.count).toBe(1);
        });
    });
});

describe('Metrics Properties', () => {
    beforeEach(() => {
        resetMetrics();
    });

    // Property 1: Counters are monotonically increasing
    it('Property 1: Counters only increase', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 100 }),
                (increments) => {
                    resetMetrics();
                    
                    let expectedTotal = 0;
                    for (const inc of increments) {
                        incrementCounter('sync_events_processed_total', inc);
                        expectedTotal += inc;
                        
                        const actual = getCounter('sync_events_processed_total');
                        if (actual !== expectedTotal) return false;
                    }
                    
                    return true;
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 2: Histogram count equals number of observations
    it('Property 2: Histogram count matches observations', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 100 }),
                (values) => {
                    resetMetrics();
                    
                    for (const v of values) {
                        recordHistogram('sync_latency_ms', v);
                    }
                    
                    const hist = getHistogram('sync_latency_ms');
                    return hist?.count === values.length;
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 3: Histogram sum equals sum of observations
    it('Property 3: Histogram sum matches total', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 1, maxLength: 100 }),
                (values) => {
                    resetMetrics();
                    
                    for (const v of values) {
                        recordHistogram('sync_latency_ms', v);
                    }
                    
                    const hist = getHistogram('sync_latency_ms');
                    const expectedSum = values.reduce((a, b) => a + b, 0);
                    return hist?.sum === expectedSum;
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 4: Gauge reflects last set value
    it('Property 4: Gauge reflects last value', () => {
        fc.assert(
            fc.property(
                fc.array(fc.integer({ min: 0, max: 10000 }), { minLength: 1, maxLength: 50 }),
                (values) => {
                    resetMetrics();
                    
                    for (const v of values) {
                        setGauge('sync_backlog', v);
                    }
                    
                    const lastValue = values[values.length - 1];
                    return getGauge('sync_backlog') === lastValue;
                }
            ),
            { numRuns: 50 }
        );
    });

    // Property 5: Reset clears all metrics
    it('Property 5: Reset clears all metrics', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1000 }),
                fc.integer({ min: 1, max: 1000 }),
                fc.integer({ min: 1, max: 1000 }),
                (counterVal, gaugeVal, histVal) => {
                    incrementCounter('sync_events_processed_total', counterVal);
                    setGauge('sync_backlog', gaugeVal);
                    recordHistogram('sync_latency_ms', histVal);
                    
                    resetMetrics();
                    
                    return (
                        getCounter('sync_events_processed_total') === 0 &&
                        getGauge('sync_backlog') === 0 &&
                        getHistogram('sync_latency_ms')?.count === 0
                    );
                }
            ),
            { numRuns: 20 }
        );
    });
});
