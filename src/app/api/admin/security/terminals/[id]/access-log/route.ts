// src/app/api/admin/security/terminals/[id]/access-log/route.ts
// Get access log for a specific terminal (which MACs accessed it)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { ADMIN_ROLES } from '@/src/core/constants/roles';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('[Terminal Access Log API] GET request received for terminal:', id);

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      console.log('[Terminal Access Log API] Unauthorized - no session');
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
      console.log('[Terminal Access Log API] Forbidden - not admin');
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    console.log('[Terminal Access Log API] Fetching access log for terminal:', id);

    // Get access log for terminal
    const accessLog = await prisma.terminal_mac_registry.findMany({
      where: {
        tenant_id: session.tenantId,
        terminal_id: id,
      },
      orderBy: {
        last_seen: 'desc',
      },
      take: limit,
      skip: offset,
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(accessLog.map(log => log.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Get total count
    const total = await prisma.terminal_mac_registry.count({
      where: {
        tenant_id: session.tenantId,
        terminal_id: id,
      },
    });

    console.log('[Terminal Access Log API] Found', accessLog.length, 'access records');

    return NextResponse.json({
      success: true,
      terminal_id: id,
      total,
      limit,
      offset,
      access_log: accessLog.map((log) => ({
        mac_address: log.mac_address,
        employee: employeeMap.get(log.employee_id),
        first_seen: log.first_seen,
        last_seen: log.last_seen,
        access_count: log.access_count,
        is_authorized: log.is_authorized,
      })),
    });
  } catch (error) {
    console.error('Terminal access log error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error fetching access log' },
      { status: 500 }
    );
  }
}
