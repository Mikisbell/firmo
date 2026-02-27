// src/app/api/admin/security/alerts/route.ts
// Get all security alerts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Alerts API] GET request received');

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      console.log('[Admin Alerts API] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const employee = await prisma.employees.findUnique({
      where: { id: session.employeeId },
    });

    if (!employee || !(ADMIN_ROLES as readonly string[]).includes(employee.role)) {
      console.log('[Admin Alerts API] Forbidden - not admin');
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10) || 0, 0);
    const alertType = url.searchParams.get('alert_type');
    const isResolved = url.searchParams.get('is_resolved');

    console.log('[Admin Alerts API] Fetching alerts');

    // Build where clause
    const where: any = {
      tenant_id: session.tenantId,
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
      skip: offset,
    });

    // Get total count
    const total = await prisma.session_alerts.count({ where });

    console.log('[Admin Alerts API] Found', alerts.length, 'alerts');

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      alerts: alerts.map((a) => ({
        id: a.id,
        employee_id: a.employee_id,
        alert_type: a.alert_type,
        reason: a.reason,
        mac_address: a.mac_address,
        ip_address: a.ip_address,
        is_resolved: a.is_resolved,
        resolved_by: a.resolved_by,
        resolved_at: a.resolved_at,
        created_at: a.created_at,
      })),
    });
  } catch (error) {
    console.error('Admin alerts error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error fetching alerts' },
      { status: 500 }
    );
  }
}
