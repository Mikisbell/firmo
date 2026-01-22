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
            type: true,
          },
        },
        dismissed_by_employee: {
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
      stationType: alert.stations.type,
      message: alert.message,
      severity: alert.severity,
      metricType: alert.metric_type,
      metricValue: alert.metric_value,
      threshold: alert.threshold,
      isDismissed: alert.is_dismissed,
      dismissedAt: alert.dismissed_at?.toISOString() || null,
      dismissedBy: alert.dismissed_by_employee ? {
        id: alert.dismissed_by_employee.id,
        name: alert.dismissed_by_employee.name,
      } : null,
      createdAt: alert.created_at.toISOString(),
    }));

    return NextResponse.json({
      alerts: formattedAlerts,
      count: formattedAlerts.length,
    });

  } catch (error) {
    console.error('Error fetching station alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
