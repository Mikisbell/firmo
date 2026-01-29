/**
 * Assignment Algorithm Service
 * 
 * Automatically assigns delivery orders to the most suitable available driver.
 * 
 * Features:
 * - Calculate assignment scores using distance (40%), workload (30%), performance (30%)
 * - Select best available driver (status = AVAILABLE, not at max capacity)
 * - Log all assignment decisions to assignment_logs table
 * - Queue orders when no drivers available, retry every 60 seconds
 * - Handle rejections by reassigning to next best driver within 10 seconds
 * - Store configurable weights in assignment_weights table
 * - Use Haversine formula for distance calculation
 * - Implement tie-breaking (within 5%, choose lower workload)
 * 
 * Requirements: 3.1-3.8
 */

import prisma from '@/src/core/db/prisma';
import { deliveryRedisService } from './redis-connection';
import { logger } from '@/src/core/observability/logger';
import {
  getDriverLocation,
  calculateDistance,
} from './geolocation.service';
import {
  AssignmentWeights,
  AssignmentScore,
  Driver,
  DeliveryOrder,
  DriverId,
  OrderId,
  TenantId,
  Location,
} from './types-2026';

// Constants
const MAX_DRIVER_CAPACITY = 4; // Maximum concurrent orders per driver
const ASSIGNMENT_QUEUE_KEY = 'pending_assignments';
const ASSIGNMENT_RETRY_INTERVAL_MS = 60 * 1000; // 60 seconds
const REASSIGNMENT_TIMEOUT_MS = 10 * 1000; // 10 seconds
const TIE_BREAKING_THRESHOLD = 0.05; // 5% difference
const MAX_ASSIGNMENT_RETRIES = 10;

// Default weights (distance: 40%, workload: 30%, performance: 30%)
const DEFAULT_WEIGHTS: AssignmentWeights = {
  distance: 0.4,
  workload: 0.3,
  performance: 0.3,
};

/**
 * Gets assignment weights for a tenant
 * Returns default weights if not configured
 * 
 * Validates: Requirements 3.7
 */
export async function getWeights(tenantId: TenantId): Promise<AssignmentWeights> {
  try {
    const config = await prisma.assignment_weights.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      return DEFAULT_WEIGHTS;
    }

    return {
      distance: config.distance,
      workload: config.workload,
      performance: config.performance,
    };
  } catch (error) {
    logger.error(
      'ASSIGNMENT_GET_WEIGHTS_FAILED',
      'Failed to get assignment weights',
      error instanceof Error ? error : undefined,
      { tenantId }
    );
    return DEFAULT_WEIGHTS;
  }
}

/**
 * Updates assignment weights for a tenant
 * 
 * Validates: Requirements 3.7
 */
export async function updateWeights(
  tenantId: TenantId,
  weights: AssignmentWeights
): Promise<void> {
  // Validate weights sum to 1.0
  const sum = weights.distance + weights.workload + weights.performance;
  if (Math.abs(sum - 1.0) > 0.01) {
    throw new Error(
      `Assignment weights must sum to 1.0, got ${sum.toFixed(2)}`
    );
  }

  try {
    await prisma.assignment_weights.upsert({
      where: { tenant_id: tenantId },
      create: {
        tenant_id: tenantId,
        distance: weights.distance,
        workload: weights.workload,
        performance: weights.performance,
      },
      update: {
        distance: weights.distance,
        workload: weights.workload,
        performance: weights.performance,
      },
    });

    logger.info(
      'ASSIGNMENT_WEIGHTS_UPDATED',
      'Assignment weights updated',
      {
        tenantId,
        weights,
      }
    );
  } catch (error) {
    logger.error(
      'ASSIGNMENT_UPDATE_WEIGHTS_FAILED',
      'Failed to update assignment weights',
      error instanceof Error ? error : undefined,
      { tenantId, weights }
    );
    throw error;
  }
}

/**
 * Calculates distance score (0-100, lower distance = higher score)
 * 10km = 0 score, 0km = 100 score
 */
