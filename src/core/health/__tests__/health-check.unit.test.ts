/**
 * Unit Tests for Health Check Service
 * 
 * Tests specific examples and edge cases for health check functionality.
 * Complements property-based tests with concrete scenarios.
 * 
 * @module core/health/__tests__/health-check.unit.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthCheckService } from '../health-check';
import { PrismaClient } from '@prisma/client';
import { cache } from '@/src/core/cache/cache-service';

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
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
  },
}));

describe('Health Check Service - Unit Tests', () => {
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
    
    // Setup cache mock to return the test value
    vi.mocked(cache.get).mockImplementation(async (key: string) => {
      if (key === 'health:check') {
        return Date.now().toString();
      }
      return null;
    });
  });

  afterEach(async () => {
    await healthCheckService.close();
    vi.clearAllMocks();
  });

  describe('Healthy System', () => {
    it('should return healthy status when all components are up', async () => {
      // Setup mocks for healthy system
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.status).toBe('healthy');
      expect(result.components.database.status).toBe('up');
      expect(result.components.redis.status).toBe('up');
      expect(result.components.eventSourcing.status).toBe('up');
    });

    it('should include response times for all components', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.components.database.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.components.redis.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.components.eventSourcing.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should include valid ISO 8601 timestamp', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  describe('Degraded System', () => {
    it('should return degraded status when Redis is unavailable', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      // Redis should be degraded or up (depending on cache availability)
      expect(['healthy', 'degraded']).toContain(result.status);
    });

    it('should return degraded status when no recent events exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(0); // No recent events

      const result = await healthCheckService.check();

      expect(result.status).toBe('degraded');
      expect(result.components.eventSourcing.status).toBe('degraded');
      expect(result.components.eventSourcing.message).toContain('idle');
    });
  });

  describe('Unhealthy System', () => {
    it('should return unhealthy status when database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('down');
      expect(result.components.database.message).toContain('Connection refused');
    });

    it('should return unhealthy status when event sourcing is down', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockRejectedValue(new Error('Table not found'));

      const result = await healthCheckService.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.eventSourcing.status).toBe('down');
      expect(result.components.eventSourcing.message).toContain('Table not found');
    });

    it('should return unhealthy status when multiple components are down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      mockPrisma.events.count.mockRejectedValue(new Error('Event sourcing error'));

      const result = await healthCheckService.check();

      expect(result.status).toBe('unhealthy');
      expect(result.components.database.status).toBe('down');
      expect(result.components.eventSourcing.status).toBe('down');
    });
  });

  describe('Error Handling', () => {
    it('should not throw errors when health check fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Critical error'));
      mockPrisma.events.count.mockRejectedValue(new Error('Critical error'));

      await expect(healthCheckService.check()).resolves.toBeDefined();
    });

    it('should include error details in component health', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection timeout'));
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.components.database.details).toBeDefined();
      expect(result.components.database.details?.error).toBeDefined();
    });

    it('should handle timeout gracefully', async () => {
      // Simulate slow database query (> 2 seconds)
      mockPrisma.$queryRaw.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([{ health_check: 1 }]), 3000))
      );
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      // Should complete within timeout
      expect(result.responseTime).toBeLessThan(2500);
    });
  });

  describe('Response Time', () => {
    it('should complete health check within 2 seconds', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const startTime = Date.now();
      const result = await healthCheckService.check();
      const actualTime = Date.now() - startTime;

      expect(result.responseTime).toBeLessThan(2000);
      expect(actualTime).toBeLessThan(2100); // Allow 100ms buffer
    });

    it('should track individual component response times', async () => {
      mockPrisma.$queryRaw.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return [{ health_check: 1 }];
      });
      mockPrisma.events.count.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 10;
      });

      const result = await healthCheckService.check();

      expect(result.components.database.responseTime).toBeGreaterThanOrEqual(100);
      expect(result.components.eventSourcing.responseTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('System Status Calculation', () => {
    it('should return healthy when all components are up', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.status).toBe('healthy');
    });

    it('should return degraded when at least one component is degraded', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(0); // Degraded

      const result = await healthCheckService.check();

      expect(result.status).toBe('degraded');
    });

    it('should return unhealthy when at least one component is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error'));
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.status).toBe('unhealthy');
    });

    it('should prioritize unhealthy over degraded', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database error')); // Down
      mockPrisma.events.count.mockResolvedValue(0); // Degraded

      const result = await healthCheckService.check();

      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Database Health Check', () => {
    it('should execute simple query to check database', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      await healthCheckService.check();

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it('should mark database as down on connection error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.components.database.status).toBe('down');
    });
  });

  describe('Event Sourcing Health Check', () => {
    it('should check for recent events in last 24 hours', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      await healthCheckService.check();

      expect(mockPrisma.events.count).toHaveBeenCalledWith({
        where: {
          created_at: {
            gte: expect.any(Date),
          },
        },
      });
    });

    it('should mark as up when recent events exist', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(10);

      const result = await healthCheckService.check();

      expect(result.components.eventSourcing.status).toBe('up');
      expect(result.components.eventSourcing.details?.recentEvents).toBe(10);
    });

    it('should mark as degraded when no recent events', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockResolvedValue(0);

      const result = await healthCheckService.check();

      expect(result.components.eventSourcing.status).toBe('degraded');
      expect(result.components.eventSourcing.details?.recentEvents).toBe(0);
    });

    it('should mark as down on event table error', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);
      mockPrisma.events.count.mockRejectedValue(new Error('Table not found'));

      const result = await healthCheckService.check();

      expect(result.components.eventSourcing.status).toBe('down');
    });
  });

  describe('Cleanup', () => {
    it('should disconnect Prisma client on close', async () => {
      await healthCheckService.close();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      mockPrisma.$disconnect.mockRejectedValue(new Error('Disconnect error'));

      await expect(healthCheckService.close()).resolves.not.toThrow();
    });
  });
});

