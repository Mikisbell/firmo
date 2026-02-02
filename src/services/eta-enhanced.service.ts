/**
 * Enhanced ETA Calculator Service
 * 
 * Implements ML-enhanced delivery time estimation with:
 * - Historical data analysis
 * - Traffic pattern recognition
 * - Weather integration
 * - Real-time adjustments
 * - Confidence scoring
 */

import { PrismaClient } from '@prisma/client';

type PrismaClientType = any;

export interface DeliveryRequest {
  restaurantLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  orderSize: 'SMALL' | 'MEDIUM' | 'LARGE' | 'EXTRA_LARGE';
  preparationTime: number; // minutes
  distance?: number; // kilometers (calculated if not provided)
  trafficLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  weatherCondition?: 'CLEAR' | 'RAIN' | 'SNOW' | 'FOG' | 'WIND';
  timeOfDay: 'MORNING' | 'NOON' | 'EVENING' | 'NIGHT';
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
}

export interface ETAResult {
  estimatedTimeMinutes: number;
  confidenceScore: number; // 0-100
  estimatedArrival: Date;
  breakdown: {
    preparation: number;
    travel: number;
    waiting: number;
    buffer: number;
  };
  factors: {
    distance: number;
    trafficMultiplier: number;
    weatherMultiplier: number;
    timeOfDayMultiplier: number;
    driverAvailability: number;
  };
  alternativeOptions?: Array<{
    minutes: number;
    confidence: number;
    type: 'EXPRESS' | 'STANDARD' | 'ECONOMY';
  }>;
}

export interface HistoricalData {
  averageTime: number;
  standardDeviation: number;
  sampleSize: number;
  timeOfDay: string;
  dayOfWeek: string;
  weatherCondition?: string;
}

class EnhancedETACalculator {
  private prisma: PrismaClientType;
  private weights = {
    preparation: 0.3,
    travel: 0.5,
    traffic: 0.15,
    weather: 0.05,
  };

  // Base times in minutes
  private basePreparationTimes = {
    SMALL: 5,
    MEDIUM: 10,
    LARGE: 15,
    EXTRA_LARGE: 20,
  };

  // Average speeds in km/h for different conditions
  private averageSpeeds = {
    CLEAR: { CITY: 25, HIGHWAY: 60 },
    RAIN: { CITY: 20, HIGHWAY: 45 },
    SNOW: { CITY: 15, HIGHWAY: 30 },
    FOG: { CITY: 18, HIGHWAY: 35 },
    WIND: { CITY: 22, HIGHWAY: 50 },
  };

  constructor(prisma: PrismaClientType) {
    this.prisma = prisma;
  }

  /**
   * Calculate enhanced ETA with ML-like analysis
   */
  async calculateETA(request: DeliveryRequest): Promise<ETAResult> {
    // 1. Calculate distance if not provided
    const distance = request.distance || await this.calculateDistance(
      request.restaurantLocation,
      request.deliveryLocation
    );

    // 2. Get historical data
    const historicalData = await this.getHistoricalData(request);

    // 3. Calculate traffic impact
    const trafficMultiplier = this.calculateTrafficMultiplier(
      request.timeOfDay,
      request.dayOfWeek,
      request.trafficLevel || 'MEDIUM'
    );

    // 4. Calculate weather impact
    const weatherMultiplier = this.calculateWeatherMultiplier(
      request.weatherCondition || 'CLEAR'
    );

    // 5. Calculate time of day impact
    const timeOfDayMultiplier = this.calculateTimeOfDayMultiplier(request.timeOfDay);

    // 6. Check driver availability
    const driverAvailability = await this.getDriverAvailabilityFactor(
      request.restaurantLocation.lat,
      request.restaurantLocation.lng
    );

    // 7. Calculate preparation time with historical adjustments
    const basePreparationTime = this.basePreparationTimes[request.orderSize];
    const preparationTime = this.adjustPreparationTime(
      basePreparationTime,
      historicalData
    );

    // 8. Calculate travel time
    const baseTravelTime = this.calculateBaseTravelTime(distance, 'CLEAR');
    const travelTime = baseTravelTime * trafficMultiplier * weatherMultiplier;

    // 9. Calculate waiting and buffer times
    const waitingTime = this.calculateWaitingTime(request.timeOfDay);
    const bufferTime = this.calculateBufferTime(
      preparationTime,
      travelTime,
      historicalData
    );

    // 10. Calculate total estimated time
    const totalTime = preparationTime + travelTime + waitingTime + bufferTime;

    // 11. Calculate confidence score
    const confidenceScore = this.calculateConfidenceScore(
      historicalData,
      distance,
      request.trafficLevel !== undefined,
      request.weatherCondition !== undefined
    );

    // 12. Generate alternative options
    const alternativeOptions = this.generateAlternatives(
      totalTime,
      confidenceScore,
      request
    );

    const estimatedArrival = new Date(Date.now() + totalTime * 60 * 1000);

    return {
      estimatedTimeMinutes: Math.round(totalTime),
      confidenceScore,
      estimatedArrival,
      breakdown: {
        preparation: Math.round(preparationTime),
        travel: Math.round(travelTime),
        waiting: Math.round(waitingTime),
        buffer: Math.round(bufferTime),
      },
      factors: {
        distance,
        trafficMultiplier,
        weatherMultiplier,
        timeOfDayMultiplier,
        driverAvailability,
      },
      alternativeOptions,
    };
  }

