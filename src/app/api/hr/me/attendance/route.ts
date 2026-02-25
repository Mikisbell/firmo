/**
 * Self-Service API - GET current employee's attendance records
 *
 * Query params: ?month=2026-01 (format YYYY-MM, defaults to current month)
 * Returns attendance records for the specified month.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { AttendanceService } from '@/src/core/services/attendance.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new AttendanceService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;

  // Parse month param or default to current month
  const monthParam = request.nextUrl.searchParams.get('month');
  let year: number;
  let month: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    [year, month] = monthParam.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0)); // last day

  const result = await service.getByEmployee(
    tenantId,
    employeeId,
    startDate,
    endDate,
  );
  return resultToResponse(result);
}
