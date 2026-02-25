/**
 * Self-Service API - GET current employee profile
 *
 * Uses the authenticated user's ID to fetch their own employee record.
 * Any authenticated user can access this (not admin-only).
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { EmployeeService } from '@/src/core/services/employee.service';
import { resultToResponse } from '@/src/app/api/hr/_shared/api-helpers';

const service = new EmployeeService(prisma);

export async function GET(request: NextRequest) {
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) return authResult.response;

  const { tenantId, id: employeeId } = authResult.user;
  const result = await service.getById(tenantId, employeeId);
  return resultToResponse(result);
}
