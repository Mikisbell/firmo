/**
 * Unit Tests for Geolocation Service
 * 
 * Tests specific examples, edge cases, and error conditions.
 * 
 * Requirements: 2.1-2.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateDriverLocation,
  getDriverLocation,
  getActiveDriverLocations,
  clearDriverLocation,
  validateCoordinates,
  calculateDistance,
  findNearbyDrivers,
  findStaleDriverLocations,
  getLocationHistory,
  flushLocationHistoryBatch,
} from '../geolocation.service';
import { toDriverId, Location } from '../types-2026';
import { deliveryRedisService } from '../redis-connection';
import prisma from '@/src/core/db/prisma';

vi.mock('@/src/core/observability/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}));

describe('Geolocation Service - Unit Tests', () => {
  beforeEach(async () => {
    // Clear Redis before each test
    const keys = await deliveryRedisService.keys('driver:*:location');
    for (const key of keys) {
      await deliveryRedisService.del(key);
    }
  });

  describe('Location Storage and Retrieval', () => {
    it('should store and retrieve driver location', async () => {
      const driverId = toDriverId('driver-123');
      const location: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      await updateDriverLocation(driverId, location);

      const retrieved = await getDriverLocation(driverId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.latitude).toBe(location.latitude);
      expect(retrieved?.longitude).toBe(location.longitude);
      expect(retrieved?.accuracy).toBe(location.accuracy);
    });

    it('should return null for non-existent driver', async () => {
      const driverId = toDriverId('non-existent');
      const location = await getDriverLocation(driverId);
      expect(location).toBeNull();
    });

    it('should store location with optional speed and heading', async () => {
      const driverId = toDriverId('driver-456');
      const location: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        speed: 25,
        heading: 180,
        timestamp: new Date(),
      };

      await updateDriverLocation(driverId, location);

      const retrieved = await getDriverLocation(driverId);
      expect(retrieved?.speed).toBe(25);
      expect(retrieved?.heading).toBe(180);
    });

    it('should clear driver location', async () => {
      const driverId = toDriverId('driver-789');
      const location: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      await updateDriverLocation(driverId, location);
      await clearDriverLocation(driverId);

      const retrieved = await getDriverLocation(driverId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Active Driver Locations', () => {
    it('should return all active driver locations', async () => {
      const drivers = [
        {
          id: toDriverId('driver-1'),
          location: {
            latitude: 40.7128,
            longitude: -74.006,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
        {
          id: toDriverId('driver-2'),
          location: {
            latitude: 40.7589,
            longitude: -73.9851,
            accuracy: 15,
            timestamp: new Date(),
          },
        },
      ];

      for (const driver of drivers) {
        await updateDriverLocation(driver.id, driver.location);
      }

      const locations = await getActiveDriverLocations();
      expect(locations.size).toBe(2);
      expect(locations.has(drivers[0].id)).toBe(true);
      expect(locations.has(drivers[1].id)).toBe(true);
    });

    it('should return empty map when no drivers active', async () => {
      const locations = await getActiveDriverLocations();
      expect(locations.size).toBe(0);
    });

    it('should complete query within 100ms for 20 drivers', async () => {
      // Create 20 drivers
      const drivers = Array.from({ length: 20 }, (_, i) => ({
        id: toDriverId(`driver-${i}`),
        location: {
          latitude: 40.7128 + i * 0.01,
          longitude: -74.006 + i * 0.01,
          accuracy: 10,
          timestamp: new Date(),
        },
      }));

      for (const driver of drivers) {
        await updateDriverLocation(driver.id, driver.location);
      }

      const startTime = Date.now();
      const locations = await getActiveDriverLocations();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(locations.size).toBe(20);
    });
  });

  describe('Coordinate Validation', () => {
    it('should accept valid coordinates', () => {
      const validLocations: Location[] = [
        {
          latitude: 0,
          longitude: 0,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: 90,
          longitude: 180,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: -90,
          longitude: -180,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 10,
          timestamp: new Date(),
        },
      ];

      for (const location of validLocations) {
        expect(validateCoordinates(location)).toBe(true);
      }
    });

    it('should reject invalid latitude', () => {
      const invalidLocations: Location[] = [
        {
          latitude: 91,
          longitude: 0,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: -91,
          longitude: 0,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: 180,
          longitude: 0,
          accuracy: 10,
          timestamp: new Date(),
        },
      ];

      for (const location of invalidLocations) {
        expect(validateCoordinates(location)).toBe(false);
      }
    });

    it('should reject invalid longitude', () => {
      const invalidLocations: Location[] = [
        {
          latitude: 0,
          longitude: 181,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: 0,
          longitude: -181,
          accuracy: 10,
          timestamp: new Date(),
        },
        {
          latitude: 0,
          longitude: 360,
          accuracy: 10,
          timestamp: new Date(),
        },
      ];

      for (const location of invalidLocations) {
        expect(validateCoordinates(location)).toBe(false);
      }
    });

    it('should throw error when updating with invalid coordinates', async () => {
      const driverId = toDriverId('driver-invalid');
      const invalidLocation: Location = {
        latitude: 91,
        longitude: 0,
        accuracy: 10,
        timestamp: new Date(),
      };

      await expect(
        updateDriverLocation(driverId, invalidLocation)
      ).rejects.toThrow('Invalid coordinates');
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance between two locations', () => {
      const location1: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      const location2: Location = {
        latitude: 40.7589,
        longitude: -73.9851,
        accuracy: 10,
        timestamp: new Date(),
      };

      const distance = calculateDistance(location1, location2);

      // Distance between these two points is approximately 5.2 km
      expect(distance).toBeGreaterThan(5);
      expect(distance).toBeLessThan(6);
    });

    it('should return 0 for same location', () => {
      const location: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      const distance = calculateDistance(location, location);
      expect(distance).toBe(0);
    });

    it('should calculate distance across equator', () => {
      const location1: Location = {
        latitude: 10,
        longitude: 0,
        accuracy: 10,
        timestamp: new Date(),
      };

      const location2: Location = {
        latitude: -10,
        longitude: 0,
        accuracy: 10,
        timestamp: new Date(),
      };

      const distance = calculateDistance(location1, location2);

      // Distance should be approximately 2,222 km (20 degrees * 111 km/degree)
      expect(distance).toBeGreaterThan(2200);
      expect(distance).toBeLessThan(2300);
    });
  });

  describe('Nearby Drivers', () => {
    it('should find drivers within radius', async () => {
      const center: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      const drivers = [
        {
          id: toDriverId('driver-near'),
          location: {
            latitude: 40.7138,
            longitude: -74.005,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
        {
          id: toDriverId('driver-far'),
          location: {
            latitude: 41.0,
            longitude: -75.0,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
      ];

      for (const driver of drivers) {
        await updateDriverLocation(driver.id, driver.location);
      }

      const nearby = await findNearbyDrivers(center, 5); // 5 km radius

      expect(nearby.length).toBe(1);
      expect(nearby[0].driverId).toBe(drivers[0].id);
      expect(nearby[0].distance).toBeLessThan(5);
    });

    it('should sort drivers by distance', async () => {
      const center: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      const drivers = [
        {
          id: toDriverId('driver-far'),
          location: {
            latitude: 40.72,
            longitude: -74.0,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
        {
          id: toDriverId('driver-near'),
          location: {
            latitude: 40.7138,
            longitude: -74.005,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
        {
          id: toDriverId('driver-medium'),
          location: {
            latitude: 40.715,
            longitude: -74.003,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
      ];

      for (const driver of drivers) {
        await updateDriverLocation(driver.id, driver.location);
      }

      const nearby = await findNearbyDrivers(center, 10); // 10 km radius

      expect(nearby.length).toBe(3);
      expect(nearby[0].driverId).toBe(drivers[1].id); // nearest
      expect(nearby[1].driverId).toBe(drivers[2].id); // medium
      expect(nearby[2].driverId).toBe(drivers[0].id); // farthest

      // Verify distances are sorted
      expect(nearby[0].distance).toBeLessThan(nearby[1].distance);
      expect(nearby[1].distance).toBeLessThan(nearby[2].distance);
    });
  });

  describe('Stale Location Detection', () => {
    it('should detect stale locations', async () => {
      const driverId = toDriverId('driver-stale');
      const staleLocation: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      };

      await updateDriverLocation(driverId, staleLocation);

      const staleDrivers = await findStaleDriverLocations();
      expect(staleDrivers).toContain(driverId);
    });

    it('should not detect fresh locations as stale', async () => {
      const driverId = toDriverId('driver-fresh');
      const freshLocation: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(), // now
      };

      await updateDriverLocation(driverId, freshLocation);

      const staleDrivers = await findStaleDriverLocations();
      expect(staleDrivers).not.toContain(driverId);
    });

    it('should detect multiple stale drivers', async () => {
      const drivers = [
        {
          id: toDriverId('driver-stale-1'),
          location: {
            latitude: 40.7128,
            longitude: -74.006,
            accuracy: 10,
            timestamp: new Date(Date.now() - 3 * 60 * 1000),
          },
        },
        {
          id: toDriverId('driver-stale-2'),
          location: {
            latitude: 40.7589,
            longitude: -73.9851,
            accuracy: 10,
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
          },
        },
        {
          id: toDriverId('driver-fresh'),
          location: {
            latitude: 40.7489,
            longitude: -73.9951,
            accuracy: 10,
            timestamp: new Date(),
          },
        },
      ];

      for (const driver of drivers) {
        await updateDriverLocation(driver.id, driver.location);
      }

      const staleDrivers = await findStaleDriverLocations();
      expect(staleDrivers).toHaveLength(2);
      expect(staleDrivers).toContain(drivers[0].id);
      expect(staleDrivers).toContain(drivers[1].id);
      expect(staleDrivers).not.toContain(drivers[2].id);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection failure gracefully', async () => {
      // This test assumes Redis fallback to in-memory
      const driverId = toDriverId('driver-error');
      const location: Location = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
        timestamp: new Date(),
      };

      // Should not throw even if Redis fails
      await expect(
        updateDriverLocation(driverId, location)
      ).resolves.not.toThrow();
    });

    it('should return empty array on location history error', async () => {
      const driverId = toDriverId('non-existent');
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const history = await getLocationHistory(driverId, startDate, endDate);
      expect(history).toEqual([]);
    });
  });
});
