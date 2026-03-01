// src/app/api/admin/stations/[id]/metrics/route.ts
// GET endpoint for real-time station metrics
// Created: 22 Enero 2026

import { NextRequest, NextResponse } from 'next/server';
import { calculateStationMetrics } from '../../services/metrics-service';
import { cache } from '@/src/core/cache/redis.service';
import { getMetricsCacheKey, CACHE_TTL } from '../../services/cache-keys';
import { pinoLogger } from '@/src/core/observability/logger-pino';
import { verifyAdminAuth } from '@/src/core/middleware/admin-auth';

/**
 * GET /api/admin/stations/:id/metrics
 * 
 * Returns real-time metrics for a specific KDS station
 * 
 * Authentication: Admin only
 * Cache: 5 minutes TTL
 * 
 * Response:
 * {
 *   stationId: string;
 *   stationCode: string;
 *   activeOrders: number;
 *   avgTime: number;
 *   efficiency: number;
 *   load: number;
 *   estimatedTime: number;
 *   lastUpdated: string;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    pinoLogger.info({ stationId: id }, 'Fetching station metrics');

    // Check cache first (5 minute TTL)
    const cacheKey = getMetricsCacheKey(id);
    const cached = await cache.get(cacheKey);

    if (cached) {
      pinoLogger.debug({ stationId: id }, 'Metrics cache hit');
      return NextResponse.json(cached);
    }

    // Get station by ID to find the code
    const { default: prisma } = await import('@/src/core/db/prisma');

    const station = await prisma.stations.findUnique({
      where: { id },
      select: { code: true },
    });

    if (!station) {
      pinoLogger.warn({ stationId: id }, 'Station not found');
      return NextResponse.json(
        { error: 'Estación no encontrada' },
        { status: 404 }
      );
    }

    // Calculate metrics
    const metrics = await calculateStationMetrics(station.code);

    // Cache for 5 minutes
    await cache.set(cacheKey, metrics, CACHE_TTL.METRICS);

    pinoLogger.info(
      { stationId: id, metrics },
      'Station metrics calculated and cached'
    );

    return NextResponse.json(metrics);
  } catch (error) {
    const resolvedParams = await params;
    pinoLogger.error({ error, stationId: resolvedParams.id }, 'Error fetching station metrics');

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
