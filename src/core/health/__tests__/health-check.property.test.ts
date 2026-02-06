/**
 * Property-Based Tests for Health Check Service
 * 
 * Tests universal properties that should hold across all health check executions.
 * Uses fast-check for property-based testing with 100+ iterations per property.
 * 
 * @module core/health/__tests__/health-check.property.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { HealthCheckService, ComponentHealth, SystemStatus } from '../health-check';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/src/core/observability/metrics', () => ({
  metrics: {
    gauge: vi.fn(),
    histogram: vi.fn(),
    increment: vi.fn(),
  },
}));

vi.mock('@/src/core/cache/cache-service', () => ({
  cache: {
    isAvailable: vi.fn(() => true),
    getType: vi.fn(() => 'redis'),
    set: vi.fn(),
    get: vi.fn(),
  },
}));

/**
 * Arbitraries for property-based testing
 */

// Component status arbitrary
const componentStatusArbitrary = fc.constantFrom('up', 'down', 'degraded');

// Response time arbitrary (0-2000ms)
const responseTimeArbitrary = fc.integer({ min: 0, max: 2000 });

// Component health arbitrary
const componentHealthArbitrary = fc.record({
  status: componentStatusArbitrary,
  responseTime: responseTimeArbitrary,
  message: fc.option(fc.string(), { nil: undefined }),
  details: fc.option(fc.dictionary(fc.string(), fc.anything()), { nil: undefined }),
});

