/**
 * GET /api/admin/stations/alerts
 * 
 * Fetch non-dismissed alerts for stations
 * Supports filtering by stationId and severity
 * 
 * Requirements: 2.3.4, 2.3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { verifyAdminAuth } from '@/src/core/middleware/admin-auth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const stationId = searchParams.get('stationId');
    const severity = searchParams.get('severity');
    const includeDismissed = searchParams.get('includeDismissed') === 'true';

    // Build where clause
    const where: any = {
      tenant_id: user.tenantId,
    };

    if (stationId) {
      where.station_id = stationId;
    }

    if (severity) {
      where.severity = severity;
    }

    if (!includeDismissed) {
      where.is_dismissed = false;
    }

    // Query alerts with station info
    const alerts = await prisma.station_alerts.findMany({
      where,
      include: {
        stations: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        employees: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Format response
    const formattedAlerts = alerts.map((alert: any) => ({
      id: alert.id,
      stationId: alert.station_id,
      stationName: alert.stations.name,
      stationCode: alert.stations.code,
      message: alert.message,
      severity: alert.severity,
      metricType: alert.metric_type,
      metricValue: alert.metric_value,
      threshold: alert.threshold_value,
      isDismissed: alert.is_dismissed,
      dismissedAt: alert.dismissed_at?.toISOString() || null,
      dismissedBy: alert.employees ? {
        id: alert.employees.id,
        name: alert.employees.name,
      } : null,
      createdAt: alert.created_at.toISOString(),
    }));

    return NextResponse.json({
      alerts: formattedAlerts,
      count: formattedAlerts.length,
    });

  } catch (error) {
    logger.error('Error al obtener alertas de estaciones', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al obtener alertas' },
      { status: 500 }
    );
  }
}