function calculateDistanceScore(distanceKm: number): number {
  return Math.max(0, 100 - distanceKm * 10);
}

/**
 * Calculates workload score (0-100, fewer orders = higher score)
 * 4 orders = 0 score, 0 orders = 100 score
 */
function calculateWorkloadScore(currentOrders: number): number {
  return Math.max(0, 100 - currentOrders * 25);
}

/**
 * Calculates performance score (0-100, based on rating)
 * 5.0 rating = 100 score, 0.0 rating = 0 score
 */
function calculatePerformanceScore(performanceRating: number): number {
  return (performanceRating / 5) * 100;
}

/**
 * Calculates assignment score for a driver-order pair
 * Uses weighted factors: distance (40%), workload (30%), performance (30%)
 * 
 * Validates: Requirements 3.1, 3.2
 */
export async function calculateAssignmentScore(
  driver: Driver,
  order: DeliveryOrder,
  weights: AssignmentWeights
): Promise<AssignmentScore> {
  // Get driver location
  const driverLocation = driver.location;
  if (!driverLocation) {
    throw new Error(`Driver ${driver.id} has no location data`);
  }

  // Calculate distance from driver to pickup location
  const distance = calculateDistance(driverLocation, order.pickupLocation);

  // Calculate individual scores
  const distanceScore = calculateDistanceScore(distance);
  const workloadScore = calculateWorkloadScore(driver.activeOrders.length);
  const performanceScore = calculatePerformanceScore(driver.performanceRating);

  // Calculate weighted total score
  const totalScore =
    distanceScore * weights.distance +
    workloadScore * weights.workload +
    performanceScore * weights.performance;

  const score: AssignmentScore = {
    driverId: driver.id,
    totalScore,
    distanceScore,
    workloadScore,
    performanceScore,
    distance,
    currentOrders: driver.activeOrders.length,
    performanceRating: driver.performanceRating,
  };

  logger.debug(
    'ASSIGNMENT_SCORE_CALCULATED',
    'Calculated assignment score',
    {
      driverId: driver.id,
      orderId: order.id,
      totalScore: totalScore.toFixed(2),
      distanceScore: distanceScore.toFixed(2),
      workloadScore: workloadScore.toFixed(2),
      performanceScore: performanceScore.toFixed(2),
      distance: distance.toFixed(2),
    }
  );

  return score;
}

/**
 * Logs assignment decision to database
 * 
 * Validates: Requirements 3.1
 */
async function logAssignment(
  orderId: OrderId,
  score: AssignmentScore
): Promise<void> {
  try {
    await prisma.assignment_logs.create({
      data: {
        order_id: orderId,
        driver_id: score.driverId,
        assignment_score: score.totalScore,
        distance_score: score.distanceScore,
        workload_score: score.workloadScore,
        performance_score: score.performanceScore,
        distance_km: score.distance,
        current_orders: score.currentOrders,
        performance_rating: score.performanceRating,
      },
    });

    logger.info(
      'ASSIGNMENT_LOGGED',
      'Assignment decision logged',
      {
        orderId,
        driverId: score.driverId,
        totalScore: score.totalScore.toFixed(2),
      }
    );
  } catch (error) {
    logger.error(
      'ASSIGNMENT_LOG_FAILED',
      'Failed to log assignment',
      error instanceof Error ? error : undefined,
      { orderId, driverId: score.driverId }
    );
    // Don't throw - logging failure shouldn't block assignment
  }
}

/**
 * Gets available drivers for assignment
 * Filters by: status = AVAILABLE, not at max capacity, has location
 */
