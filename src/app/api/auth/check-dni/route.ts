/**
 * POST /api/auth/check-dni
 * Verify that a DNI belongs to an active employee in the tenant.
 * Returns only { exists: boolean } — no sensitive data exposed.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dni, tenant_id } = body;

    if (!dni || typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    const tenantId = tenant_id || getTenantId();

    const employee = await prisma.employees.findFirst({
      where: { tenant_id: tenantId, dni, is_active: true },
      select: { id: true, name: true },
    });

    if (!employee) return NextResponse.json({ exists: false });

    // Return first name + first last name only
    const parts = employee.name.trim().split(/\s+/);
    const displayName = parts.slice(0, 2).join(' ');

    return NextResponse.json({ exists: true, name: displayName });
  } catch {
    // On error, let the PIN step handle auth — don't block login
    return NextResponse.json({ exists: true });
  }
}
