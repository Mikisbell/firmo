/**
 * POST /api/admin/stations/alerts/:id/dismiss
 * 
 * Dismiss a station alert
 * 
 * Requirements: 2.3.5
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';
import { verifyAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const { id: alertId } = await params;

    // Check if alert exists and belongs to tenant
    const alert = await prisma.station_alerts.findFirst({
      where: {
        id: alertId,
        tenant_id: user.tenantId,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }

    // Check if already dismissed
    if (alert.is_dismissed) {
      return NextResponse.json(
        { error: 'Alerta ya descartada' },
        { status: 400 }
      );
    }

    // Dismiss the alert
    const updatedAlert = await prisma.station_alerts.update({
      where: { id: alertId, tenant_id: user.tenantId },
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
    });

    // Format response
    const formattedAlert = {
      id: updatedAlert.id,
      stationId: updatedAlert.station_id,
      stationName: updatedAlert.stations.name,
      stationCode: updatedAlert.stations.code,
      message: updatedAlert.message,
      severity: updatedAlert.severity,
      metricType: updatedAlert.metric_type,
      metricValue: updatedAlert.metric_value,
      threshold: updatedAlert.threshold_value,
      isDismissed: updatedAlert.is_dismissed,
      dismissedAt: updatedAlert.dismissed_at?.toISOString() || null,
      dismissedBy: updatedAlert.employees ? {
        id: updatedAlert.employees.id,
        name: updatedAlert.employees.name,
      } : null,
      createdAt: updatedAlert.created_at.toISOString(),
    };

    return NextResponse.json({
      alert: formattedAlert,
      message: 'Alerta descartada exitosamente',
    });

  } catch (error) {
    logger.error('Error al descartar alerta de estación', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al descartar alerta' },
      { status: 500 }
    );
  }
}
