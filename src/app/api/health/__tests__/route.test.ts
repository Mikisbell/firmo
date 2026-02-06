/**
 * Tests for Health Check API Endpoint
 * 
 * Tests the /api/health endpoint behavior including:
 * - HTTP status codes (200 for healthy/degraded, 503 for unhealthy)
 * - Response structure and content
 * - Error handling
 * - Cache headers
 * 
 * @module api/health/__tests__/route.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, HEAD } from '../route';
import type { HealthCheckResult } from '@/src/core/health/health-check';

// Mock dependencies
vi.mock('@/src/core/health/health-check', () => ({
  healthCheckService: {
    check: vi.fn(),
  },
}));

vi.mock('@/src/core/observability/structured-logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { healthCheckService } from '@/src/core/health/health-check';

describe('Health Check API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 when system is healthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'up',
            responseTime: 10,
            message: 'Database connection successful',
          },
          redis: {
            status: 'up',
            responseTime: 5,
            message: 'Redis connection successful',
          },
          eventSourcing: {
            status: 'up',
            responseTime: 15,
            message: 'Event sourcing operational',
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockResult);
    });

    it('should return 200 when system is degraded', async () => {
      const mockResult: HealthCheckResult = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'up',
            responseTime: 10,
          },
          redis: {
            status: 'degraded',
            responseTime: 5,
            message: 'Redis not configured',
          },
          eventSourcing: {
            status: 'up',
            responseTime: 15,
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('degraded');
    });

    it('should return 503 when system is unhealthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            responseTime: 10,
            message: 'Connection refused',
          },
          redis: {
            status: 'up',
            responseTime: 5,
          },
          eventSourcing: {
            status: 'up',
            responseTime: 15,
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
    });

    it('should include all component statuses in response', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'up',
            responseTime: 10,
          },
          redis: {
            status: 'up',
            responseTime: 5,
          },
          eventSourcing: {
            status: 'up',
            responseTime: 15,
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(data.components).toHaveProperty('database');
      expect(data.components).toHaveProperty('redis');
      expect(data.components).toHaveProperty('eventSourcing');
    });

    it('should include response time in result', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(data.responseTime).toBe(30);
    });

    it('should include timestamp in ISO 8601 format', async () => {
      const timestamp = new Date().toISOString();
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp,
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(data.timestamp).toBe(timestamp);
      expect(() => new Date(data.timestamp)).not.toThrow();
    });

    it('should set no-cache headers', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });

    it('should handle health check service errors gracefully', async () => {
      vi.mocked(healthCheckService.check).mockRejectedValue(new Error('Service error'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.error).toBe('Service error');
    });

    it('should return unhealthy status on unexpected errors', async () => {
      vi.mocked(healthCheckService.check).mockRejectedValue('Unknown error');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
    });
  });

  describe('HEAD /api/health', () => {
    it('should return 200 when system is healthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await HEAD();

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it('should return 200 when system is degraded', async () => {
      const mockResult: HealthCheckResult = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'degraded', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await HEAD();

      expect(response.status).toBe(200);
    });

    it('should return 503 when system is unhealthy', async () => {
      const mockResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'down', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await HEAD();

      expect(response.status).toBe(503);
    });

    it('should not include response body', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await HEAD();

      expect(response.body).toBeNull();
    });

    it('should set no-cache headers', async () => {
      const mockResult: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await HEAD();

      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(healthCheckService.check).mockRejectedValue(new Error('Service error'));

      const response = await HEAD();

      expect(response.status).toBe(503);
      expect(response.body).toBeNull();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle database connection errors', async () => {
      const mockResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            responseTime: 10,
            message: 'Connection refused',
            details: { error: 'ECONNREFUSED' },
          },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: { status: 'up', responseTime: 15 },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.components.database.status).toBe('down');
      expect(data.components.database.message).toContain('Connection refused');
    });

    it('should handle event sourcing errors', async () => {
      const mockResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: { status: 'up', responseTime: 10 },
          redis: { status: 'up', responseTime: 5 },
          eventSourcing: {
            status: 'down',
            responseTime: 15,
            message: 'Table not found',
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.components.eventSourcing.status).toBe('down');
    });

    it('should handle multiple component failures', async () => {
      const mockResult: HealthCheckResult = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            responseTime: 10,
            message: 'Database error',
          },
          redis: {
            status: 'degraded',
            responseTime: 5,
            message: 'Redis unavailable',
          },
          eventSourcing: {
            status: 'down',
            responseTime: 15,
            message: 'Event sourcing error',
          },
        },
        responseTime: 30,
      };

      vi.mocked(healthCheckService.check).mockResolvedValue(mockResult);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.components.database.status).toBe('down');
      expect(data.components.eventSourcing.status).toBe('down');
    });
  });
});
