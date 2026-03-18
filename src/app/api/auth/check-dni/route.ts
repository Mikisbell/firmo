/**
 * POST /api/auth/check-dni
 * Verify that a DNI belongs to an active employee in the tenant.
 * Returns only { exists: boolean } — no sensitive data exposed.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { rateLimit, getRetryAfterSeconds } from '@/src/core/middleware/rate-limit';

// Tenant is always resolved from server-side env — never from client input

// Strict rate limit: 15 DNI checks per minute per IP (prevents enumeration)
const DNI_RATE_LIMIT = { maxRequests: 15, windowMs: 60000 };

export async function POST(request: NextRequest) {
  try {
    const rl = await rateLimit(request, DNI_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { exists: false },
        { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(rl.resetAt)) } }
      );
    }

    const body = await request.json();
    const { dni } = body;

    if (!dni || typeof dni !== 'string' || !/^\d{8}$/.test(dni)) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    const tenantId = getTenantId();

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