  /**
   * Calculate distance between two points
   */
  private async calculateDistance(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number }
  ): Promise<number> {
    // Haversine formula for calculating distance
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(to.lat - from.lat);
    const dLng = this.toRadians(to.lng - from.lng);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.lat)) * Math.cos(this.toRadians(to.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // Add urban complexity factor (simplified)
    return distance * 1.2; // 20% longer in urban areas
  }

  /**
   * Get historical delivery data
   */
  private async getHistoricalData(
    request: DeliveryRequest
  ): Promise<HistoricalData | null> {
    const historicalDeliveries = await this.prisma.delivery_orders.findMany({
      where: {
        tenant_id: await this.getTenantId(),
        status: 'DELIVERED',
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      select: {
        delivery_time_mins: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 1000, // Analyze last 1000 deliveries
    });

    if (historicalDeliveries.length < 10) {
      return null; // Not enough data
    }

    // Filter by similar conditions
    const similarDeliveries = historicalDeliveries.filter(delivery => {
      const deliveryHour = new Date(delivery.created_at).getHours();
      const requestHour = this.getTimeOfDayHour(request.timeOfDay);
      
      return Math.abs(deliveryHour - requestHour) <= 2; // Within 2 hours
    });

    if (similarDeliveries.length === 0) {
      return null;
    }

    const times = similarDeliveries.map(d => d.delivery_time_mins || 0);
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      averageTime: average,
      standardDeviation,
      sampleSize: similarDeliveries.length,
      timeOfDay: request.timeOfDay,
      dayOfWeek: request.dayOfWeek,
      weatherCondition: request.weatherCondition,
    };
  }

  /**
   * Calculate traffic multiplier based on time and day
   */
  private calculateTrafficMultiplier(
    timeOfDay: string,
    dayOfWeek: string,
    trafficLevel: string
  ): number {
    const baseMultipliers = {
      MORNING: { WEEKDAY: 1.2, WEEKEND: 1.0 },
      NOON: { WEEKDAY: 1.4, WEEKEND: 1.1 },
      EVENING: { WEEKDAY: 1.6, WEEKEND: 1.3 },
      NIGHT: { WEEKDAY: 1.1, WEEKEND: 1.0 },
    };

    const trafficMultipliers = {
      LOW: 0.9,
      MEDIUM: 1.0,
      HIGH: 1.3,
      CRITICAL: 1.8,
    };

    const isWeekend = ['SATURDAY', 'SUNDAY'].includes(dayOfWeek);
    const timeKey = isWeekend ? 'WEEKEND' : 'WEEKDAY';
    const baseMultiplier = baseMultipliers[timeOfDay]?.[timeKey] || 1.0;

    return baseMultiplier * trafficMultipliers[trafficLevel];
  }

  /**
   * Calculate weather multiplier
   */
  private calculateWeatherMultiplier(weatherCondition: string): number {
    const multipliers = {
      CLEAR: 1.0,
      RAIN: 1.3,
      SNOW: 1.8,
      FOG: 1.5,
      WIND: 1.2,
    };

    return multipliers[weatherCondition] || 1.0;
  }

  /**
   * Calculate time of day multiplier
   */
  private calculateTimeOfDayMultiplier(timeOfDay: string): number {
    const multipliers = {
      MORNING: 1.1,
      NOON: 1.2,
      EVENING: 1.3,
      NIGHT: 1.4, // Slower at night due to limited visibility
    };

    return multipliers[timeOfDay] || 1.0;
  }

  /**
   * Get driver availability factor
   */
  private async getDriverAvailabilityFactor(lat: number, lng: number): Promise<number> {
    // Count available drivers within a certain radius
    const availableDrivers = await this.prisma.drivers.count({
      where: {
        tenant_id: await this.getTenantId(),
        is_active: true,
        location_history: {
          some: {
            created_at: {
            gte: new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
          },
          },
        },
      },
    });

    // More drivers = better availability = lower factor
    if (availableDrivers >= 5) return 1.0;
    if (availableDrivers >= 3) return 1.1;
    if (availableDrivers >= 1) return 1.3;
    return 2.0; // No drivers available
  }

  /**
   * Adjust preparation time based on historical data
   */
  private adjustPreparationTime(
    baseTime: number,
    historicalData: HistoricalData | null
  ): number {
    if (!historicalData) return baseTime;

    // If historical times are consistently higher or lower, adjust
    const adjustment = (historicalData.averageTime - baseTime) * 0.2; // 20% adjustment
    return Math.max(baseTime + adjustment, baseTime * 0.5); // Never less than 50% of base
  }

  /**
   * Calculate base travel time
   */
  private calculateBaseTravelTime(distance: number, weatherCondition: string): number {
    // Assume mix of city and highway driving
    const avgSpeed = this.averageSpeeds[weatherCondition];
    const averageSpeed = (avgSpeed.CITY + avgSpeed.HIGHWAY) / 2;
    
    return (distance / averageSpeed) * 60; // Convert to minutes
  }

  /**
   * Calculate waiting time
   */
  private calculateWaitingTime(timeOfDay: string): number {
    const baseWaiting = {
      MORNING: 2,
      NOON: 5,
      EVENING: 3,
      NIGHT: 1,
    };

    return baseWaiting[timeOfDay] || 3;
  }

  /**
   * Calculate buffer time based on uncertainty
   */
  private calculateBufferTime(
    preparationTime: number,
    travelTime: number,
    historicalData: HistoricalData | null
  ): number {
    let buffer = 5; // Base 5 minutes

    if (historicalData && historicalData.standardDeviation > 10) {
      buffer += historicalData.standardDeviation * 0.2; // Add 20% of std dev
    }

    // Add buffer for longer deliveries
    const totalTime = preparationTime + travelTime;
    if (totalTime > 60) buffer += 10;
    if (totalTime > 90) buffer += 15;

    return buffer;
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(
    historicalData: HistoricalData | null,
    distance: number,
    hasTrafficData: boolean,
    hasWeatherData: boolean
  ): number {
    let confidence = 70; // Base confidence

    // More historical data = higher confidence
    if (historicalData) {
      confidence += Math.min(historicalData.sampleSize * 2, 20);
      confidence -= Math.min(historicalData.standardDeviation, 10);
    }

    // Known conditions = higher confidence
    if (hasTrafficData) confidence += 10;
    if (hasWeatherData) confidence += 5;

    // Long distances = lower confidence
    if (distance > 20) confidence -= 15;
    if (distance > 50) confidence -= 25;

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Generate alternative delivery options
   */
  private generateAlternatives(
    baseTime: number,
    confidence: number,
    request: DeliveryRequest
  ): Array<{
    minutes: number;
    confidence: number;
    type: 'EXPRESS' | 'STANDARD' | 'ECONOMY';
  }> {
    const alternatives: Array<{
      minutes: number;
      confidence: number;
      type: 'EXPRESS' | 'STANDARD' | 'ECONOMY';
    }> = [];

    // Express: Faster but more expensive
    alternatives.push({
      minutes: Math.round(baseTime * 0.7), // 30% faster
      confidence: Math.max(confidence - 20, 40), // Lower confidence
      type: 'EXPRESS',
    });

    // Economy: Slower but cheaper
    alternatives.push({
      minutes: Math.round(baseTime * 1.5), // 50% slower
      confidence: Math.min(confidence + 10, 90), // Higher confidence (more predictable)
      type: 'ECONOMY',
    });

    return alternatives;
  }

  /**
   * Utility functions
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getTimeOfDayHour(timeOfDay: string): number {
    const hourMap = {
      MORNING: 6, // 6 AM - 12 PM
      NOON: 12,  // 12 PM - 6 PM
      EVENING: 18, // 6 PM - 12 AM
      NIGHT: 0,   // 12 AM - 6 AM
    };
    return hourMap[timeOfDay] || 12;
  }

  private async getTenantId(): Promise<string> {
    // This would typically come from request context or config
    return process.env.TENANT_ID || 'default-tenant';
  }

  /**
   * Update ETA calculation model with new data
   */
  async updateModel(
    actualDeliveryTime: number,
    predictedTime: number,
    factors: any
  ): Promise<void> {
    const error = actualDeliveryTime - predictedTime;
    const errorPercentage = (error / predictedTime) * 100;

    // Store for model improvement
    await this.prisma.eta_learning_data.create({
      data: {
        id: this.generateId(),
        tenant_id: await this.getTenantId(),
        predicted_time: predictedTime,
        actual_time: actualDeliveryTime,
        error_minutes: error,
        error_percentage: errorPercentage,
        factors: JSON.stringify(factors),
        created_at: new Date(),
      },
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export default EnhancedETACalculator;