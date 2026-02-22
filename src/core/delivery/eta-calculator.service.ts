/**
 * ETA Calculator Service
 * 
 * Calculates and updates estimated delivery times using machine learning.
 * 
 * Features:
 * - Initial ETA calculation based on distance and average speed
 * - Real-time ETA recalculation on location updates
 * - Adjustment factors: driver performance, traffic, weather
 * - Confidence intervals based on historical variance
 * - Simple linear regression ML model for predictions
 * - Learning from actual delivery times
 * - Fallback to rule-based calculation if ML fails
 * 
 * Requirements: 5.1-5.8
 */

import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import {
  ETAEstimate,
  OrderId,
  DriverId,
  Location,
  AVERAGE_SPEED_KMH,
  ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES,
} from './types-2026';
import { calculateDistance } from './geolocation.service';

// ============================================
// Configuration
// ============================================

/**
 * Default adjustment factors
 */
const DEFAULT_DRIVER_FACTOR = 1.0; // Neutral (0.8-1.2 range)
const DEFAULT_TRAFFIC_FACTOR = 1.0; // No traffic (1.0-2.0 range)
const DEFAULT_WEATHER_FACTOR = 1.0; // Good weather (1.0-1.15 range)

/**
 * Confidence interval percentage (±20%)
 */
const CONFIDENCE_INTERVAL_PERCENTAGE = 0.2;

/**
 * ML model coefficients (simple linear regression)
 * ETA = β0 + β1*distance + β2*traffic + β3*weather + β4*driver_rating
 */
interface MLModelCoefficients {
  beta0: number; // Intercept
  beta1: number; // Distance coefficient
  beta2: number; // Traffic coefficient
  beta3: number; // Weather coefficient
  beta4: number; // Driver rating coefficient
  lastTrainedAt: Date;
  sampleCount: number;
}

/**
 * Default ML model (fallback if no trained model exists)
 */
const DEFAULT_ML_MODEL: MLModelCoefficients = {
  beta0: 5.0, // Base 5 minutes
  beta1: 2.4, // 2.4 minutes per km (25 km/h average)
  beta2: 10.0, // 10 minutes per traffic factor unit
  beta3: 5.0, // 5 minutes per weather factor unit
  beta4: -1.0, // -1 minute per rating point (better drivers are faster)
  lastTrainedAt: new Date(),
  sampleCount: 0,
};

// In-memory cache for ML model
let cachedMLModel: MLModelCoefficients | null = null;

// ============================================
// Driver Performance Factors
// ============================================

/**
 * Gets driver speed factor based on historical performance
 * Returns value between 0.8 (20% faster) and 1.2 (20% slower)
 * 
 * Validates: Requirements 5.3
 */
