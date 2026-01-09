/**
 * POST /api/notifications/test - Send test notification
 * 
 * Requirements: 7.3
 * - Any authenticated user can send test to themselves
 * - ADMIN role required to send to other employees
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/src/core/auth/auth.service';
import prisma from '@/src/core/db/prisma';
import * as notificationService from '@/src/core/notifications/notification.service';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request, prisma);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    
    // Determine target employee
    let targetEmployeeId = session.employeeId;
    
    if (body.employee_id && body.employee_id !== session.employeeId) {
      // Sending to another employee requires ADMIN or OWNER role
      if (!['ADMIN', 'OWNER'].includes(session.role)) {
        return NextResponse.json(
          { error: 'Admin role required to send test to other employees' },
          { status: 403 }
        );
      }
      targetEmployeeId = body.employee_id;
    }

    const result = await notificationService.sendTest(
      session.tenantId,
      targetEmployeeId
    );

    if (result.sent === 0 && result.failed === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active subscriptions found for this employee',
        sent: 0,
        failed: 0,
      });
    }

    return NextResponse.json({
      success: result.sent > 0,
      message: result.sent > 0 
        ? `Test notification sent to ${result.sent} device(s)` 
        : 'Failed to send test notification',
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('[API] Test notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
