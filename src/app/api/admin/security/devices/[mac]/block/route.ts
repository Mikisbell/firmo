// src/app/api/admin/security/devices/[mac]/block/route.ts
// Block a device (MAC address)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import { blockMAC } from '@/src/core/security/mac-validator-hybrid';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mac: string }> }
) {
  try {
    const { mac } = await params;
    console.log('[Block Device API] POST request received for MAC:', mac);

    // Validate session
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      console.log('[Block Device API] Unauthorized - no session');
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
      console.log('[Block Device API] Forbidden - not admin');
      return NextResponse.json(
        { error: 'Forbidden - admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { reason } = body;

    console.log('[Block Device API] Blocking MAC:', mac, 'Reason:', reason);

    // Block the MAC
    await blockMAC(session.tenantId, mac, reason || 'Blocked by admin');

    // Create alert
    const device = await prisma.device_mac_addresses.findFirst({
      where: {
        mac_address: mac,
        tenant_id: session.tenantId,
      },
    });

    if (device) {
      await prisma.session_alerts.create({
        data: {
          id: require('uuid').v4(),
          tenant_id: session.tenantId,
          employee_id: device.employee_id,
          alert_type: 'BLOCKED_DEVICE',
          reason: `Device blocked by admin: ${reason || 'No reason provided'}`,
          mac_address: mac,
          is_resolved: false,
        },
      });
    }

    console.log('[Block Device API] Device blocked successfully');

    return NextResponse.json({
      success: true,
      message: 'Device blocked successfully',
      mac_address: mac,
    });
  } catch (error) {
    console.error('Block device error:', error);
    return NextResponse.json(
      { error: 'Error blocking device' },
      { status: 500 }
    );
  }
}