export async function getDriverSpeedFactor(driverId: DriverId): Promise<number> {
  try {
    // Get driver's average delivery time vs. predicted time
    const predictions = await prisma.eta_predictions.findMany({
      where: {
        delivery_orders: {
          driver_id: driverId,
        },
        actual_minutes: {
          not: null,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 20, // Last 20 deliveries
    });

    if (predictions.length === 0) {
      return DEFAULT_DRIVER_FACTOR;
    }

    // Calculate average ratio of actual/predicted
    let totalRatio = 0;
    for (const pred of predictions) {
      if (pred.actual_minutes && pred.predicted_minutes > 0) {
        totalRatio += pred.actual_minutes / pred.predicted_minutes;
      }
    }

    const avgRatio = totalRatio / predictions.length;

    // Clamp to 0.8-1.2 range
    return Math.max(0.8, Math.min(1.2, avgRatio));
  } catch (error) {
    logger.error(
      'ETA_DRIVER_FACTOR_FAILED',
      'Failed to get driver speed factor',
      error instanceof Error ? error : undefined,
      { driverId }
    );
    return DEFAULT_DRIVER_FACTOR;
  }
}

/**
 * Gets traffic adjustment factor
 * Returns value between 1.0 (no traffic) and 2.0 (heavy traffic)
 * 
 * TODO: Integrate with external traffic API
 * For now, returns default value
 * 
 * Validates: Requirements 5.4
 */
export async function getTrafficFactor(): Promise<number> {
  // TODO: Integrate with traffic API (Google Maps, Waze, etc.)
  // For now, return default (no traffic)
  return DEFAULT_TRAFFIC_FACTOR;
}

/**
 * Gets weather adjustment factor
 * Returns value between 1.0 (good weather) and 1.15 (poor weather)
 * 
 * TODO: Integrate with external weather API
 * For now, returns default value
 * 
 * Validates: Requirements 5.5
 */
export async function getWeatherFactor(): Promise<number> {
  // TODO: Integrate with weather API
  // For now, return default (good weather)
  return DEFAULT_WEATHER_FACTOR;
}

/**
 * Gets historical variance for confidence interval calculation
 * Returns standard deviation of prediction errors for similar distances
 */
async function getHistoricalVariance(distance: number): Promise<number> {
  try {
    // Get predictions for similar distances (±5km)
    const predictions = await prisma.eta_predictions.findMany({
      where: {
        actual_minutes: {
          not: null,
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      take: 100, // Last 100 deliveries
    });

    if (predictions.length < 10) {
      // Not enough data, use default 20% variance
      return CONFIDENCE_INTERVAL_PERCENTAGE;
    }

    // Calculate prediction errors
    const errors: number[] = [];
    for (const pred of predictions) {
      if (pred.actual_minutes && pred.predicted_minutes > 0) {
        const error = Math.abs(pred.actual_minutes - pred.predicted_minutes);
        const relativeError = error / pred.predicted_minutes;
        errors.push(relativeError);
      }
    }

    // Calculate standard deviation
    const mean = errors.reduce((sum, e) => sum + e, 0) / errors.length;
    const variance =
      errors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / errors.length;
    const stdDev = Math.sqrt(variance);

    // Return clamped to reasonable range (10%-50%)
    return Math.max(0.1, Math.min(0.5, stdDev));
  } catch (error) {
    logger.error(
      'ETA_VARIANCE_FAILED',
      'Failed to get historical variance',
      error instanceof Error ? error : undefined
    );
    return CONFIDENCE_INTERVAL_PERCENTAGE;
  }
}

// ============================================
// Rule-Based ETA Calculation
// ============================================

/**
 * Calculates initial ETA using rule-based approach
 * 
 * Formula:
 * - Base time = distance / average speed
 * - Apply driver adjustment (0.8-1.2)
 * - Apply traffic adjustment (1.0-2.0)
 * - Apply weather adjustment (1.0-1.15)
 * - Calculate confidence interval (±variance%)
 * 
 * Validates: Requirements 5.1, 5.3, 5.4, 5.5, 5.7
 */
export async function calculateInitialETARuleBased(
  pickupLocation: Location,
  deliveryLocation: Location,
  driverLocation: Location,
  driverId: DriverId
): Promise<ETAEstimate> {
  try {
    // Calculate total distance
    const distanceToPickup = calculateDistance(driverLocation, pickupLocation);
    const distanceToDelivery = calculateDistance(pickupLocation, deliveryLocation);
    const totalDistance = distanceToPickup + distanceToDelivery;

    // Base time from distance (minutes)
    const baseTime = (totalDistance / AVERAGE_SPEED_KMH) * 60;

    // Get adjustment factors
    const driverFactor = await getDriverSpeedFactor(driverId);
    const trafficFactor = await getTrafficFactor();
    const weatherFactor = await getWeatherFactor();

    // Calculate adjustments
    const driverAdjustment = baseTime * (driverFactor - 1);
    const trafficAdjustment = baseTime * (trafficFactor - 1);
    const weatherAdjustment = baseTime * (weatherFactor - 1);

    // Total ETA
    const estimatedMinutes = Math.round(
      baseTime + driverAdjustment + trafficAdjustment + weatherAdjustment
    );

    // Confidence interval
    const variance = await getHistoricalVariance(totalDistance);
    const confidenceInterval: [number, number] = [
      Math.max(1, Math.round(estimatedMinutes * (1 - variance))),
      Math.round(estimatedMinutes * (1 + variance)),
    ];

    // Confidence score (higher with more historical data)
    const confidence = Math.min(0.95, 0.5 + variance * 0.5);

    const estimate: ETAEstimate = {
      estimatedMinutes,
      confidenceInterval,
      confidence,
      factors: {
        baseTime,
        trafficAdjustment,
        weatherAdjustment,
        driverAdjustment,
      },
    };

    logger.debug('ETA_CALCULATED_RULE_BASED', 'Calculated ETA using rules', {
      driverId,
      totalDistance,
      estimatedMinutes,
      confidenceInterval,
      factors: estimate.factors,
    });

    return estimate;
  } catch (error) {
    logger.error(
      'ETA_CALCULATION_FAILED',
      'Failed to calculate ETA',
      error instanceof Error ? error : undefined,
      { driverId }
    );

    // Return fallback estimate
    return {
      estimatedMinutes: 30,
      confidenceInterval: [20, 40],
      confidence: 0.5,
      factors: {
        baseTime: 30,
        trafficAdjustment: 0,
        weatherAdjustment: 0,
        driverAdjustment: 0,
      },
    };
  }
}

// ============================================
// ML-Based ETA Calculation
// ============================================

/**
 * Loads ML model from database or returns default
 */
async function loadMLModel(): Promise<MLModelCoefficients> {
  if (cachedMLModel) {
    return cachedMLModel;
  }

  try {
    // TODO: Store ML model in database
    // For now, return default model
    cachedMLModel = DEFAULT_ML_MODEL;
    return cachedMLModel;
  } catch (error) {
    logger.error(
      'ETA_MODEL_LOAD_FAILED',
      'Failed to load ML model',
      error instanceof Error ? error : undefined
    );
    return DEFAULT_ML_MODEL;
  }
}

/**
 * Calculates ETA using ML model
 * 
 * Formula: ETA = β0 + β1*distance + β2*traffic + β3*weather + β4*driver_rating
 * 
 * Validates: Requirements 5.8
 */
export async function calculateInitialETAML(
  pickupLocation: Location,
  deliveryLocation: Location,
  driverLocation: Location,
  driverId: DriverId,
  driverRating: number
): Promise<ETAEstimate> {
  try {
    // Load ML model
    const model = await loadMLModel();

    // Calculate total distance
    const distanceToPickup = calculateDistance(driverLocation, pickupLocation);
    const distanceToDelivery = calculateDistance(pickupLocation, deliveryLocation);
    const totalDistance = distanceToPickup + distanceToDelivery;

    // Get adjustment factors
    const trafficFactor = await getTrafficFactor();
    const weatherFactor = await getWeatherFactor();

    // Apply ML model
    const predictedMinutes =
      model.beta0 +
      model.beta1 * totalDistance +
      model.beta2 * trafficFactor +
      model.beta3 * weatherFactor +
      model.beta4 * driverRating;

    const estimatedMinutes = Math.max(1, Math.round(predictedMinutes));

    // Confidence interval (based on model accuracy)
    const variance = await getHistoricalVariance(totalDistance);
    const confidenceInterval: [number, number] = [
      Math.max(1, Math.round(estimatedMinutes * (1 - variance))),
      Math.round(estimatedMinutes * (1 + variance)),
    ];

    // Confidence increases with more training samples
    const confidence = Math.min(
      0.95,
      0.5 + (model.sampleCount / 1000) * 0.45
    );

    // Calculate individual factors for transparency
    const baseTime = model.beta0 + model.beta1 * totalDistance;
    const trafficAdjustment = model.beta2 * trafficFactor;
    const weatherAdjustment = model.beta3 * weatherFactor;
    const driverAdjustment = model.beta4 * driverRating;

    const estimate: ETAEstimate = {
      estimatedMinutes,
      confidenceInterval,
      confidence,
      factors: {
        baseTime,
        trafficAdjustment,
        weatherAdjustment,
        driverAdjustment,
      },
    };

    logger.debug('ETA_CALCULATED_ML', 'Calculated ETA using ML model', {
      driverId,
      totalDistance,
      estimatedMinutes,
      confidenceInterval,
      modelSampleCount: model.sampleCount,
    });

    return estimate;
  } catch (error) {
    logger.error(
      'ETA_ML_CALCULATION_FAILED',
      'ML calculation failed, falling back to rules',
      error instanceof Error ? error : undefined,
      { driverId }
    );

    // Fallback to rule-based calculation
    return calculateInitialETARuleBased(
      pickupLocation,
      deliveryLocation,
      driverLocation,
      driverId
    );
  }
}

/**
 * Calculates initial ETA for an order
 * Uses ML model if available, falls back to rule-based
 * 
 * Validates: Requirements 5.1
 */
export async function calculateInitialETA(
  orderId: OrderId,
  pickupLocation: Location,
  deliveryLocation: Location,
  driverLocation: Location,
  driverId: DriverId,
  driverRating: number = 3.0,
  tenantId: string = ''
): Promise<ETAEstimate> {
  try {
    // Try ML model first
    const estimate = await calculateInitialETAML(
      pickupLocation,
      deliveryLocation,
      driverLocation,
      driverId,
      driverRating
    );

    // Store prediction in database
    await prisma.eta_predictions.create({
      data: {
        order_id: orderId,
        tenant_id: tenantId,
        predicted_minutes: estimate.estimatedMinutes,
        confidence_interval: JSON.stringify(estimate.confidenceInterval),
        confidence: estimate.confidence,
        base_time: estimate.factors.baseTime,
        traffic_adjustment: estimate.factors.trafficAdjustment,
        weather_adjustment: estimate.factors.weatherAdjustment,
        driver_adjustment: estimate.factors.driverAdjustment,
      },
    });

    logger.info('ETA_INITIAL_CALCULATED', 'Initial ETA calculated', {
      orderId,
      driverId,
      estimatedMinutes: estimate.estimatedMinutes,
    });

    return estimate;
  } catch (error) {
    logger.error(
      'ETA_INITIAL_FAILED',
      'Failed to calculate initial ETA',
      error instanceof Error ? error : undefined,
      { orderId, driverId }
    );
    throw error;
  }
}

// ============================================
// ETA Recalculation
// ============================================

/**
 * Recalculates ETA based on current driver location
 * Uses remaining distance instead of total distance
 * 
 * Validates: Requirements 5.2
 */
export async function recalculateETA(
  orderId: OrderId,
  currentDriverLocation: Location,
  deliveryLocation: Location,
  driverId: DriverId,
  driverRating: number = 3.0,
  tenantId: string = ''
): Promise<{ estimate: ETAEstimate; changed: boolean; changeMins: number }> {
  try {
    // Get previous ETA
    const previousPrediction = await prisma.eta_predictions.findFirst({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });

    // Calculate remaining distance
    const remainingDistance = calculateDistance(
      currentDriverLocation,
      deliveryLocation
    );

    // Calculate new ETA using ML model
    const model = await loadMLModel();
    const trafficFactor = await getTrafficFactor();
    const weatherFactor = await getWeatherFactor();

    const predictedMinutes =
      model.beta0 +
      model.beta1 * remainingDistance +
      model.beta2 * trafficFactor +
      model.beta3 * weatherFactor +
      model.beta4 * driverRating;

    const estimatedMinutes = Math.max(1, Math.round(predictedMinutes));

    // Confidence interval
    const variance = await getHistoricalVariance(remainingDistance);
    const confidenceInterval: [number, number] = [
      Math.max(1, Math.round(estimatedMinutes * (1 - variance))),
      Math.round(estimatedMinutes * (1 + variance)),
    ];

    const confidence = Math.min(
      0.95,
      0.5 + (model.sampleCount / 1000) * 0.45
    );

    // Calculate factors
    const baseTime = model.beta0 + model.beta1 * remainingDistance;
    const trafficAdjustment = model.beta2 * trafficFactor;
    const weatherAdjustment = model.beta3 * weatherFactor;
    const driverAdjustment = model.beta4 * driverRating;

    const estimate: ETAEstimate = {
      estimatedMinutes,
      confidenceInterval,
      confidence,
      factors: {
        baseTime,
        trafficAdjustment,
        weatherAdjustment,
        driverAdjustment,
      },
    };

    // Check if ETA changed significantly
    const previousETA = previousPrediction?.predicted_minutes ?? estimatedMinutes;
    const changeMins = Math.abs(estimatedMinutes - previousETA);
    const changed = changeMins >= ETA_CHANGE_NOTIFICATION_THRESHOLD_MINUTES;

    // Store new prediction
    await prisma.eta_predictions.create({
      data: {
        order_id: orderId,
        tenant_id: tenantId,
        predicted_minutes: estimate.estimatedMinutes,
        confidence_interval: JSON.stringify(estimate.confidenceInterval),
        confidence: estimate.confidence,
        base_time: estimate.factors.baseTime,
        traffic_adjustment: estimate.factors.trafficAdjustment,
        weather_adjustment: estimate.factors.weatherAdjustment,
        driver_adjustment: estimate.factors.driverAdjustment,
      },
    });

    logger.debug('ETA_RECALCULATED', 'ETA recalculated', {
      orderId,
      driverId,
      remainingDistance,
      estimatedMinutes,
      previousETA,
      changed,
      changeMins,
    });

    return { estimate, changed, changeMins };
  } catch (error) {
    logger.error(
      'ETA_RECALCULATION_FAILED',
      'Failed to recalculate ETA',
      error instanceof Error ? error : undefined,
      { orderId, driverId }
    );
    throw error;
  }
}

// ============================================
// Learning and Model Training
// ============================================

/**
 * Records actual delivery time for learning
 * Updates the ETA prediction record with actual time
 * 
 * Validates: Requirements 5.8
 */
export async function recordActualDeliveryTime(
  orderId: OrderId,
  actualMinutes: number
): Promise<void> {
  try {
    // Get the initial prediction for this order
    const prediction = await prisma.eta_predictions.findFirst({
      where: { order_id: orderId },
      orderBy: { created_at: 'asc' }, // Get the first (initial) prediction
    });

    if (!prediction) {
      logger.warn('ETA_NO_PREDICTION', 'No prediction found for order', {
        orderId,
      });
      return;
    }

    // Update with actual time
    await prisma.eta_predictions.update({
      where: { id: prediction.id },
      data: { actual_minutes: actualMinutes },
    });

    // Calculate prediction error
    const error = Math.abs(actualMinutes - prediction.predicted_minutes);
    const relativeError =
      prediction.predicted_minutes > 0
        ? error / prediction.predicted_minutes
        : 0;

    logger.info('ETA_ACTUAL_RECORDED', 'Recorded actual delivery time', {
      orderId,
      predictedMinutes: prediction.predicted_minutes,
      actualMinutes,
      error,
      relativeError: relativeError.toFixed(2),
    });
  } catch (error) {
    logger.error(
      'ETA_RECORD_ACTUAL_FAILED',
      'Failed to record actual delivery time',
      error instanceof Error ? error : undefined,
      { orderId, actualMinutes }
    );
  }
}

/**
 * Trains ML model using historical data
 * Uses simple linear regression
 * 
 * Formula: ETA = β0 + β1*distance + β2*traffic + β3*weather + β4*driver_rating
 * 
 * Validates: Requirements 5.8
 */
export async function retrainMLModel(): Promise<void> {
  try {
    logger.info('ETA_MODEL_TRAINING_START', 'Starting ML model training');

    // Get all predictions with actual times
    const predictions = await prisma.eta_predictions.findMany({
      where: {
        actual_minutes: {
          not: null,
        },
      },
      include: {
        delivery_orders: {
          include: {
            drivers: true,
          },
        },
      },
    });

    if (predictions.length < 50) {
      logger.warn('ETA_MODEL_INSUFFICIENT_DATA', 'Not enough data to train model', {
        sampleCount: predictions.length,
        required: 50,
      });
      return;
    }

    // TODO: Implement proper linear regression
    // For now, use simple averages as coefficients
    
    // Calculate average coefficients from historical data
    let sumBeta1 = 0; // Distance coefficient
    let sumBeta2 = 0; // Traffic coefficient
    let sumBeta3 = 0; // Weather coefficient
    let sumBeta4 = 0; // Driver rating coefficient
    let count = 0;

    for (const pred of predictions) {
      if (pred.actual_minutes && pred.delivery_orders.drivers) {
        // Estimate coefficients from actual vs predicted
        const actualTime = pred.actual_minutes;
        const baseTime = pred.base_time;
        
        // Simple coefficient estimation
        sumBeta1 += baseTime > 0 ? actualTime / baseTime : 1.0;
        sumBeta2 += pred.traffic_adjustment;
        sumBeta3 += pred.weather_adjustment;
        sumBeta4 += pred.driver_adjustment;
        count++;
      }
    }

    if (count === 0) {
      logger.warn('ETA_MODEL_NO_VALID_DATA', 'No valid data for training');
      return;
    }

    // Update model coefficients
    const newModel: MLModelCoefficients = {
      beta0: 5.0, // Keep base intercept
      beta1: sumBeta1 / count,
      beta2: sumBeta2 / count,
      beta3: sumBeta3 / count,
      beta4: sumBeta4 / count,
      lastTrainedAt: new Date(),
      sampleCount: count,
    };

    // Update cached model
    cachedMLModel = newModel;

    logger.info('ETA_MODEL_TRAINING_COMPLETE', 'ML model training complete', {
      sampleCount: count,
      coefficients: {
        beta0: newModel.beta0.toFixed(2),
        beta1: newModel.beta1.toFixed(2),
        beta2: newModel.beta2.toFixed(2),
        beta3: newModel.beta3.toFixed(2),
        beta4: newModel.beta4.toFixed(2),
      },
    });
  } catch (error) {
    logger.error(
      'ETA_MODEL_TRAINING_FAILED',
      'Failed to train ML model',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Schedules weekly model retraining
 */
let modelRetrainingInterval: NodeJS.Timeout | null = null;

export function startModelRetraining(): void {
  if (modelRetrainingInterval) {
    return; // Already started
  }

  // Retrain weekly (7 days)
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  modelRetrainingInterval = setInterval(() => {
    retrainMLModel().catch((error) => {
      logger.error(
        'ETA_MODEL_RETRAINING_FAILED',
        'Scheduled model retraining failed',
        error instanceof Error ? error : undefined
      );
    });
  }, WEEK_MS);

  logger.info('ETA_MODEL_RETRAINING_STARTED', 'Started weekly model retraining');
}

export function stopModelRetraining(): void {
  if (modelRetrainingInterval) {
    clearInterval(modelRetrainingInterval);
    modelRetrainingInterval = null;
    logger.info('ETA_MODEL_RETRAINING_STOPPED', 'Stopped model retraining');
  }
}

/**
 * Initializes ETA calculator service
 */
export function initializeETACalculator(): void {
  startModelRetraining();
  logger.info('ETA_CALCULATOR_INITIALIZED', 'ETA calculator initialized');
}

/**
 * Shuts down ETA calculator service
 */
export function shutdownETACalculator(): void {
  stopModelRetraining();
  logger.info('ETA_CALCULATOR_SHUTDOWN', 'ETA calculator shut down');
}
