/**
 * Location API Endpoints
 * 
 * POST /api/locations - Driver updates location
 * GET /api/locations/drivers - Get all active driver locations (admin)
 * 
 * Requirements: 2.1, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  updateDriverLocation,
  getActiveDriverLocations,
} from '@/src/core/delivery/geolocation.service';
import { toDriverId } from '@/src/core/delivery/types-2026';
import { logger } from '@/src/core/observability/logger';

// Validation schema for location update
const locationUpdateSchema = z.object({
  driverId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime(),
});

/**
 * POST /api/locations
 * Driver updates their location
 * 
 * Body:
 * {
 *   driverId: string,
 *   latitude: number,
 *   longitude: number,
 *   accuracy: number,
 *   speed?: number,
 *   heading?: number,
 *   timestamp: string (ISO 8601)
 * }
 * 
 * Validates: Requirements 2.1
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = locationUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Update location
    await updateDriverLocation(toDriverId(data.driverId), {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      timestamp: new Date(data.timestamp),
    });

    return NextResponse.json({
      success: true,
      message: 'Location updated successfully',
    });
  } catch (error) {
    logger.error('LOCATION_UPDATE_ERROR', 'Failed to update location', error instanceof Error ? error : undefined);

    if (error instanceof Error && error.message.includes('Invalid coordinates')) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/locations/drivers
 * Get all active driver locations (admin only)
 * 
 * Response:
 * {
 *   drivers: Array<{
 *     driverId: string,
 *     location: {
 *       latitude: number,
 *       longitude: number,
 *       accuracy: number,
 *       speed?: number,
 *       heading?: number,
 *       timestamp: string
 *     }
 *   }>
 * }
 * 
 * Validates: Requirements 2.3
 */
export async function GET(request: NextRequest) {
  try {
    const locations = await getActiveDriverLocations();

    // Convert Map to array
    const drivers = Array.from(locations.entries()).map(
      ([driverId, location]) => ({
        driverId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          timestamp: location.timestamp.toISOString(),
        },
      })
    );

    return NextResponse.json({
      drivers,
      count: drivers.length,
    });
  } catch (error) {
    logger.error('DRIVER_LOCATIONS_ERROR', 'Failed to get driver locations', error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
