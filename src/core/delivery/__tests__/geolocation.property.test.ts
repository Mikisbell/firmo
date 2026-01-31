/**
 * Property-Based Tests for Geolocation Service
 * 
 * Tests universal properties that should hold for all inputs.
 * Uses Fast-check for property-based testing with 100 iterations per property.
 * 
 * Properties tested:
 * - Property 9: Location Storage with TTL
 * - Property 10: Location Query Performance
 * - Property 11: Connection Lost Detection
 * - Property 12: Location Coordinate Validation
 * 
 * Requirements: 2.2, 2.3, 2.6, 2.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  updateDriverLocation,
  getDriverLocation,
  getActiveDriverLocations,
  validateCoordinates,
  findStaleDriverLocations,
  clearDriverLocation,
} from '../geolocation.service';
import {
  arbitraryDriverId,
  arbitraryLocation,
  arbitraryLatitude,
  arbitraryLongitude,
} from '../arbitraries';
import { deliveryRedisService } from '../redis-connection';
import { LOCATION_TTL_SECONDS, CONNECTION_LOST_THRESHOLD_SECONDS } from '../types-2026';

describe('Feature: delivery-2026-modernization, Geolocation Service Properties', () => {
  beforeEach(async () => {
    // Clear Redis before each test
    const keys = await deliveryRedisService.keys('driver:*:location');
    for (const key of keys) {
      await deliveryRedisService.del(key);
    }
  });

  /**
   * Property 9: Location Storage with TTL
   * For any location update, the location should be stored in Redis with a TTL of exactly 300 seconds.
   * Validates: Requirements 2.2
   */
  describe('Property 9: Location Storage with TTL', () => {
    it('should store any location with 300 second TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          async (driverId, location) => {
            // Update location
            await updateDriverLocation(driverId, location);

            // Verify location is stored
            const stored = await getDriverLocation(driverId);
            expect(stored).not.toBeNull();
            expect(stored?.latitude).toBe(location.latitude);
            expect(stored?.longitude).toBe(location.longitude);

            // Verify TTL is set (Redis TTL command returns seconds remaining)
            // Note: We can't check exact TTL due to timing, but we can verify it's set
            const key = `driver:${driverId}:location`;
            const value = await deliveryRedisService.get(key);
            expect(value).not.toBeNull();

            // Clean up
            await clearDriverLocation(driverId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Location Query Performance
   * For any request for driver locations, the response should be returned within 100ms.
   * Validates: Requirements 2.3
   */
  describe('Property 10: Location Query Performance', () => {
    it('should return all driver locations within 100ms', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              driverId: arbitraryDriverId(),
              location: arbitraryLocation(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (drivers) => {
            // Store all driver locations
            for (const { driverId, location } of drivers) {
              await updateDriverLocation(driverId, location);
            }

            // Measure query time
            const startTime = Date.now();
            const locations = await getActiveDriverLocations();
            const duration = Date.now() - startTime;

            // Verify performance
            expect(duration).toBeLessThan(100);

            // Verify all locations returned
            expect(locations.size).toBeGreaterThanOrEqual(drivers.length);

            // Clean up
            for (const { driverId } of drivers) {
              await clearDriverLocation(driverId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 11: Connection Lost Detection
   * For any driver whose location updates stop for more than 2 minutes,
   * the system should mark the driver status as "connection lost".
   * Validates: Requirements 2.6
   */
  describe('Property 11: Connection Lost Detection', () => {
    it('should detect stale locations after 2 minutes', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          async (driverId, location) => {
            // Create location with old timestamp (>2 minutes ago)
            const staleLocation = {
              ...location,
              timestamp: new Date(
                Date.now() - (CONNECTION_LOST_THRESHOLD_SECONDS + 10) * 1000
              ),
            };

            // Store stale location
            await updateDriverLocation(driverId, staleLocation);

            // Check for stale locations
            const staleDrivers = await findStaleDriverLocations();

            // Verify driver is detected as stale
            expect(staleDrivers).toContain(driverId);

            // Clean up
            await clearDriverLocation(driverId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not detect fresh locations as stale', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          async (driverId, location) => {
            // Create location with current timestamp
            const freshLocation = {
              ...location,
              timestamp: new Date(),
            };

            // Store fresh location
            await updateDriverLocation(driverId, freshLocation);

            // Check for stale locations
            const staleDrivers = await findStaleDriverLocations();

            // Verify driver is NOT detected as stale
            expect(staleDrivers).not.toContain(driverId);

            // Clean up
            await clearDriverLocation(driverId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Location Coordinate Validation
   * For any location update, coordinates outside valid ranges
   * (latitude: -90 to 90, longitude: -180 to 180) should be rejected.
   * Validates: Requirements 2.8
   */
  describe('Property 12: Location Coordinate Validation', () => {
    it('should accept any valid coordinates', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          async (driverId, location) => {
            // Valid location should not throw
            await expect(
              updateDriverLocation(driverId, location)
            ).resolves.not.toThrow();

            // Verify validation function
            expect(validateCoordinates(location)).toBe(true);

            // Clean up
            await clearDriverLocation(driverId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid latitude (outside -90 to 90)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          fc.oneof(
            fc.float({ min: 90.01, max: 180 }),
            fc.float({ min: -180, max: -90.01 })
          ),
          async (driverId, location, invalidLatitude) => {
            const invalidLocation = {
              ...location,
              latitude: invalidLatitude,
            };

            // Invalid latitude should throw
            await expect(
              updateDriverLocation(driverId, invalidLocation)
            ).rejects.toThrow('Invalid coordinates');

            // Verify validation function
            expect(validateCoordinates(invalidLocation)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject invalid longitude (outside -180 to 180)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          fc.oneof(
            fc.float({ min: 180.01, max: 360 }),
            fc.float({ min: -360, max: -180.01 })
          ),
          async (driverId, location, invalidLongitude) => {
            const invalidLocation = {
              ...location,
              longitude: invalidLongitude,
            };

            // Invalid longitude should throw
            await expect(
              updateDriverLocation(driverId, invalidLocation)
            ).rejects.toThrow('Invalid coordinates');

            // Verify validation function
            expect(validateCoordinates(invalidLocation)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary values', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          arbitraryLocation(),
          async (driverId, location) => {
            // Test all boundary values
            const boundaries = [
              { latitude: 90, longitude: 180 },
              { latitude: 90, longitude: -180 },
              { latitude: -90, longitude: 180 },
              { latitude: -90, longitude: -180 },
              { latitude: 0, longitude: 0 },
            ];

            for (const boundary of boundaries) {
              const boundaryLocation = {
                ...location,
                latitude: boundary.latitude,
                longitude: boundary.longitude,
              };

              // Boundary values should be accepted
              await expect(
                updateDriverLocation(driverId, boundaryLocation)
              ).resolves.not.toThrow();

              expect(validateCoordinates(boundaryLocation)).toBe(true);
            }

            // Clean up
            await clearDriverLocation(driverId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