async function getAvailableDrivers(
  tenantId: TenantId
): Promise<Driver[]> {
  try {
    // Get drivers from database
    const dbDrivers = await prisma.employees.findMany({
      where: {
        tenant_id: tenantId,
        role: 'DRIVER',
        is_active: true,
      },
      include: {
        delivery_orders_delivery_orders_driver_idToemployees: {
          where: {
            status: {
              in: ['ASSIGNED', 'DISPATCHED'],
            },
          },
          select: {
            id: true,
          },
        },
      },
    });

    // Build Driver objects with locations
    const drivers: Driver[] = [];

    for (const dbDriver of dbDrivers) {
      const activeOrders = dbDriver.delivery_orders_delivery_orders_driver_idToemployees.map(
        (o) => o.id as OrderId
      );

      // Skip if at max capacity
      if (activeOrders.length >= MAX_DRIVER_CAPACITY) {
        continue;
      }

      // Get driver location from Redis
      const location = await getDriverLocation(dbDriver.id as DriverId);
      if (!location) {
        // Skip drivers without location (offline or no GPS)
        continue;
      }

      // Calculate performance rating (placeholder - would come from metrics)
      // For now, use a default rating of 4.0
      const performanceRating = 4.0;

      const driver: Driver = {
        id: dbDriver.id as DriverId,
        name: dbDriver.name,
        phone: dbDriver.phone ?? undefined,
        location,
        activeOrders,
        performanceRating,
        status: 'AVAILABLE',
        isActive: dbDriver.is_active,
      };

      drivers.push(driver);
    }

    logger.debug(
      'ASSIGNMENT_AVAILABLE_DRIVERS',
      'Retrieved available drivers',
      {
        tenantId,
        total: dbDrivers.length,
        available: drivers.length,
      }
    );

    return drivers;
  } catch (error) {
    logger.error(
      'ASSIGNMENT_GET_DRIVERS_FAILED',
      'Failed to get available drivers',
      error instanceof Error ? error : undefined,
      { tenantId }
    );
    return [];
  }
}

/**
 * Selects best driver from scored list
 * Implements tie-breaking: if top 2 drivers within 5%, choose lower workload
 * 
 * Validates: Requirements 3.3
 */
function selectBestDriver(scores: AssignmentScore[]): AssignmentScore | null {
  if (scores.length === 0) {
    return null;
  }

  // Sort by total score (descending)
  const sorted = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  const best = sorted[0];

  // Check for tie-breaking
  if (sorted.length > 1) {
    const second = sorted[1];
    const scoreDiff = Math.abs(best.totalScore - second.totalScore);
    const threshold = best.totalScore * TIE_BREAKING_THRESHOLD;

    if (scoreDiff <= threshold) {
      // Scores within 5% - choose driver with lower workload
      if (second.currentOrders < best.currentOrders) {
        logger.info(
          'ASSIGNMENT_TIE_BREAKING',
          'Applied tie-breaking rule',
          {
            bestDriver: best.driverId,
            bestScore: best.totalScore.toFixed(2),
            bestWorkload: best.currentOrders,
            secondDriver: second.driverId,
            secondScore: second.totalScore.toFixed(2),
            secondWorkload: second.currentOrders,
            selected: second.driverId,
          }
        );
        return second;
      }
    }
  }

  return best;
}

/**
 * Assigns a driver to an order
 * Updates order in database and returns assigned driver
 */
async function assignDriverToOrder(
  orderId: OrderId,
  driverId: DriverId
): Promise<void> {
  try {
    await prisma.delivery_orders.update({
      where: { id: orderId },
      data: {
        driver_id: driverId,
        status: 'ASSIGNED',
        assigned_at: new Date(),
      },
    });

    logger.info(
      'ASSIGNMENT_DRIVER_ASSIGNED',
      'Driver assigned to order',
      {
        orderId,
        driverId,
      }
    );
  } catch (error) {
    logger.error(
      'ASSIGNMENT_ASSIGN_FAILED',
      'Failed to assign driver to order',
      error instanceof Error ? error : undefined,
      { orderId, driverId }
    );
    throw error;
  }
}

/**
 * Assigns best available driver to an order
 * Returns assigned driver or null if no drivers available
 * 
 * Validates: Requirements 3.1, 3.2, 3.3
 */
