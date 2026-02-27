/**
 * Admin Security: Resolve Alert API
 * POST - Mark an alert as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { resolveAlert } from '@/src/core/security/alert-service';
import { logAction } from '@/src/core/security/rate-limiter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params;
  try {
    // Validate admin session
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const adminId = authResult.user.id;
    const body = await request.json();
    const { notes } = body;

    // Get alert
    const alert = await prisma.session_alerts.findUnique({
      where: {
        id: alertId,
      },
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }

    if (alert.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Resolve alert
    await resolveAlert(alertId, adminId, notes);

    // Log action
    await logAction(
      tenantId,
      adminId,
      'RESOLVE_ALERT',
      alertId,
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown',
      {
        resolvedAlertId: alertId,
        alertType: alert.alert_type,
        notes,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Alerta resuelta exitosamente',
    });
  } catch (error) {
    console.error('Resolve alert error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al resolver alerta' },
      { status: 500 }
    );
  }
}
