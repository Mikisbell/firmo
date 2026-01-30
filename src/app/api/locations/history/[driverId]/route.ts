/**
 * Location History API Endpoint
 * 
 * GET /api/locations/history/:driverId?startDate=...&endDate=...
 * Get location history for a driver within a date range
 * 
 * Requirements: 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLocationHistory } from '@/src/core/delivery/geolocation.service';
import { toDriverId } from '@/src/core/delivery/types-2026';
import { logger } from '@/src/core/observability/logger';

interface RouteParams {
  params: Promise<{
    driverId: string;
  }>;
}

/**
 * GET /api/locations/history/:driverId
 * Get location history for a driver
 * 
 * Query params:
 * - startDate: ISO 8601 date string
 * - endDate: ISO 8601 date string
 * 
 * Response:
 * {
 *   driverId: string,
 *   locations: Array<{
 *     latitude: number,
 *     longitude: number,
 *     accuracy: number,
 *     speed?: number,
 *     heading?: number,
 *     timestamp: string
 *   }>
 * }
 * 
 * Validates: Requirements 2.2
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { driverId } = await params;
    const { searchParams } = new URL(request.url);

    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        {
          error: 'Missing required query parameters: startDate, endDate',
        },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid date format. Use ISO 8601 format.',
        },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          error: 'startDate must be before endDate',
        },
        { status: 400 }
      );
    }

    const locations = await getLocationHistory(
      toDriverId(driverId),
      startDate,
      endDate
    );

    return NextResponse.json({
      driverId,
      locations: locations.map((loc) => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        speed: loc.speed,
        heading: loc.heading,
        timestamp: loc.timestamp.toISOString(),
      })),
      count: locations.length,
    });
  } catch (error) {
    logger.error('LOCATION_HISTORY_ERROR', 'Failed to get location history', error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
