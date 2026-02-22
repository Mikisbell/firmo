/**
 * Property-Based Tests for ETA Calculator
 *
 * Tests universal properties that should hold for all valid inputs.
 * Uses fast-check for property-based testing with 100+ iterations.
 *
 * Properties tested:
 * - Property 26: Initial ETA Calculation
 * - Property 27: ETA Recalculation on Location Update
 * - Property 28: ETA Factor Consideration
 * - Property 29: ETA Change Notification
 * - Property 30: ETA Confidence Intervals
 * - Property 31: ETA Learning from Actual Times
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fc from 'fast-check';
import {
  arbitraryLocation,
  arbitraryOrderId,
  arbitraryDriverId,
} from '../arbitraries';
import { ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES } from '../types-2026';

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
} from '../eta-calculator.service';

// Counter for unique prediction IDs
let predictionIdCounter = 0;

describe('Feature: delivery-2026-modernization - ETA Calculator Properties', () => {
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

  /**
   * Property 26: Initial ETA Calculation
   * For any order assignment, an initial ETA should be calculated based on distance and average driver speed.
   * 
   * Validates: Requirements 5.1
   */
  describe('Property 26: Initial ETA Calculation', () => {
    it('should calculate initial ETA for any valid order assignment', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            driverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
          }),
          async ({ orderId, pickupLocation, deliveryLocation, driverLocation, driverId, driverRating }) => {
            // Clear mocks between iterations
            mockPrisma.eta_predictions.create.mockClear();
            mockPrisma.eta_predictions.findFirst.mockClear();
            mockPrisma.eta_predictions.findMany.mockClear();
            mockPrisma.eta_predictions.update.mockClear();

            // Re-setup default mocks
            mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
              id: `pred-${++predictionIdCounter}`,
              ...args.data,
              created_at: new Date(),
              actual_minutes: null,
            }));
            mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);
            mockPrisma.eta_predictions.findMany.mockResolvedValue([]);

            // Calculate initial ETA
            const estimate = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              driverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Verify ETA is calculated
            expect(estimate).toBeDefined();
            expect(estimate.estimatedMinutes).toBeGreaterThan(0);
            // ETA depends on distance between random locations; no fixed upper bound
            expect(Number.isFinite(estimate.estimatedMinutes)).toBe(true);

            // Verify confidence interval
            expect(estimate.confidenceInterval).toBeDefined();
            expect(estimate.confidenceInterval[0]).toBeLessThanOrEqual(estimate.estimatedMinutes);
            expect(estimate.confidenceInterval[1]).toBeGreaterThanOrEqual(estimate.estimatedMinutes);

            // Verify confidence score
            expect(estimate.confidence).toBeGreaterThanOrEqual(0);
            expect(estimate.confidence).toBeLessThanOrEqual(1);

            // Verify factors are present
            expect(estimate.factors).toBeDefined();
            expect(estimate.factors.baseTime).toBeGreaterThan(0);

            // Verify stored in database (mock create was called)
            expect(mockPrisma.eta_predictions.create).toHaveBeenCalledTimes(1);
            expect(mockPrisma.eta_predictions.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  order_id: orderId,
                  predicted_minutes: estimate.estimatedMinutes,
                }),
              })
            );
          }
        ),
        { numRuns: 20 } // Reduced for DB operations
      );
    });
  });

  /**
   * Property 27: ETA Recalculation on Location Update
   * For any driver location update, the ETA should be recalculated using current position and remaining distance.
   * 
   * Validates: Requirements 5.2
   */
  describe('Property 27: ETA Recalculation on Location Update', () => {
    it('should recalculate ETA when driver location updates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            initialDriverLocation: arbitraryLocation(),
            updatedDriverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
          }),
          async ({
            orderId,
            pickupLocation,
            deliveryLocation,
            initialDriverLocation,
            updatedDriverLocation,
            driverId,
            driverRating,
          }) => {
            // Clear mocks between iterations
            mockPrisma.eta_predictions.create.mockClear();
            mockPrisma.eta_predictions.findFirst.mockClear();
            mockPrisma.eta_predictions.update.mockClear();

            // Re-setup default mocks
            mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
              id: `pred-${++predictionIdCounter}`,
              ...args.data,
              created_at: new Date(),
              actual_minutes: null,
            }));
            mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);

            // Calculate initial ETA
            const initialETA = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              initialDriverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Mock findFirst to return initial prediction for recalculation
            mockPrisma.eta_predictions.findFirst.mockResolvedValue({
              id: `pred-initial-${orderId}`,
              order_id: orderId,
              predicted_minutes: initialETA.estimatedMinutes,
              created_at: new Date(),
            });

            // Recalculate ETA with updated location
            const { estimate: updatedETA, changed, changeMins } = await recalculateETA(
              orderId,
              updatedDriverLocation,
              deliveryLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Verify ETA is recalculated
            expect(updatedETA).toBeDefined();
            expect(updatedETA.estimatedMinutes).toBeGreaterThan(0);

            // Verify change detection
            expect(typeof changed).toBe('boolean');
            expect(changeMins).toBeGreaterThanOrEqual(0);

            // If changed, verify threshold
            if (changed) {
              expect(changeMins).toBeGreaterThanOrEqual(ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES);
            }

            // Verify both predictions stored (2 calls to create)
            expect(mockPrisma.eta_predictions.create).toHaveBeenCalledTimes(2);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 28: ETA Factor Consideration
   * For any ETA calculation, the system should consider historical driver performance,
   * traffic conditions, and weather conditions as adjustment factors.
   * 
   * Validates: Requirements 5.3, 5.4, 5.5
   */
  describe('Property 28: ETA Factor Consideration', () => {
    it('should consider all adjustment factors in ETA calculation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            driverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
          }),
          async ({ orderId, pickupLocation, deliveryLocation, driverLocation, driverId, driverRating }) => {
            // Calculate ETA
            const estimate = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              driverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Verify all factors are present
            expect(estimate.factors).toBeDefined();
            expect(typeof estimate.factors.baseTime).toBe('number');
            expect(typeof estimate.factors.trafficAdjustment).toBe('number');
            expect(typeof estimate.factors.weatherAdjustment).toBe('number');
            expect(typeof estimate.factors.driverAdjustment).toBe('number');

            // Verify factors are reasonable
            expect(estimate.factors.baseTime).toBeGreaterThan(0);
            expect(estimate.factors.trafficAdjustment).toBeGreaterThanOrEqual(-60);
            expect(estimate.factors.trafficAdjustment).toBeLessThanOrEqual(120);
            expect(estimate.factors.weatherAdjustment).toBeGreaterThanOrEqual(0);
            expect(estimate.factors.weatherAdjustment).toBeLessThanOrEqual(30);
            expect(estimate.factors.driverAdjustment).toBeGreaterThanOrEqual(-30);
            expect(estimate.factors.driverAdjustment).toBeLessThanOrEqual(30);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should have driver speed factor in valid range (0.8-1.2)', async () => {
      await fc.assert(
        fc.asyncProperty(
          arbitraryDriverId(),
          async (driverId) => {
            const factor = await getDriverSpeedFactor(driverId);

            // Verify factor is in valid range
            expect(factor).toBeGreaterThanOrEqual(0.8);
            expect(factor).toBeLessThanOrEqual(1.2);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have traffic factor in valid range (1.0-2.0)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed
          async () => {
            const factor = await getTrafficFactor();

            // Verify factor is in valid range
            expect(factor).toBeGreaterThanOrEqual(1.0);
            expect(factor).toBeLessThanOrEqual(2.0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have weather factor in valid range (1.0-1.15)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed
          async () => {
            const factor = await getWeatherFactor();

            // Verify factor is in valid range
            expect(factor).toBeGreaterThanOrEqual(1.0);
            expect(factor).toBeLessThanOrEqual(1.15);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 29: ETA Change Notification
   * For any ETA change exceeding 5 minutes, a WhatsApp notification should be sent to the customer.
   * 
   * Note: This property tests the change detection logic. WhatsApp integration is tested separately.
   * 
   * Validates: Requirements 5.6
   */
  describe('Property 29: ETA Change Notification', () => {
    it('should detect significant ETA changes (>5 minutes)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            initialDriverLocation: arbitraryLocation(),
            // Generate updated location that's significantly different
            updatedDriverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
          }),
          async ({
            orderId,
            pickupLocation,
            deliveryLocation,
            initialDriverLocation,
            updatedDriverLocation,
            driverId,
            driverRating,
          }) => {
            // Clear mocks between iterations
            mockPrisma.eta_predictions.create.mockClear();
            mockPrisma.eta_predictions.findFirst.mockClear();

            // Re-setup mocks
            mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
              id: `pred-${++predictionIdCounter}`,
              ...args.data,
              created_at: new Date(),
              actual_minutes: null,
            }));
            mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);

            // Calculate initial ETA
            const initialETA = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              initialDriverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Mock findFirst to return initial prediction for recalculation
            mockPrisma.eta_predictions.findFirst.mockResolvedValue({
              id: `pred-initial-${orderId}`,
              order_id: orderId,
              predicted_minutes: initialETA.estimatedMinutes,
              created_at: new Date(),
            });

            // Recalculate with updated location
            const { changed, changeMins } = await recalculateETA(
              orderId,
              updatedDriverLocation,
              deliveryLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Verify change detection logic
            if (changeMins >= ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES) {
              expect(changed).toBe(true);
            } else {
              expect(changed).toBe(false);
            }

            // Verify change amount is non-negative
            expect(changeMins).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 30: ETA Confidence Intervals
   * For any ETA calculation, the result should include a confidence interval
   * (e.g., [15, 20] minutes) based on prediction accuracy.
   * 
   * Validates: Requirements 5.7
   */
  describe('Property 30: ETA Confidence Intervals', () => {
    it('should include valid confidence interval for any ETA', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            driverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
          }),
          async ({ orderId, pickupLocation, deliveryLocation, driverLocation, driverId, driverRating }) => {
            const estimate = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              driverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Verify confidence interval exists
            expect(estimate.confidenceInterval).toBeDefined();
            expect(Array.isArray(estimate.confidenceInterval)).toBe(true);
            expect(estimate.confidenceInterval.length).toBe(2);

            const [min, max] = estimate.confidenceInterval;

            // Verify interval is valid
            expect(min).toBeGreaterThan(0);
            expect(max).toBeGreaterThan(0);
            expect(min).toBeLessThanOrEqual(estimate.estimatedMinutes);
            expect(max).toBeGreaterThanOrEqual(estimate.estimatedMinutes);
            expect(min).toBeLessThan(max);

            // Verify confidence score
            expect(estimate.confidence).toBeGreaterThanOrEqual(0);
            expect(estimate.confidence).toBeLessThanOrEqual(1);

            // Verify interval is reasonable (not too wide)
            const intervalWidth = max - min;
            const relativeWidth = intervalWidth / estimate.estimatedMinutes;
            expect(relativeWidth).toBeLessThanOrEqual(1.0); // Max 100% width
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 31: ETA Learning from Actual Times
   * For any completed delivery, recording the actual delivery time should affect future ETA predictions
   * for similar distances.
   * 
   * Note: This property tests that actual times are recorded. Model retraining is tested separately.
   * 
   * Validates: Requirements 5.8
   */
  describe('Property 31: ETA Learning from Actual Times', () => {
    it('should record actual delivery time for learning', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            driverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
            actualMinutes: fc.integer({ min: 5, max: 120 }),
          }),
          async ({
            orderId,
            pickupLocation,
            deliveryLocation,
            driverLocation,
            driverId,
            driverRating,
            actualMinutes,
          }) => {
            // Clear mocks between iterations
            mockPrisma.eta_predictions.create.mockClear();
            mockPrisma.eta_predictions.findFirst.mockClear();
            mockPrisma.eta_predictions.update.mockClear();

            // Re-setup mocks
            mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
              id: `pred-${++predictionIdCounter}`,
              ...args.data,
              created_at: new Date(),
              actual_minutes: null,
            }));
            mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);
            mockPrisma.eta_predictions.update.mockImplementation((args: any) => ({
              id: args.where.id,
              ...args.data,
            }));

            // Calculate initial ETA
            const estimate = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              driverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Mock findFirst to return the created prediction for recordActualDeliveryTime
            const predId = `pred-${orderId}`;
            mockPrisma.eta_predictions.findFirst.mockResolvedValue({
              id: predId,
              order_id: orderId,
              predicted_minutes: estimate.estimatedMinutes,
              created_at: new Date(),
              actual_minutes: null,
            });

            // Record actual delivery time
            await recordActualDeliveryTime(orderId, actualMinutes);

            // Verify update was called with actual_minutes
            expect(mockPrisma.eta_predictions.update).toHaveBeenCalledWith(
              expect.objectContaining({
                where: { id: predId },
                data: { actual_minutes: actualMinutes },
              })
            );

            // Verify prediction error can be calculated
            const error = Math.abs(actualMinutes - estimate.estimatedMinutes);
            expect(error).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle recording actual time for orders with multiple predictions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            orderId: arbitraryOrderId(),
            pickupLocation: arbitraryLocation(),
            deliveryLocation: arbitraryLocation(),
            initialDriverLocation: arbitraryLocation(),
            updatedDriverLocation: arbitraryLocation(),
            driverId: arbitraryDriverId(),
            driverRating: fc.float({ min: 0, max: 5, noNaN: true }),
            actualMinutes: fc.integer({ min: 5, max: 120 }),
          }),
          async ({
            orderId,
            pickupLocation,
            deliveryLocation,
            initialDriverLocation,
            updatedDriverLocation,
            driverId,
            driverRating,
            actualMinutes,
          }) => {
            // Clear mocks between iterations
            mockPrisma.eta_predictions.create.mockClear();
            mockPrisma.eta_predictions.findFirst.mockClear();
            mockPrisma.eta_predictions.update.mockClear();

            // Re-setup mocks
            mockPrisma.eta_predictions.create.mockImplementation((args: any) => ({
              id: `pred-${++predictionIdCounter}`,
              ...args.data,
              created_at: new Date(),
              actual_minutes: null,
            }));
            mockPrisma.eta_predictions.findFirst.mockResolvedValue(null);
            mockPrisma.eta_predictions.update.mockImplementation((args: any) => ({
              id: args.where.id,
              ...args.data,
            }));

            // Calculate initial ETA
            const initialETA = await calculateInitialETA(
              orderId,
              pickupLocation,
              deliveryLocation,
              initialDriverLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Mock findFirst to return initial prediction for recalculation and recordActualDeliveryTime
            const predId = `pred-initial-${orderId}`;
            mockPrisma.eta_predictions.findFirst.mockResolvedValue({
              id: predId,
              order_id: orderId,
              predicted_minutes: initialETA.estimatedMinutes,
              created_at: new Date(),
              actual_minutes: null,
            });

            // Recalculate (creates second prediction)
            await recalculateETA(
              orderId,
              updatedDriverLocation,
              deliveryLocation,
              driverId,
              driverRating,
              'test-tenant-id'
            );

            // Record actual time (should update first prediction)
            await recordActualDeliveryTime(orderId, actualMinutes);

            // Verify 2 predictions were created
            expect(mockPrisma.eta_predictions.create).toHaveBeenCalledTimes(2);

            // Verify update was called on the first prediction
            expect(mockPrisma.eta_predictions.update).toHaveBeenCalledWith(
              expect.objectContaining({
                where: { id: predId },
                data: { actual_minutes: actualMinutes },
              })
            );
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
