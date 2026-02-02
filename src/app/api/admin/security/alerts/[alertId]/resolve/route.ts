/**
 * Admin Security: Resolve Alert API
 * POST - Mark an alert as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { validateToken } from '@/src/core/auth/auth.service';
import { resolveAlert } from '@/src/core/security/alert-service';
import { logAction } from '@/src/core/security/rate-limiter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const { alertId } = await params;
  try {
    // Validate admin session
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (tokenResult.payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = DEFAULT_TENANT_ID;
    const adminId = tokenResult.payload.sub;
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
    console.error('Resolve alert error:', error);
    return NextResponse.json(
      { error: 'Error al resolver alerta' },
      { status: 500 }
    );
  }
}
