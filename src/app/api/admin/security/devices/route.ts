// src/app/api/admin/security/devices/route.ts
// List all devices (MAC addresses) registered in the system

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function GET(request: NextRequest) {
  try {
    console.log('[Admin Devices API] GET request received');

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      console.log('[Admin Devices API] Unauthorized - no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const employee = await prisma.employees.findUnique({
      where: { id: session.employeeId },
    });

    if (!employee || employee.role !== 'ADMIN') {
      console.log('[Admin Devices API] Forbidden - not admin');
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    console.log('[Admin Devices API] Fetching all devices');

    // Get all devices
    const devices = await prisma.device_mac_addresses.findMany({
      where: {
        tenant_id: session.tenantId,
      },
      orderBy: {
        last_seen: 'desc',
      },
    });

    // Fetch employee details separately
    const employeeIds = [...new Set(devices.map(d => d.employee_id))];
    const employees = await prisma.employees.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true, role: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e]));

    console.log('[Admin Devices API] Found', devices.length, 'devices');

    return NextResponse.json({
      success: true,
      devices: devices.map((device) => ({
        mac_address: device.mac_address,
        employee: employeeMap.get(device.employee_id),
        terminal_id: device.terminal_id,
        trust_level: device.trust_level,
        first_seen: device.first_seen,
        last_seen: device.last_seen,
        is_active: device.is_active,
        access_count: device.access_count,
      })),
    });
  } catch (error) {
    console.error('Admin devices error:', error);
    return NextResponse.json(
      { error: 'Error fetching devices' },
      { status: 500 }
    );
  }
}
