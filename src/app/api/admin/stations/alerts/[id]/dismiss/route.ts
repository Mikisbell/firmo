/**
 * POST /api/admin/stations/alerts/:id/dismiss
 * 
 * Dismiss a station alert
 * 
 * Requirements: 2.3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { verifyAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const alertId = params.id;

    // Check if alert exists and belongs to tenant
    const alert = await prisma.station_alerts.findFirst({
      where: {
        id: alertId,
        tenant_id: user.tenantId,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Check if already dismissed
    if (alert.is_dismissed) {
      return NextResponse.json(
        { error: 'Alert already dismissed' },
        { status: 400 }
      );
    }

    // Dismiss the alert
    const updatedAlert = await prisma.station_alerts.update({
      where: { id: alertId },
      data: {
        is_dismissed: true,
        dismissed_at: new Date(),
        dismissed_by: user.id || null,
      },
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
    });

    // Format response
    const formattedAlert = {
      id: updatedAlert.id,
      stationId: updatedAlert.station_id,
      stationName: updatedAlert.stations.name,
      stationType: updatedAlert.stations.type,
      message: updatedAlert.message,
      severity: updatedAlert.severity,
      metricType: updatedAlert.metric_type,
      metricValue: updatedAlert.metric_value,
      threshold: updatedAlert.threshold,
      isDismissed: updatedAlert.is_dismissed,
      dismissedAt: updatedAlert.dismissed_at?.toISOString() || null,
      dismissedBy: updatedAlert.dismissed_by_employee ? {
        id: updatedAlert.dismissed_by_employee.id,
        name: updatedAlert.dismissed_by_employee.name,
      } : null,
      createdAt: updatedAlert.created_at.toISOString(),
    };

    return NextResponse.json({
      alert: formattedAlert,
      message: 'Alert dismissed successfully',
    });

  } catch (error) {
    console.error('Error dismissing alert:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss alert' },
      { status: 500 }
    );
  }
}
