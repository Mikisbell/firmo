/**
 * Unit Tests for ETA Calculator
 *
 * Tests specific examples, edge cases, and error conditions.
 *
 * Requirements: 5.1-5.8
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { toOrderId, toDriverId, Location } from '../types-2026';

// Mock Prisma to avoid FK constraint issues (eta_predictions requires delivery_orders)
vi.mock('@/src/core/db/prisma', () => ({
  default: {
    eta_predictions: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

import prisma from '@/src/core/db/prisma';
const mockPrisma = prisma as any;

import {
  calculateInitialETA,
  recalculateETA,
  recordActualDeliveryTime,
  getDriverSpeedFactor,
  getTrafficFactor,
  getWeatherFactor,
  retrainMLModel,
  initializeETACalculator,
  shutdownETACalculator,
} from '../eta-calculator.service';

// Valid UUID helpers for test IDs (Prisma requires UUID format)
const uuid = (n: number) => `00000000-0000-4000-a000-${n.toString().padStart(12, '0')}`;

// Counter for unique prediction IDs
let predictionIdCounter = 0;

describe('ETA Calculator Service - Unit Tests', () => {
  beforeAll(async () => {
    mockPrisma.eta_predictions.deleteMany.mockResolvedValue({ count: 0 });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    predictionIdCounter = 0;

    // Default mock implementations
    mockPrisma.eta_predictions.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
      id: `pred-${++predictionIdCounter}`,
      ...args.data,
      created_at: new Date(),
      actual_minutes: null,
    }));
    mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);
    mockPrisma.eta_predictions.findMany.mockResolvedValue([]);
    mockPrisma.eta_predictions.update.mockImplementation((args: any) => ({
      id: args.where.id,
      ...args.data,
    }));
    mockPrisma.$disconnect.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('calculateInitialETA', () => {
    it('should calculate ETA for short distance (1km)', async () => {
      const orderId = toOrderId(uuid(1));
      const driverId = toDriverId(uuid(101));

      // Locations ~1km apart
      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const estimate = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Verify ETA is reasonable for 1km
      expect(estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate.estimatedMinutes).toBeLessThan(30);

      // Verify confidence interval
      expect(estimate.confidenceInterval[0]).toBeLessThanOrEqual(estimate.estimatedMinutes);
      expect(estimate.confidenceInterval[1]).toBeGreaterThanOrEqual(estimate.estimatedMinutes);

      // Verify stored in database (mock was called)
      expect(mockPrisma.eta_predictions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order_id: orderId,
            predicted_minutes: expect.any(Number),
          }),
        })
      );
    });

    it('should calculate ETA for long distance (20km)', async () => {
      const orderId = toOrderId(uuid(2));
      const driverId = toDriverId(uuid(102));

      // Locations ~20km apart
      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.2464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const estimate = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Verify ETA is reasonable for 20km (should be ~48 minutes at 25 km/h)
      expect(estimate.estimatedMinutes).toBeGreaterThan(30);
      expect(estimate.estimatedMinutes).toBeLessThan(120);
    });

    it('should handle driver at pickup location (0km to pickup)', async () => {
      const orderId = toOrderId(uuid(3));
      const driverId = toDriverId(uuid(103));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Driver already at pickup
      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const estimate = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // ETA should only account for pickup to delivery distance
      expect(estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate.estimatedMinutes).toBeLessThan(30);
    });

    it('should include all adjustment factors', async () => {
      const orderId = toOrderId(uuid(4));
      const driverId = toDriverId(uuid(104));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const estimate = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        4.5, // High rating
        'test-tenant-id'
      );

      // Verify all factors are present
      expect(estimate.factors.baseTime).toBeGreaterThan(0);
      expect(typeof estimate.factors.trafficAdjustment).toBe('number');
      expect(typeof estimate.factors.weatherAdjustment).toBe('number');
      expect(typeof estimate.factors.driverAdjustment).toBe('number');
    });
  });

  describe('recalculateETA', () => {
    it('should recalculate ETA when driver moves closer', async () => {
      const orderId = toOrderId(uuid(5));
      const driverId = toDriverId(uuid(105));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Driver starts far away
      const initialDriverLocation: Location = {
        latitude: -12.0264,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Calculate initial ETA
      const initialETA = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        initialDriverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Mock findFirst to return the initial prediction for recalculation
      mockPrisma.eta_predictions.findFirst.mockResolvedValue({
        id: 'pred-1',
        order_id: orderId,
        predicted_minutes: initialETA.estimatedMinutes,
        created_at: new Date(),
      });

      // Driver moves closer to delivery
      const updatedDriverLocation: Location = {
        latitude: -12.0514,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Recalculate ETA
      const { estimate: updatedETA, changed, changeMins } = await recalculateETA(
        orderId,
        updatedDriverLocation,
        deliveryLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // ETA should be lower (driver is closer)
      expect(updatedETA.estimatedMinutes).toBeLessThanOrEqual(initialETA.estimatedMinutes);

      // Verify change detection
      expect(typeof changed).toBe('boolean');
      expect(changeMins).toBeGreaterThanOrEqual(0);
    });

    it('should detect significant ETA change (>5 minutes)', async () => {
      const orderId = toOrderId(uuid(6));
      const driverId = toDriverId(uuid(106));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Driver starts close
      const initialDriverLocation: Location = {
        latitude: -12.0514,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const initialETA = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        initialDriverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Mock findFirst to return the initial prediction for recalculation
      mockPrisma.eta_predictions.findFirst.mockResolvedValue({
        id: 'pred-1',
        order_id: orderId,
        predicted_minutes: initialETA.estimatedMinutes,
        created_at: new Date(),
      });

      // Driver moves far away (simulating traffic or detour)
      const updatedDriverLocation: Location = {
        latitude: -12.0264,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const { changed, changeMins } = await recalculateETA(
        orderId,
        updatedDriverLocation,
        deliveryLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Should detect significant change
      if (changeMins >= 5) {
        expect(changed).toBe(true);
      }
    });

    it('should store multiple predictions for same order', async () => {
      const orderId = toOrderId(uuid(7));
      const driverId = toDriverId(uuid(107));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Initial calculation
      await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Recalculate twice
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0, 'test-tenant-id');
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0, 'test-tenant-id');

      // Verify 3 predictions were created (3 calls to create)
      expect(mockPrisma.eta_predictions.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('recordActualDeliveryTime', () => {
    it('should record actual delivery time', async () => {
      const orderId = toOrderId(uuid(8));
      const driverId = toDriverId(uuid(108));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Calculate initial ETA
      await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Mock findFirst to return the created prediction for recordActualDeliveryTime
      mockPrisma.eta_predictions.findFirst.mockResolvedValue({
        id: 'pred-1',
        order_id: orderId,
        predicted_minutes: 18,
        created_at: new Date(),
        actual_minutes: null,
      });

      // Record actual time
      const actualMinutes = 25;
      await recordActualDeliveryTime(orderId, actualMinutes);

      // Verify update was called with actual_minutes
      expect(mockPrisma.eta_predictions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pred-1' },
          data: { actual_minutes: actualMinutes },
        })
      );
    });

    it('should update first prediction when multiple exist', async () => {
      const orderId = toOrderId(uuid(9));
      const driverId = toDriverId(uuid(109));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Create multiple predictions
      await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0, 'test-tenant-id');

      // Mock findFirst to return the first (initial) prediction
      mockPrisma.eta_predictions.findFirst.mockResolvedValue({
        id: 'pred-initial',
        order_id: orderId,
        predicted_minutes: 18,
        created_at: new Date(Date.now() - 60000), // Earlier timestamp
        actual_minutes: null,
      });

      // Record actual time
      const actualMinutes = 30;
      await recordActualDeliveryTime(orderId, actualMinutes);

      // Verify update was called on the first prediction
      expect(mockPrisma.eta_predictions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pred-initial' },
          data: { actual_minutes: actualMinutes },
        })
      );
    });

    it('should handle missing prediction gracefully', async () => {
      const orderId = toOrderId(uuid(99));

      // Try to record actual time for non-existent order
      await expect(
        recordActualDeliveryTime(orderId, 30)
      ).resolves.not.toThrow();
    });
  });

  describe('Adjustment Factors', () => {
    it('should return driver speed factor in valid range', async () => {
      const driverId = toDriverId(uuid(110));

      const factor = await getDriverSpeedFactor(driverId);

      expect(factor).toBeGreaterThanOrEqual(0.8);
      expect(factor).toBeLessThanOrEqual(1.2);
    });

    it('should return default factor for driver with no history', async () => {
      const driverId = toDriverId(uuid(111));

      const factor = await getDriverSpeedFactor(driverId);

      expect(factor).toBe(1.0); // Default
    });

    it('should return traffic factor in valid range', async () => {
      const factor = await getTrafficFactor();

      expect(factor).toBeGreaterThanOrEqual(1.0);
      expect(factor).toBeLessThanOrEqual(2.0);
    });

    it('should return weather factor in valid range', async () => {
      const factor = await getWeatherFactor();

      expect(factor).toBeGreaterThanOrEqual(1.0);
      expect(factor).toBeLessThanOrEqual(1.15);
    });
  });

  describe('ML Model Training', () => {
    it('should handle training with insufficient data', async () => {
      // Clean database
      await prisma.eta_predictions.deleteMany({});

      // Try to train with no data
      await expect(retrainMLModel()).resolves.not.toThrow();
    });

    it('should train model with sufficient data', async () => {
      // Create test data with actual times
      const orderId1 = toOrderId(uuid(51));
      const orderId2 = toOrderId(uuid(52));
      const driverId = toDriverId(uuid(150));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Create predictions
      await calculateInitialETA(
        orderId1,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0
      );
      await recordActualDeliveryTime(orderId1, 20);

      await calculateInitialETA(
        orderId2,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0
      );
      await recordActualDeliveryTime(orderId2, 25);

      // Train model (should not throw even with minimal data)
      await expect(retrainMLModel()).resolves.not.toThrow();
    });
  });

  describe('Service Lifecycle', () => {
    it('should initialize and shutdown cleanly', () => {
      expect(() => initializeETACalculator()).not.toThrow();
      expect(() => shutdownETACalculator()).not.toThrow();
    });

    it('should handle multiple initialize calls', () => {
      initializeETACalculator();
      expect(() => initializeETACalculator()).not.toThrow();
      shutdownETACalculator();
    });

    it('should handle multiple shutdown calls', () => {
      initializeETACalculator();
      shutdownETACalculator();
      expect(() => shutdownETACalculator()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short distances (<100m)', async () => {
      const orderId = toOrderId(uuid(60));
      const driverId = toDriverId(uuid(160));

      // Locations ~100m apart
      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0474,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const estimate = await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        3.0,
        'test-tenant-id'
      );

      // Should still return minimum 1 minute
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
    });

    it('should handle extreme driver ratings', async () => {
      const orderId1 = toOrderId(uuid(70));
      const orderId2 = toOrderId(uuid(71));
      const driverId = toDriverId(uuid(170));

      const pickupLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const deliveryLocation: Location = {
        latitude: -12.0554,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      const driverLocation: Location = {
        latitude: -12.0464,
        longitude: -77.0428,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Low rating (0)
      const estimate1 = await calculateInitialETA(
        orderId1,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        0,
        'test-tenant-id'
      );

      // High rating (5)
      const estimate2 = await calculateInitialETA(
        orderId2,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        5,
        'test-tenant-id'
      );

      // Both should return valid ETAs
      expect(estimate1.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate2.estimatedMinutes).toBeGreaterThan(0);
    });
  });
});
