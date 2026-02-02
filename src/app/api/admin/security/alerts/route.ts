/**
 * Admin Security: Alerts API
 * GET - List all security alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { validateToken } from '@/src/core/auth/auth.service';

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const alertType = searchParams.get('type');
    const isResolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (alertType) {
      where.alert_type = alertType;
    }

    if (isResolved !== null) {
      where.is_resolved = isResolved === 'true';
    }

    // Get alerts
    const alerts = await prisma.session_alerts.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit,
      select: {
        id: true,
        employee_id: true,
        alert_type: true,
        reason: true,
        ip_address: true,
        location_lat: true,
        location_lng: true,
        is_resolved: true,
        resolved_by: true,
        resolved_at: true,
        resolution_notes: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      alerts,
      total: alerts.length,
    });
  } catch (error) {
    console.error('Get alerts error:', error);
    return NextResponse.json(
      { error: 'Error al obtener alertas' },
      { status: 500 }
    );
  }
}