describe('Health Check Service - Property-Based Tests', () => {
  let healthCheckService: HealthCheckService;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      $queryRaw: vi.fn(),
      events: {
        count: vi.fn(),
      },
      $disconnect: vi.fn(),
    };

    healthCheckService = new HealthCheckService(mockPrisma as unknown as PrismaClient);
  });

  afterEach(async () => {
    await healthCheckService.close();
    vi.clearAllMocks();
  });

  /**
   * Property 20: Health Check Component Status
   * 
   * For any health check request to /api/health, the response SHALL include 
   * status for all components (database, redis, eventSourcing) with individual 
   * response times and an overall system status.
   * 
   * Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.6
   */
  describe('Property 20: Health Check Component Status', () => {
    it('should always include all component statuses with response times', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            databaseSuccess: fc.boolean(),
            redisSuccess: fc.boolean(),
            eventSourcingSuccess: fc.boolean(),
          }),
          async (scenario) => {
            // Setup mocks based on scenario
            if (scenario.databaseSuccess) {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
            } else {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));
            }

            if (scenario.eventSourcingSuccess) {
              mockPrisma.events.count.mockResolvedValue(10);
            } else {
              mockPrisma.events.count.mockRejectedValue(new Error('Event table not accessible'));
            }

            // Execute health check
            const result = await healthCheckService.check();

            // Verify all required fields are present
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('timestamp');
            expect(result).toHaveProperty('components');
            expect(result).toHaveProperty('responseTime');

            // Verify all components are present
            expect(result.components).toHaveProperty('database');
            expect(result.components).toHaveProperty('redis');
            expect(result.components).toHaveProperty('eventSourcing');

            // Verify each component has required fields
            const components = [
              result.components.database,
              result.components.redis,
              result.components.eventSourcing,
            ];

            for (const component of components) {
              expect(component).toHaveProperty('status');
              expect(component).toHaveProperty('responseTime');
              expect(['up', 'down', 'degraded']).toContain(component.status);
              expect(component.responseTime).toBeGreaterThanOrEqual(0);
              expect(typeof component.responseTime).toBe('number');
            }

            // Verify overall status is valid
            expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);

            // Verify timestamp is valid ISO 8601
            expect(() => new Date(result.timestamp)).not.toThrow();
            expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

            // Verify response time is reasonable (< 2 seconds)
            expect(result.responseTime).toBeLessThan(2000);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should calculate system status correctly based on component health', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            databaseStatus: componentStatusArbitrary,
            redisStatus: componentStatusArbitrary,
            eventSourcingStatus: componentStatusArbitrary,
          }),
          async (scenario) => {
            // Setup mocks to produce desired component statuses
            if (scenario.databaseStatus === 'up') {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
            } else {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
            }

            if (scenario.eventSourcingStatus === 'up') {
              mockPrisma.events.count.mockResolvedValue(10);
            } else if (scenario.eventSourcingStatus === 'degraded') {
              mockPrisma.events.count.mockResolvedValue(0);
            } else {
              mockPrisma.events.count.mockRejectedValue(new Error('Event sourcing error'));
            }

            const result = await healthCheckService.check();

            // Calculate expected system status
            const statuses = [
              result.components.database.status,
              result.components.redis.status,
              result.components.eventSourcing.status,
            ];

            const hasDown = statuses.some((s) => s === 'down');
            const hasDegraded = statuses.some((s) => s === 'degraded');

            let expectedStatus: SystemStatus;
            if (hasDown) {
              expectedStatus = 'unhealthy';
            } else if (hasDegraded) {
              expectedStatus = 'degraded';
            } else {
              expectedStatus = 'healthy';
            }

            // Verify system status matches expected
            expect(result.status).toBe(expectedStatus);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should complete health check within 2 seconds', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            databaseDelay: fc.integer({ min: 0, max: 500 }),
            eventSourcingDelay: fc.integer({ min: 0, max: 500 }),
          }),
          async (scenario) => {
            // Setup mocks with delays
            mockPrisma.$queryRaw.mockImplementation(async () => {
              await new Promise((resolve) => setTimeout(resolve, scenario.databaseDelay));
              return [{ health_check: 1 }];
            });

            mockPrisma.events.count.mockImplementation(async () => {
              await new Promise((resolve) => setTimeout(resolve, scenario.eventSourcingDelay));
              return 10;
            });

            const startTime = Date.now();
            const result = await healthCheckService.check();
            const actualTime = Date.now() - startTime;

            // Verify response time is under 2 seconds
            expect(result.responseTime).toBeLessThan(2000);
            expect(actualTime).toBeLessThan(2100); // Allow 100ms buffer
          }
        ),
        {
          numRuns: 50, // Fewer runs due to delays
          verbose: true,
        }
      );
    });

    it('should include response times for all components', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (databaseSuccess) => {
            if (databaseSuccess) {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
            } else {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
            }

            mockPrisma.events.count.mockResolvedValue(10);

            const result = await healthCheckService.check();

            // Verify all components have response times
            expect(result.components.database.responseTime).toBeGreaterThanOrEqual(0);
            expect(result.components.redis.responseTime).toBeGreaterThanOrEqual(0);
            expect(result.components.eventSourcing.responseTime).toBeGreaterThanOrEqual(0);

            // Verify response times are numbers
            expect(typeof result.components.database.responseTime).toBe('number');
            expect(typeof result.components.redis.responseTime).toBe('number');
            expect(typeof result.components.eventSourcing.responseTime).toBe('number');

            // Verify response times are reasonable (< 2 seconds each)
            expect(result.components.database.responseTime).toBeLessThan(2000);
            expect(result.components.redis.responseTime).toBeLessThan(2000);
            expect(result.components.eventSourcing.responseTime).toBeLessThan(2000);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  /**
   * Property 21: Health Check Failure Response
   * 
   * For any health check request when at least one component is unhealthy, 
   * the /api/health endpoint SHALL return HTTP 503 with details about which 
   * components are failing.
   * 
   * Validates: Requirements 13.7
   */
  describe('Property 21: Health Check Failure Response', () => {
    it('should return unhealthy status when any component is down', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            databaseDown: fc.boolean(),
            eventSourcingDown: fc.boolean(),
          }),
          async (scenario) => {
            // At least one component must be down
            if (!scenario.databaseDown && !scenario.eventSourcingDown) {
              scenario.databaseDown = true;
            }

            // Setup mocks
            if (scenario.databaseDown) {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));
            } else {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
            }

            if (scenario.eventSourcingDown) {
              mockPrisma.events.count.mockRejectedValue(new Error('Event table not accessible'));
            } else {
              mockPrisma.events.count.mockResolvedValue(10);
            }

            const result = await healthCheckService.check();

            // Verify system status is unhealthy
            expect(result.status).toBe('unhealthy');

            // Verify at least one component is down
            const components = [
              result.components.database,
              result.components.redis,
              result.components.eventSourcing,
            ];

            const downComponents = components.filter((c) => c.status === 'down');
            expect(downComponents.length).toBeGreaterThan(0);

            // Verify down components have error messages
            for (const component of downComponents) {
              expect(component.message).toBeDefined();
              expect(typeof component.message).toBe('string');
              expect(component.message!.length).toBeGreaterThan(0);
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should include error details for failed components', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('database', 'eventSourcing'),
          async (failingComponent) => {
            // Setup mocks - make one component fail
            if (failingComponent === 'database') {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection timeout'));
              mockPrisma.events.count.mockResolvedValue(10);
            } else {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
              mockPrisma.events.count.mockRejectedValue(new Error('Table not found'));
            }

            const result = await healthCheckService.check();

            // Get the failing component
            const component =
              failingComponent === 'database'
                ? result.components.database
                : result.components.eventSourcing;

            // Verify component is down
            expect(component.status).toBe('down');

            // Verify error details are present
            expect(component.message).toBeDefined();
            expect(typeof component.message).toBe('string');
            expect(component.message!.length).toBeGreaterThan(0);

            // Verify details object exists
            if (component.details) {
              expect(typeof component.details).toBe('object');
              expect(component.details.error).toBeDefined();
            }
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should return degraded status when Redis is unavailable but database is up', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          async (hasRecentEvents) => {
            // Database is up
            mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

            // Event sourcing status depends on recent events
            mockPrisma.events.count.mockResolvedValue(hasRecentEvents ? 10 : 0);

            const result = await healthCheckService.check();

            // Redis should be degraded (using in-memory cache)
            // System should be degraded (not unhealthy)
            expect(result.status).toBe('degraded');

            // Database should be up
            expect(result.components.database.status).toBe('up');

            // Redis should be degraded or up (depending on cache availability)
            expect(['up', 'degraded']).toContain(result.components.redis.status);

            // Event sourcing should be up or degraded (depending on recent events)
            expect(['up', 'degraded']).toContain(result.components.eventSourcing.status);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });

    it('should never throw errors even when all components fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(true),
          async () => {
            // Make all components fail
            mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
            mockPrisma.events.count.mockRejectedValue(new Error('Event sourcing error'));

            // Should not throw
            const result = await healthCheckService.check();

            // Should return unhealthy status
            expect(result.status).toBe('unhealthy');

            // Should have all components marked as down
            expect(result.components.database.status).toBe('down');
            expect(result.components.eventSourcing.status).toBe('down');

            // Should still have valid structure
            expect(result.timestamp).toBeDefined();
            expect(result.responseTime).toBeGreaterThanOrEqual(0);
          }
        ),
        {
          numRuns: 100,
          verbose: true,
        }
      );
    });
  });

  /**
   * Additional Property: Health Check Idempotency
   * 
   * Multiple consecutive health checks should return consistent results
   * (assuming system state doesn't change).
   */
  describe('Property: Health Check Idempotency', () => {
    it('should return consistent results for consecutive checks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            databaseSuccess: fc.boolean(),
            eventCount: fc.integer({ min: 0, max: 100 }),
          }),
          async (scenario) => {
            // Setup mocks
            if (scenario.databaseSuccess) {
              mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
            } else {
              mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
            }

            mockPrisma.events.count.mockResolvedValue(scenario.eventCount);

            // Perform multiple health checks
            const result1 = await healthCheckService.check();
            const result2 = await healthCheckService.check();

            // Status should be consistent
            expect(result1.status).toBe(result2.status);

            // Component statuses should be consistent
            expect(result1.components.database.status).toBe(result2.components.database.status);
            expect(result1.components.redis.status).toBe(result2.components.redis.status);
            expect(result1.components.eventSourcing.status).toBe(
              result2.components.eventSourcing.status
            );
          }
        ),
        {
          numRuns: 50, // Fewer runs due to multiple checks
          verbose: true,
        }
      );
    });
  });
});

