/**
 * Endpoint API de historial de ubicaciones
 *
 * GET /api/locations/history/:driverId?startDate=...&endDate=...
 * Obtener historial de ubicaciones de un repartidor en un rango de fechas
 *
 * Requisitos: 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLocationHistory } from '@/src/core/delivery/geolocation.service';
import { toDriverId } from '@/src/core/delivery/types-2026';
import { logger } from '@/src/core/observability/logger';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';

interface RouteParams {
  params: Promise<{
    driverId: string;
  }>;
}

/**
 * GET /api/locations/history/:driverId
 * Obtener historial de ubicaciones de un repartidor
 *
 * Parámetros de consulta:
 * - startDate: fecha ISO 8601
 * - endDate: fecha ISO 8601
 *
 * Requiere autenticación POS
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { driverId } = await params;
    const { searchParams } = new URL(request.url);

    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json(
        {
          error: 'Faltan parámetros requeridos: startDate, endDate',
        },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Formato de fecha inválido. Usar formato ISO 8601.',
        },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          error: 'startDate debe ser anterior a endDate',
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
    logger.error('LOCATION_HISTORY_ERROR', 'Error al obtener historial de ubicaciones', error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
