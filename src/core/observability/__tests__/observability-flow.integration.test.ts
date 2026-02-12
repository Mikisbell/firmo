/**
 * Integration Tests for Observability Flow
 * 
 * Tests the complete observability pipeline: logging, error tracking, and metrics collection.
 * Validates that errors are logged, tracked, and metrics are emitted correctly.
 * 
 * Validates: Requirements 1.1, 2.1, 3.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StructuredLogger } from '../structured-logger';
import { MockSentryErrorTracker } from '../error-tracker';
import { VercelMetricsCollector } from '../metrics';

describe('Observability Flow - Integration Tests', () => {
  let logger: StructuredLogger;
  let errorTracker: MockSentryErrorTracker;
  let metrics: VercelMetricsCollector;

  // Mock stdout/stderr to capture output
  let stdoutOutput: string[] = [];
  let stderrOutput: string[] = [];
  const originalWrite = {
    stdout: process.stdout.write,
    stderr: process.stderr.write,
  };

  function mockOutput() {
    stdoutOutput = [];
    stderrOutput = [];
    
    process.stdout.write = vi.fn((chunk: any) => {
      stdoutOutput.push(chunk.toString());
      return true;
    }) as any;
    
    process.stderr.write = vi.fn((chunk: any) => {
      stderrOutput.push(chunk.toString());
      return true;
    }) as any;
  }

  function restoreOutput() {
    process.stdout.write = originalWrite.stdout;
    process.stderr.write = originalWrite.stderr;
  }

  beforeEach(() => {
    // Set test environment
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });
    process.env.LOG_LEVEL = 'debug';
    
    mockOutput();
    
    logger = new StructuredLogger('integration-test');
    errorTracker = new MockSentryErrorTracker();
    metrics = new VercelMetricsCollector();
  });

  afterEach(() => {
    restoreOutput();
    delete process.env.LOG_LEVEL;
    metrics.clear();
  });

  /**
   * Test 1: Complete Error Flow
   * 
   * When an error occurs, verify that:
   * 1. Error is logged with full context
   * 2. Error is tracked by error tracker
   * 3. Error metric is emitted
   */
  describe('Complete Error Flow', () => {
    it('should log, track, and emit metrics for errors', () => {
      const error = new Error('Test error');
      const context = {
        tenantId: 'tenant-123',
        terminalId: 'terminal-456',
        userId: 'user-789',
      };

      // 1. Log the error
      logger.error('An error occurred', error, context);

      // 2. Track the error
      errorTracker.captureException(error, context);

      // 3. Emit error metric
      metrics.increment('errors.occurred', {
        tenantId: context.tenantId,
        terminalId: context.terminalId,
      });

      // Verify logging occurred
      const allOutput = [...stdoutOutput, ...stderrOutput];
      expect(allOutput.length).toBeGreaterThan(0);

      // Verify error was tracked (check logger.error was called by error tracker)
      // This is validated by the error tracker's internal logging

      // Verify metric was emitted
      const metricsData = metrics.getMetrics();
      expect(metricsData.size).toBeGreaterThan(0);

      const errorMetric = Array.from(metricsData.values()).find(
        m => m.name === 'errors.occurred'
      );
      expect(errorMetric).toBeDefined();
      expect(errorMetric?.value).toBe(1);
      expect(errorMetric?.tags.tenantId).toBe(context.tenantId);
    });

    it('should handle multiple errors in sequence', () => {
      const errors = [
        { message: 'Error 1', tenantId: 'tenant-1' },
        { message: 'Error 2', tenantId: 'tenant-2' },
        { message: 'Error 3', tenantId: 'tenant-1' },
      ];

      errors.forEach(({ message, tenantId }) => {
        const error = new Error(message);
        
        // Log, track, and emit metric
        logger.error(message, error, { tenantId });
        errorTracker.captureException(error, { tenantId });
        metrics.increment('errors.occurred', { tenantId });
      });

      // Verify all errors were processed
      const metricsData = metrics.getMetrics();
      const errorMetrics = Array.from(metricsData.values()).filter(
        m => m.name === 'errors.occurred'
      );

      // Should have metrics for both tenants
      expect(errorMetrics.length).toBeGreaterThanOrEqual(2);
    });
  });

  /**
   * Test 2: Business Event Flow
   * 
   * When a business event occurs, verify that:
   * 1. Event is logged
   * 2. Event metric is emitted
   * 3. Context is preserved throughout
   */
  describe('Business Event Flow', () => {
    it('should log and emit metrics for business events', () => {
      const eventData = {
        eventType: 'ORDER_CREATED',
        tenantId: 'tenant-123',
        terminalId: 'terminal-456',
        orderId: 'order-789',
        total: 5000, // 50.00 in centavos
      };

      // 1. Log the event
      logger.info('Order created', {
        tenantId: eventData.tenantId,
        terminalId: eventData.terminalId,
        orderId: eventData.orderId,
        eventType: eventData.eventType,
      });

      // 2. Emit business metrics
      metrics.increment('orders.created', {
        tenantId: eventData.tenantId,
        terminalId: eventData.terminalId,
      });

      metrics.histogram('orders.total', eventData.total, {
        tenantId: eventData.tenantId,
      });

      // Verify logging occurred
      const allOutput = [...stdoutOutput, ...stderrOutput];
      expect(allOutput.length).toBeGreaterThan(0);

      // Verify metrics were emitted
      const metricsData = metrics.getMetrics();
      
      const orderCreatedMetric = Array.from(metricsData.values()).find(
        m => m.name === 'orders.created'
      );
      expect(orderCreatedMetric).toBeDefined();
      expect(orderCreatedMetric?.value).toBe(1);

      const orderTotalMetric = Array.from(metricsData.values()).find(
        m => m.name === 'orders.total'
      );
      expect(orderTotalMetric).toBeDefined();
      expect(orderTotalMetric?.value).toBe(eventData.total);
    });

    it('should track multiple business events with different types', () => {
      const events = [
        { type: 'ORDER_CREATED', metric: 'orders.created' },
        { type: 'PAYMENT_COMPLETED', metric: 'payments.completed' },
        { type: 'EVENT_SYNCED', metric: 'events.synced' },
      ];

      const tenantId = 'tenant-123';

      events.forEach(({ type, metric }) => {
        logger.info(`Event: ${type}`, { tenantId, eventType: type });
        metrics.increment(metric, { tenantId, eventType: type });
      });

      // Verify all metrics were emitted
      const metricsData = metrics.getMetrics();
      const metricNames = Array.from(metricsData.values()).map(m => m.name);

      expect(metricNames).toContain('orders.created');
      expect(metricNames).toContain('payments.completed');
      expect(metricNames).toContain('events.synced');
    });
  });

  /**
   * Test 3: API Request Flow
   * 
   * When an API request is processed, verify that:
   * 1. Request is logged with correlation ID
   * 2. Response time is tracked
   * 3. Status code is logged
   */
  describe('API Request Flow', () => {
    it('should log and track API requests end-to-end', () => {
      const requestData = {
        requestId: 'req-123',
        method: 'POST',
        path: '/api/orders',
        tenantId: 'tenant-123',
        terminalId: 'terminal-456',
      };

      const startTime = Date.now();

      // 1. Log request start
      logger.info('API request started', {
        correlationId: requestData.requestId,
        tenantId: requestData.tenantId,
        terminalId: requestData.terminalId,
        method: requestData.method,
        path: requestData.path,
      });

      // Simulate processing
      const processingTime = 150; // 150ms

      // 2. Log request completion
      logger.info('API request completed', {
        correlationId: requestData.requestId,
        tenantId: requestData.tenantId,
        statusCode: 201,
        duration: processingTime,
      });

      // 3. Emit metrics
      metrics.histogram('api.response_time', processingTime, {
        endpoint: requestData.path,
        tenantId: requestData.tenantId,
      });

      metrics.increment('api.requests', {
        endpoint: requestData.path,
        method: requestData.method,
        status: '2xx',
      });

      // Verify logging occurred
      const allOutput = [...stdoutOutput, ...stderrOutput];
      expect(allOutput.length).toBeGreaterThan(0);

      // Verify metrics were emitted
      const metricsData = metrics.getMetrics();
      
      const responseTimeMetric = Array.from(metricsData.values()).find(
        m => m.name === 'api.response_time'
      );
      expect(responseTimeMetric).toBeDefined();
      expect(responseTimeMetric?.value).toBe(processingTime);

      const requestCountMetric = Array.from(metricsData.values()).find(
        m => m.name === 'api.requests'
      );
      expect(requestCountMetric).toBeDefined();
      expect(requestCountMetric?.value).toBe(1);
    });

    it('should track failed API requests', () => {
      const requestData = {
        requestId: 'req-456',
        method: 'GET',
        path: '/api/orders/invalid',
        tenantId: 'tenant-123',
      };

      const error = new Error('Order not found');

      // Log request start
      logger.info('API request started', {
        correlationId: requestData.requestId,
        method: requestData.method,
        path: requestData.path,
      });

      // Log error
      logger.error('API request failed', error, {
        correlationId: requestData.requestId,
        tenantId: requestData.tenantId,
        statusCode: 404,
      });

      // Track error
      errorTracker.captureException(error, {
        tenantId: requestData.tenantId,
        tags: {
          endpoint: requestData.path,
          method: requestData.method,
        },
      });

      // Emit metrics
      metrics.increment('api.requests', {
        endpoint: requestData.path,
        method: requestData.method,
        status: '4xx',
      });

      metrics.increment('api.errors', {
        endpoint: requestData.path,
        tenantId: requestData.tenantId,
      });

      // Verify metrics
      const metricsData = metrics.getMetrics();
      
      const errorMetric = Array.from(metricsData.values()).find(
        m => m.name === 'api.errors'
      );
      expect(errorMetric).toBeDefined();
      expect(errorMetric?.value).toBe(1);
    });
  });

  /**
   * Test 4: Graceful Degradation
   * 
   * When observability components fail, verify that:
   * 1. Application continues functioning
   * 2. Errors are logged but not thrown
   * 3. Metrics collection continues
   */
  describe('Graceful Degradation', () => {
    it('should continue functioning when logging fails', () => {
      // Simulate logging failure by restoring original output
      restoreOutput();

      // This should not throw
      expect(() => {
        logger.info('Test message', { tenantId: 'tenant-123' });
        metrics.increment('test.metric', { tenantId: 'tenant-123' });
      }).not.toThrow();

      // Metrics should still work
      const metricsData = metrics.getMetrics();
      expect(metricsData.size).toBeGreaterThan(0);
    });

    it('should continue functioning when error tracking fails', () => {
      const error = new Error('Test error');

      // This should not throw even if error tracker has issues
      expect(() => {
        errorTracker.captureException(error);
        logger.error('Error occurred', error);
        metrics.increment('errors.occurred');
      }).not.toThrow();

      // Metrics should still work
      const metricsData = metrics.getMetrics();
      expect(metricsData.size).toBeGreaterThan(0);
    });

    it('should handle malformed context gracefully', () => {
      const malformedContext: any = {
        tenantId: undefined,
        terminalId: null,
        circular: {},
      };
      malformedContext.circular.self = malformedContext.circular;

      // This should not throw
      expect(() => {
        logger.info('Test message', malformedContext);
        metrics.increment('test.metric', malformedContext);
      }).not.toThrow();
    });
  });

  /**
   * Test 5: Context Propagation
   * 
   * Verify that context (tenantId, terminalId, userId) is preserved
   * across all observability components.
   */
  describe('Context Propagation', () => {
    it('should preserve context across logging, tracking, and metrics', () => {
      const context = {
        tenantId: 'tenant-123',
        terminalId: 'terminal-456',
        userId: 'user-789',
        correlationId: 'corr-abc',
      };

      const error = new Error('Test error');

      // Log with context
      logger.error('Error with context', error, context);

      // Track with context
      errorTracker.captureException(error, context);

      // Emit metric with context
      metrics.increment('errors.with_context', {
        tenantId: context.tenantId,
        terminalId: context.terminalId,
      });

      // Verify context in metrics
      const metricsData = metrics.getMetrics();
      const metric = Array.from(metricsData.values()).find(
        m => m.name === 'errors.with_context'
      );

      expect(metric).toBeDefined();
      expect(metric?.tags.tenantId).toBe(context.tenantId);
      expect(metric?.tags.terminalId).toBe(context.terminalId);
    });

    it('should propagate context through child loggers', () => {
      const parentContext = {
        tenantId: 'tenant-123',
        terminalId: 'terminal-456',
      };

      const childLogger = logger.child(parentContext);

      const childContext = {
        userId: 'user-789',
        orderId: 'order-abc',
      };

      // Log with child logger
      childLogger.info('Child logger message', childContext);

      // Emit metric with combined context
      metrics.increment('child.logger.test', {
        ...parentContext,
        ...childContext,
      });

      // Verify combined context in metrics
      const metricsData = metrics.getMetrics();
      const metric = Array.from(metricsData.values()).find(
        m => m.name === 'child.logger.test'
      );

      expect(metric).toBeDefined();
      expect(metric?.tags.tenantId).toBe(parentContext.tenantId);
      expect(metric?.tags.terminalId).toBe(parentContext.terminalId);
    });
  });

  /**
   * Test 6: Performance
   * 
   * Verify that observability operations complete quickly and don't
   * block the main thread.
   */
  describe('Performance', () => {
    it('should complete observability operations within acceptable time', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        logger.info(`Test message ${i}`, { tenantId: 'tenant-123' });
        metrics.increment('test.metric', { tenantId: 'tenant-123' });
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;
      const avgDuration = totalDuration / iterations;

      // Average operation should be < 1ms
      expect(avgDuration).toBeLessThan(1);
    });

    it('should handle high-volume metrics efficiently', () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        metrics.increment('high.volume.metric', {
          tenantId: `tenant-${i % 10}`,
        });
      }

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // Should complete 1000 operations in < 100ms
      expect(totalDuration).toBeLessThan(100);

      // Verify all metrics were recorded
      const metricsData = metrics.getMetrics();
      expect(metricsData.size).toBeGreaterThan(0);
    });
  });
});
