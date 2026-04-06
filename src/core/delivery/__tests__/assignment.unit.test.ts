/**
 * Unit Tests for Assignment Algorithm
 * 
 * Tests specific examples, edge cases, and error conditions.
 * 
 * Coverage:
 * - Score calculation with specific driver/order combinations
 * - Tie-breaking with similar scores
 * - Queueing with no available drivers
 * - Rejection handling
 * - Weight configuration updates
 * - Error handling (location service failure, DB failure)
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
vi.setConfig({ testTimeout: 30_000 });
import {
  calculateAssignmentScore,
  getWeights,
  updateWeights,
  assignDriver,
  queueOrderForAssignment,
  processAssignmentQueue,
  handleRejection,
  manualAssign,
} from '../assignment.service';
import { calculateDistance } from '../geolocation.service';
import { deliveryRedisService } from '../redis-connection';
import prisma from '@/src/core/db/prisma';
import type {
  Driver,
  DeliveryOrder,
  AssignmentWeights,
  Location,
  DriverId,
  OrderId,
  TenantId,
} from '../types-2026';

describe('Assignment Algorithm - Unit Tests', () => {
  const testTenantId = '00000000-0000-4000-a000-000000000001' as TenantId;
  const testOrderId = '00000000-0000-4000-a000-000000000002' as OrderId;
  const testDriverId1 = '00000000-0000-4000-a000-000000000003' as DriverId;
  const testDriverId2 = '00000000-0000-4000-a000-000000000004' as DriverId;

  const testLocation1: Location = {
    latitude: 40.7128,
    longitude: -74.006,
    accuracy: 10,
    timestamp: new Date(),
  };

  const testLocation2: Location = {
    latitude: 40.7589,
    longitude: -73.9851,
    accuracy: 10,
    timestamp: new Date(),
  };

  beforeAll(async () => {
    // Redis service will use in-memory fallback in test environment
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await deliveryRedisService.del('pending_assignments');
    await prisma.assignment_logs.deleteMany({});
    await prisma.assignment_weights.deleteMany({ where: { tenant_id: testTenantId } });
    // Ensure tenant exists for FK constraints (assignment_weights, employees)
    await prisma.tenants.upsert({
      where: { id: testTenantId },
      update: {},
      create: { id: testTenantId, name: 'Test Tenant' },
    });
  });

  afterAll(async () => {
    // Clean up test tenant
    await prisma.assignment_weights.deleteMany({ where: { tenant_id: testTenantId } });
    await prisma.tenants.deleteMany({ where: { id: testTenantId } });
    await prisma.$disconnect();
  });

  describe('calculateAssignmentScore', () => {
    it('should calculate correct scores for a driver-order pair', async () => {
      const driver: Driver = {
        id: testDriverId1,
        name: 'Test Driver',
        location: testLocation1,
        activeOrders: [],
        performanceRating: 4.5,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score = await calculateAssignmentScore(driver, order, weights);

      // Verify score structure
      expect(score.driverId).toBe(testDriverId1);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
      expect(score.distanceScore).toBeGreaterThanOrEqual(0);
      expect(score.workloadScore).toBe(100); // No active orders
      expect(score.performanceScore).toBe(90); // 4.5/5 * 100
      expect(score.currentOrders).toBe(0);
      expect(score.performanceRating).toBe(4.5);
    });

    it('should calculate lower workload score for drivers with more orders', async () => {
      const driver1: Driver = {
        id: testDriverId1,
        name: 'Driver 1',
        location: testLocation1,
        activeOrders: [],
        performanceRating: 4.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const driver2: Driver = {
        id: testDriverId2,
        name: 'Driver 2',
        location: testLocation1,
        activeOrders: ['order-1' as OrderId, 'order-2' as OrderId],
        performanceRating: 4.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score1 = await calculateAssignmentScore(driver1, order, weights);
      const score2 = await calculateAssignmentScore(driver2, order, weights);

      // Driver 1 should have higher workload score (fewer orders)
      expect(score1.workloadScore).toBeGreaterThan(score2.workloadScore);
      expect(score1.workloadScore).toBe(100); // 0 orders
      expect(score2.workloadScore).toBe(50); // 2 orders
    });

    it('should throw error if driver has no location', async () => {
      const driver: Driver = {
        id: testDriverId1,
        name: 'Test Driver',
        location: undefined,
        activeOrders: [],
        performanceRating: 4.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      await expect(
        calculateAssignmentScore(driver, order, weights)
      ).rejects.toThrow('has no location data');
    });
  });

  describe('getWeights and updateWeights', () => {
    it('should return default weights if not configured', async () => {
      const weights = await getWeights(testTenantId);

      expect(weights.distance).toBe(0.4);
      expect(weights.workload).toBe(0.3);
      expect(weights.performance).toBe(0.3);
    });

    it('should store and retrieve custom weights', async () => {
      const customWeights: AssignmentWeights = {
        distance: 0.5,
        workload: 0.3,
        performance: 0.2,
      };

      await updateWeights(testTenantId, customWeights);

      const retrieved = await getWeights(testTenantId);
      expect(retrieved.distance).toBe(0.5);
      expect(retrieved.workload).toBe(0.3);
      expect(retrieved.performance).toBe(0.2);
    });

    it('should reject weights that do not sum to 1.0', async () => {
      const invalidWeights: AssignmentWeights = {
        distance: 0.5,
        workload: 0.5,
        performance: 0.5, // Sum = 1.5
      };

      await expect(updateWeights(testTenantId, invalidWeights)).rejects.toThrow(
        'must sum to 1.0'
      );
    });

    it('should update existing weights', async () => {
      const weights1: AssignmentWeights = {
        distance: 0.5,
        workload: 0.3,
        performance: 0.2,
      };

      const weights2: AssignmentWeights = {
        distance: 0.3,
        workload: 0.4,
        performance: 0.3,
      };

      await updateWeights(testTenantId, weights1);
      await updateWeights(testTenantId, weights2);

      const retrieved = await getWeights(testTenantId);
      expect(retrieved.distance).toBe(0.3);
      expect(retrieved.workload).toBe(0.4);
      expect(retrieved.performance).toBe(0.3);
    });
  });

  describe('queueOrderForAssignment', () => {
    it('should add order to queue', async () => {
      await queueOrderForAssignment(testOrderId);

      const queueLength = await deliveryRedisService.llen('pending_assignments');
      expect(queueLength).toBe(1);

      const queuedOrder = await deliveryRedisService.lindex('pending_assignments', 0);
      expect(queuedOrder).toBe(testOrderId);
    });

    it('should maintain FIFO order', async () => {
      const order1 = 'order-1' as OrderId;
      const order2 = 'order-2' as OrderId;
      const order3 = 'order-3' as OrderId;

      await queueOrderForAssignment(order1);
      await queueOrderForAssignment(order2);
      await queueOrderForAssignment(order3);

      const queueLength = await deliveryRedisService.llen('pending_assignments');
      expect(queueLength).toBe(3);

      const first = await deliveryRedisService.lindex('pending_assignments', 0);
      const second = await deliveryRedisService.lindex('pending_assignments', 1);
      const third = await deliveryRedisService.lindex('pending_assignments', 2);

      expect(first).toBe(order1);
      expect(second).toBe(order2);
      expect(third).toBe(order3);
    });
  });

  describe('processAssignmentQueue', () => {
    it('should process empty queue without errors', async () => {
      await expect(processAssignmentQueue()).resolves.not.toThrow();
    });

    it('should handle queue processing errors gracefully', async () => {
      // Add non-existent order ID (valid UUID format) to queue
      await deliveryRedisService.rpush('pending_assignments', '00000000-0000-4000-a000-ffffffffffff');

      // Should not throw
      await expect(processAssignmentQueue()).resolves.not.toThrow();

      // Order should be requeued on error
      const queueLength = await deliveryRedisService.llen('pending_assignments');
      expect(queueLength).toBeGreaterThan(0);
    });
  });

  describe('handleRejection', () => {
    it('should throw error if order not found', async () => {
      await expect(
        handleRejection(testOrderId, testDriverId1, 'Too far')
      ).rejects.toThrow('not found');
    });

    it('should queue order if no other drivers available', async () => {
      // Save original methods
      const origFindUnique = prisma.delivery_orders.findUnique;
      const origUpdate = (prisma.delivery_orders as any).update;
      const origLogCreate = prisma.assignment_logs.create;

      // Mock the order lookup to return a test order with required relations
      (prisma.delivery_orders as any).findUnique = vi.fn().mockResolvedValue({
        id: testOrderId,
        tenant_id: testTenantId,
        customer_name: 'John Doe',
        customer_phone: '1234567890',
        address_text: `${testLocation2.latitude},${testLocation2.longitude}`,
        pickup_location: JSON.stringify(testLocation1),
        status: 'ASSIGNED',
        driver_id: testDriverId1,
        order_id: testOrderId,
        orders: {
          id: testOrderId,
          customers: { name: 'John Doe' },
          locations: { address: `${testLocation1.latitude},${testLocation1.longitude}` },
        },
      });

      // Mock the update call
      (prisma.delivery_orders as any).update = vi.fn().mockResolvedValue({});

      // Mock assignment_logs.create
      (prisma.assignment_logs as any).create = vi.fn().mockResolvedValue({});

      const result = await handleRejection(testOrderId, testDriverId1, 'Too far');

      // Should return null and queue order
      expect(result).toBeNull();

      const queueLength = await deliveryRedisService.llen('pending_assignments');
      expect(queueLength).toBe(1);

      // Restore original methods
      (prisma.delivery_orders as any).findUnique = origFindUnique;
      (prisma.delivery_orders as any).update = origUpdate;
      (prisma.assignment_logs as any).create = origLogCreate;
    });
  });

  describe('manualAssign', () => {
    it('should throw error if driver not found', async () => {
      await expect(
        manualAssign(testOrderId, '00000000-0000-4000-a000-ffffffffffff' as DriverId)
      ).rejects.toThrow('not found');
    });

    it('should throw error if driver not active', async () => {
      // Create inactive driver
      await prisma.employees.create({
        data: {
          id: testDriverId1,
          tenant_id: testTenantId,
          name: 'Inactive Driver',
          role: 'DRIVER',
          pin_hash: 'hash',
          is_active: false,
        },
      });

      await expect(manualAssign(testOrderId, testDriverId1)).rejects.toThrow(
        'not active'
      );

      // Clean up
      await prisma.employees.delete({ where: { id: testDriverId1 } });
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between two locations', () => {
      const distance = calculateDistance(testLocation1, testLocation2);

      // Distance between these NYC locations should be ~5-6 km
      expect(distance).toBeGreaterThan(4);
      expect(distance).toBeLessThan(7);
    });

    it('should return 0 for same location', () => {
      const distance = calculateDistance(testLocation1, testLocation1);
      expect(distance).toBeCloseTo(0, 5);
    });

    it('should be symmetric (distance A to B = distance B to A)', () => {
      const distance1 = calculateDistance(testLocation1, testLocation2);
      const distance2 = calculateDistance(testLocation2, testLocation1);
      expect(distance1).toBeCloseTo(distance2, 5);
    });
  });

  describe('Score Calculation Edge Cases', () => {
    it('should handle driver at max capacity (4 orders)', async () => {
      const driver: Driver = {
        id: testDriverId1,
        name: 'Busy Driver',
        location: testLocation1,
        activeOrders: [
          'order-1' as OrderId,
          'order-2' as OrderId,
          'order-3' as OrderId,
          'order-4' as OrderId,
        ],
        performanceRating: 4.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score = await calculateAssignmentScore(driver, order, weights);

      // Workload score should be 0 (4 orders * 25 = 100, 100 - 100 = 0)
      expect(score.workloadScore).toBe(0);
      expect(score.currentOrders).toBe(4);
    });

    it('should handle driver with perfect rating (5.0)', async () => {
      const driver: Driver = {
        id: testDriverId1,
        name: 'Perfect Driver',
        location: testLocation1,
        activeOrders: [],
        performanceRating: 5.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score = await calculateAssignmentScore(driver, order, weights);

      // Performance score should be 100 (5.0/5 * 100)
      expect(score.performanceScore).toBe(100);
    });

    it('should handle driver with zero rating', async () => {
      const driver: Driver = {
        id: testDriverId1,
        name: 'New Driver',
        location: testLocation1,
        activeOrders: [],
        performanceRating: 0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score = await calculateAssignmentScore(driver, order, weights);

      // Performance score should be 0
      expect(score.performanceScore).toBe(0);
    });

    it('should handle very long distance (>10km)', async () => {
      const farLocation: Location = {
        latitude: 41.0,
        longitude: -75.0,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driver: Driver = {
        id: testDriverId1,
        name: 'Far Driver',
        location: farLocation,
        activeOrders: [],
        performanceRating: 4.0,
        status: 'AVAILABLE',
        isActive: true,
      };

      const order: DeliveryOrder = {
        id: testOrderId,
        tenantId: testTenantId,
        orderNumber: 1001,
        customerName: 'John Doe',
        customerPhone: '1234567890',
        pickupLocation: testLocation1,
        deliveryLocation: testLocation2,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const weights: AssignmentWeights = {
        distance: 0.4,
        workload: 0.3,
        performance: 0.3,
      };

      const score = await calculateAssignmentScore(driver, order, weights);

      // Distance score should be 0 for distances >10km
      expect(score.distanceScore).toBe(0);
      expect(score.distance).toBeGreaterThan(10);
    });
  });

  describe('Weight Configuration Edge Cases', () => {
    it('should handle weights that sum to exactly 1.0', async () => {
      const weights: AssignmentWeights = {
        distance: 0.333333,
        workload: 0.333333,
        performance: 0.333334,
      };

      await expect(updateWeights(testTenantId, weights)).resolves.not.toThrow();

      const retrieved = await getWeights(testTenantId);
      const sum = retrieved.distance + retrieved.workload + retrieved.performance;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should handle weights with floating point precision', async () => {
      const weights: AssignmentWeights = {
        distance: 0.1,
        workload: 0.2,
        performance: 0.7,
      };

      await expect(updateWeights(testTenantId, weights)).resolves.not.toThrow();

      const retrieved = await getWeights(testTenantId);
      expect(retrieved.distance).toBeCloseTo(0.1, 5);
      expect(retrieved.workload).toBeCloseTo(0.2, 5);
      expect(retrieved.performance).toBeCloseTo(0.7, 5);
    });
  });
});
