/**
 * Unit Tests for ETA Calculator
 * 
 * Tests specific examples, edge cases, and error conditions.
 * 
 * Requirements: 5.1-5.8
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
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
import { toOrderId, toDriverId, Location } from '../types-2026';
import prisma from '@/src/core/db/prisma';

describe('ETA Calculator Service - Unit Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.eta_predictions.deleteMany({});
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.eta_predictions.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('calculateInitialETA', () => {
    it('should calculate ETA for short distance (1km)', async () => {
      const orderId = toOrderId('test-order-1');
      const driverId = toDriverId('test-driver-1');

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
        3.0
      );

      // Verify ETA is reasonable for 1km
      expect(estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate.estimatedMinutes).toBeLessThan(30);

      // Verify confidence interval
      expect(estimate.confidenceInterval[0]).toBeLessThanOrEqual(estimate.estimatedMinutes);
      expect(estimate.confidenceInterval[1]).toBeGreaterThanOrEqual(estimate.estimatedMinutes);

      // Verify stored in database
      const stored = await prisma.eta_predictions.findFirst({
        where: { order_id: orderId },
      });
      expect(stored).toBeDefined();
    });

    it('should calculate ETA for long distance (20km)', async () => {
      const orderId = toOrderId('test-order-2');
      const driverId = toDriverId('test-driver-2');

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
        3.0
      );

      // Verify ETA is reasonable for 20km (should be ~48 minutes at 25 km/h)
      expect(estimate.estimatedMinutes).toBeGreaterThan(30);
      expect(estimate.estimatedMinutes).toBeLessThan(120);
    });

    it('should handle driver at pickup location (0km to pickup)', async () => {
      const orderId = toOrderId('test-order-3');
      const driverId = toDriverId('test-driver-3');

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
        3.0
      );

      // ETA should only account for pickup to delivery distance
      expect(estimate.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate.estimatedMinutes).toBeLessThan(30);
    });

    it('should include all adjustment factors', async () => {
      const orderId = toOrderId('test-order-4');
      const driverId = toDriverId('test-driver-4');

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
        4.5 // High rating
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
      const orderId = toOrderId('test-order-5');
      const driverId = toDriverId('test-driver-5');

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
        3.0
      );

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
        3.0
      );

      // ETA should be lower (driver is closer)
      expect(updatedETA.estimatedMinutes).toBeLessThanOrEqual(initialETA.estimatedMinutes);

      // Verify change detection
      expect(typeof changed).toBe('boolean');
      expect(changeMins).toBeGreaterThanOrEqual(0);
    });

    it('should detect significant ETA change (>5 minutes)', async () => {
      const orderId = toOrderId('test-order-6');
      const driverId = toDriverId('test-driver-6');

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

      await calculateInitialETA(
        orderId,
        pickupLocation,
        deliveryLocation,
        initialDriverLocation,
        driverId,
        3.0
      );

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
        3.0
      );

      // Should detect significant change
      if (changeMins >= 5) {
        expect(changed).toBe(true);
      }
    });

    it('should store multiple predictions for same order', async () => {
      const orderId = toOrderId('test-order-7');
      const driverId = toDriverId('test-driver-7');

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
        3.0
      );

      // Recalculate twice
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0);
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0);

      // Verify 3 predictions stored
      const predictions = await prisma.eta_predictions.findMany({
        where: { order_id: orderId },
      });

      expect(predictions.length).toBe(3);
    });
  });

  describe('recordActualDeliveryTime', () => {
    it('should record actual delivery time', async () => {
      const orderId = toOrderId('test-order-8');
      const driverId = toDriverId('test-driver-8');

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
        3.0
      );

      // Record actual time
      const actualMinutes = 25;
      await recordActualDeliveryTime(orderId, actualMinutes);

      // Verify stored
      const prediction = await prisma.eta_predictions.findFirst({
        where: { order_id: orderId },
      });

      expect(prediction?.actual_minutes).toBe(actualMinutes);
    });

    it('should update first prediction when multiple exist', async () => {
      const orderId = toOrderId('test-order-9');
      const driverId = toDriverId('test-driver-9');

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
        3.0
      );
      await recalculateETA(orderId, driverLocation, deliveryLocation, driverId, 3.0);

      // Record actual time
      const actualMinutes = 30;
      await recordActualDeliveryTime(orderId, actualMinutes);

      // Verify first prediction has actual time
      const predictions = await prisma.eta_predictions.findMany({
        where: { order_id: orderId },
        orderBy: { created_at: 'asc' },
      });

      expect(predictions[0].actual_minutes).toBe(actualMinutes);
    });

    it('should handle missing prediction gracefully', async () => {
      const orderId = toOrderId('test-order-nonexistent');

      // Try to record actual time for non-existent order
      await expect(
        recordActualDeliveryTime(orderId, 30)
      ).resolves.not.toThrow();
    });
  });

  describe('Adjustment Factors', () => {
    it('should return driver speed factor in valid range', async () => {
      const driverId = toDriverId('test-driver-10');

      const factor = await getDriverSpeedFactor(driverId);

      expect(factor).toBeGreaterThanOrEqual(0.8);
      expect(factor).toBeLessThanOrEqual(1.2);
    });

    it('should return default factor for driver with no history', async () => {
      const driverId = toDriverId('test-driver-new');

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
      const orderId1 = toOrderId('test-order-ml-1');
      const orderId2 = toOrderId('test-order-ml-2');
      const driverId = toDriverId('test-driver-ml');

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
      const orderId = toOrderId('test-order-short');
      const driverId = toDriverId('test-driver-short');

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
        3.0
      );

      // Should still return minimum 1 minute
      expect(estimate.estimatedMinutes).toBeGreaterThanOrEqual(1);
    });

    it('should handle extreme driver ratings', async () => {
      const orderId1 = toOrderId('test-order-rating-low');
      const orderId2 = toOrderId('test-order-rating-high');
      const driverId = toDriverId('test-driver-rating');

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
        0
      );

      // High rating (5)
      const estimate2 = await calculateInitialETA(
        orderId2,
        pickupLocation,
        deliveryLocation,
        driverLocation,
        driverId,
        5
      );

      // Both should return valid ETAs
      expect(estimate1.estimatedMinutes).toBeGreaterThan(0);
      expect(estimate2.estimatedMinutes).toBeGreaterThan(0);
    });
  });
});
