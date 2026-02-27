// src/app/api/admin/security/sessions/route.ts
// Get all active sessions

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
    console.log('[Admin Sessions API] GET request received');

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      console.log('[Admin Sessions API] Unauthorized - no session');
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
      console.log('[Admin Sessions API] Forbidden - not admin');
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    console.log('[Admin Sessions API] Fetching all sessions');

    // Get all sessions (active and inactive)
    const sessions = await prisma.active_sessions.findMany({
      where: {
        tenant_id: session.tenantId,
      },
      orderBy: {
        started_at: 'desc',
      },
      take: 500,
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(sessions.map(s => s.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    console.log('[Admin Sessions API] Found', sessions.length, 'sessions');

    return NextResponse.json({
      success: true,
      sessions: sessions.map((s) => ({
        id: s.id,
        employee: employeeMap.get(s.employee_id),
        terminal_id: s.terminal_id,
        device_id: s.device_id,
        mac_address: s.mac_address,
        ip_address: s.ip_address,
        started_at: s.started_at,
        last_activity_at: s.last_activity_at,
        is_active: s.is_active,
        is_suspicious: s.is_suspicious,
      })),
    });
  } catch (error) {
    console.error('Admin sessions error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error fetching sessions' },
      { status: 500 }
    );
  }
}