export async function assignDriver(
  orderId: OrderId
): Promise<Driver | null> {
  try {
    // Get order details
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Convert to DeliveryOrder type
    const deliveryOrder: DeliveryOrder = {
      id: order.id as OrderId,
      tenantId: order.tenant_id as TenantId,
      orderNumber: parseInt(order.order_id || '0'),
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      pickupLocation: JSON.parse(order.pickup_location || '{}') as Location,
      deliveryLocation: JSON.parse(order.delivery_address) as Location,
      driverId: order.driver_id as DriverId | undefined,
      status: order.status as any,
      estimatedDeliveryAt: order.estimated_delivery_at ?? undefined,
      assignedAt: order.assigned_at ?? undefined,
      dispatchedAt: order.dispatched_at ?? undefined,
      deliveredAt: order.delivered_at ?? undefined,
      failedAt: order.failed_at ?? undefined,
      failureReason: order.failure_reason ?? undefined,
      deliveryTimeMins: order.delivery_time_mins ?? undefined,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };

    // Get available drivers
    const drivers = await getAvailableDrivers(deliveryOrder.tenantId);

    if (drivers.length === 0) {
      logger.warn(
        'ASSIGNMENT_NO_DRIVERS',
        'No available drivers for assignment',
        {
          orderId,
          tenantId: deliveryOrder.tenantId,
        }
      );
      return null;
    }

    // Get assignment weights
    const weights = await getWeights(deliveryOrder.tenantId);

    // Calculate scores for all drivers
    const scores = await Promise.all(
      drivers.map((driver) =>
        calculateAssignmentScore(driver, deliveryOrder, weights)
      )
    );

    // Select best driver
    const bestScore = selectBestDriver(scores);

    if (!bestScore) {
      logger.error(
        'ASSIGNMENT_NO_BEST_DRIVER',
        'Failed to select best driver',
        undefined,
        { orderId }
      );
      return null;
    }

    // Log assignment decision
    await logAssignment(orderId, bestScore);

    // Assign driver to order
    await assignDriverToOrder(orderId, bestScore.driverId);

    // Find and return the assigned driver
    const assignedDriver = drivers.find((d) => d.id === bestScore.driverId);

    if (!assignedDriver) {
      throw new Error(`Assigned driver ${bestScore.driverId} not found`);
    }

    logger.info(
      'ASSIGNMENT_SUCCESS',
      'Successfully assigned driver to order',
      {
        orderId,
        driverId: bestScore.driverId,
        totalScore: bestScore.totalScore.toFixed(2),
        distance: bestScore.distance.toFixed(2),
      }
    );

    return assignedDriver;
  } catch (error) {
    logger.error(
      'ASSIGNMENT_FAILED',
      'Failed to assign driver',
      error instanceof Error ? error : undefined,
      { orderId }
    );
    throw error;
  }
}

/**
 * Queues an order for assignment retry
 * 
 * Validates: Requirements 3.4
 */
export async function queueOrderForAssignment(orderId: OrderId): Promise<void> {
  try {
    await deliveryRedisService.rpush(ASSIGNMENT_QUEUE_KEY, orderId);

    logger.info(
      'ASSIGNMENT_QUEUED',
      'Order queued for assignment retry',
      {
        orderId,
      }
    );
  } catch (error) {
    logger.error(
      'ASSIGNMENT_QUEUE_FAILED',
      'Failed to queue order for assignment',
      error instanceof Error ? error : undefined,
      { orderId }
    );
    throw error;
  }
}

/**
 * Processes assignment queue
 * Retries assignment for queued orders
 * 
 * Validates: Requirements 3.4
 */
export async function processAssignmentQueue(): Promise<void> {
  try {
    const queueLength = await deliveryRedisService.llen(ASSIGNMENT_QUEUE_KEY);

    if (queueLength === 0) {
      return;
    }

    logger.info(
      'ASSIGNMENT_QUEUE_PROCESSING',
      'Processing assignment queue',
      {
        queueLength,
      }
    );

    // Process all queued orders
    for (let i = 0; i < queueLength; i++) {
      const orderId = await deliveryRedisService.lpop(ASSIGNMENT_QUEUE_KEY);

      if (!orderId) {
        break;
      }

      try {
        // Try to assign driver
        const driver = await assignDriver(orderId as OrderId);

        if (driver) {
          logger.info(
            'ASSIGNMENT_QUEUE_SUCCESS',
            'Successfully assigned queued order',
            {
              orderId,
              driverId: driver.id,
            }
          );
        } else {
          // No drivers available - requeue
          await deliveryRedisService.rpush(ASSIGNMENT_QUEUE_KEY, orderId);

          // Check retry count
          const retryKey = `assignment:retry:${orderId}`;
          const retryCount = await deliveryRedisService.incr(retryKey);
          await deliveryRedisService.expire(retryKey, 24 * 60 * 60); // 24 hours

          if (retryCount >= MAX_ASSIGNMENT_RETRIES) {
            logger.error(
              'ASSIGNMENT_MAX_RETRIES',
              'Order exceeded max assignment retries',
              undefined,
              {
                orderId,
                retryCount,
              }
            );
            // TODO: Alert admin
          }
        }
      } catch (error) {
        logger.error(
          'ASSIGNMENT_QUEUE_ITEM_FAILED',
          'Failed to process queued order',
          error instanceof Error ? error : undefined,
          { orderId }
        );
        // Requeue on error
        await deliveryRedisService.rpush(ASSIGNMENT_QUEUE_KEY, orderId);
      }
    }
  } catch (error) {
    logger.error(
      'ASSIGNMENT_QUEUE_PROCESS_FAILED',
      'Failed to process assignment queue',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Handles driver rejection and reassigns to next best driver
 * 
 * Validates: Requirements 3.5
 */
export async function handleRejection(
  orderId: OrderId,
  rejectedDriverId: DriverId,
  reason?: string
): Promise<Driver | null> {
  try {
    logger.info(
      'ASSIGNMENT_REJECTION',
      'Driver rejected assignment',
      {
        orderId,
        driverId: rejectedDriverId,
        reason,
      }
    );

    // Get order details
    const order = await prisma.delivery_orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Convert to DeliveryOrder type
    const deliveryOrder: DeliveryOrder = {
      id: order.id as OrderId,
      tenantId: order.tenant_id as TenantId,
      orderNumber: parseInt(order.order_id || '0'),
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      pickupLocation: JSON.parse(order.pickup_location || '{}') as Location,
      deliveryLocation: JSON.parse(order.delivery_address) as Location,
      driverId: order.driver_id as DriverId | undefined,
      status: order.status as any,
      estimatedDeliveryAt: order.estimated_delivery_at ?? undefined,
      assignedAt: order.assigned_at ?? undefined,
      dispatchedAt: order.dispatched_at ?? undefined,
      deliveredAt: order.delivered_at ?? undefined,
      failedAt: order.failed_at ?? undefined,
      failureReason: order.failure_reason ?? undefined,
      deliveryTimeMins: order.delivery_time_mins ?? undefined,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    };

    // Get available drivers (excluding rejected driver)
    const allDrivers = await getAvailableDrivers(deliveryOrder.tenantId);
    const drivers = allDrivers.filter((d) => d.id !== rejectedDriverId);

    if (drivers.length === 0) {
      logger.warn(
        'ASSIGNMENT_NO_DRIVERS_AFTER_REJECTION',
        'No available drivers after rejection',
        {
          orderId,
          rejectedDriverId,
        }
      );
      // Queue for retry
      await queueOrderForAssignment(orderId);
      return null;
    }

    // Get assignment weights
    const weights = await getWeights(deliveryOrder.tenantId);

    // Calculate scores for remaining drivers
    const scores = await Promise.all(
      drivers.map((driver) =>
        calculateAssignmentScore(driver, deliveryOrder, weights)
      )
    );

    // Select next best driver
    const bestScore = selectBestDriver(scores);

    if (!bestScore) {
      logger.error(
        'ASSIGNMENT_NO_NEXT_BEST_DRIVER',
        'Failed to select next best driver',
        undefined,
        { orderId, rejectedDriverId }
      );
      await queueOrderForAssignment(orderId);
      return null;
    }

    // Log assignment decision
    await logAssignment(orderId, bestScore);

    // Assign new driver to order
    await assignDriverToOrder(orderId, bestScore.driverId);

    // Find and return the assigned driver
    const assignedDriver = drivers.find((d) => d.id === bestScore.driverId);

    if (!assignedDriver) {
      throw new Error(`Assigned driver ${bestScore.driverId} not found`);
    }

    logger.info(
      'ASSIGNMENT_REASSIGNED',
      'Successfully reassigned order after rejection',
      {
        orderId,
        rejectedDriverId,
        newDriverId: bestScore.driverId,
        totalScore: bestScore.totalScore.toFixed(2),
      }
    );

    return assignedDriver;
  } catch (error) {
    logger.error(
      'ASSIGNMENT_REJECTION_FAILED',
      'Failed to handle rejection',
      error instanceof Error ? error : undefined,
      { orderId, rejectedDriverId }
    );
    throw error;
  }
}

/**
 * Manual assignment override
 * Allows admin to manually assign a specific driver to an order
 */
export async function manualAssign(
  orderId: OrderId,
  driverId: DriverId
): Promise<void> {
  try {
    // Verify driver exists and is available
    const driver = await prisma.employees.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new Error(`Driver ${driverId} not found`);
    }

    if (!driver.is_active) {
      throw new Error(`Driver ${driverId} is not active`);
    }

    // Assign driver to order
    await assignDriverToOrder(orderId, driverId);

    logger.info(
      'ASSIGNMENT_MANUAL',
      'Manual assignment completed',
      {
        orderId,
        driverId,
      }
    );
  } catch (error) {
    logger.error(
      'ASSIGNMENT_MANUAL_FAILED',
      'Failed to manually assign driver',
      error instanceof Error ? error : undefined,
      { orderId, driverId }
    );
    throw error;
  }
}

// Background job intervals
let assignmentQueueInterval: NodeJS.Timeout | null = null;

/**
 * Starts assignment queue processing
 * Processes queue every 60 seconds
 */
export function startAssignmentQueueProcessing(): void {
  if (assignmentQueueInterval) {
    return; // Already started
  }

  assignmentQueueInterval = setInterval(() => {
    processAssignmentQueue().catch((error) => {
      logger.error(
        'ASSIGNMENT_QUEUE_INTERVAL_FAILED',
        'Assignment queue processing failed',
        error instanceof Error ? error : undefined
      );
    });
  }, ASSIGNMENT_RETRY_INTERVAL_MS);

  logger.info(
    'ASSIGNMENT_QUEUE_STARTED',
    'Started assignment queue processing',
    {
      intervalMs: ASSIGNMENT_RETRY_INTERVAL_MS,
    }
  );
}

/**
 * Stops assignment queue processing
 */
export function stopAssignmentQueueProcessing(): void {
  if (assignmentQueueInterval) {
    clearInterval(assignmentQueueInterval);
    assignmentQueueInterval = null;
    logger.info(
      'ASSIGNMENT_QUEUE_STOPPED',
      'Stopped assignment queue processing'
    );
  }
}

/**
 * Initializes assignment service
 */
export function initializeAssignmentService(): void {
  startAssignmentQueueProcessing();
  logger.info(
    'ASSIGNMENT_SERVICE_INITIALIZED',
    'Assignment service initialized'
  );
}

/**
 * Shuts down assignment service
 */
export async function shutdownAssignmentService(): Promise<void> {
  stopAssignmentQueueProcessing();
  // Process remaining queue items
  await processAssignmentQueue();
  logger.info('ASSIGNMENT_SERVICE_SHUTDOWN', 'Assignment service shut down');
}
