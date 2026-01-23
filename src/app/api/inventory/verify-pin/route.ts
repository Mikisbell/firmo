/**
 * API Route: Verify PIN for inventory operations
 * Validates employee PIN and checks if role is allowed
 * 
 * DEPRECATED: Use /api/auth/session instead for JWT-based auth
 * This endpoint is kept for backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { authenticate } from '@/src/core/auth/auth.service';
import { getTenantId } from '@/src/core/config/tenant';

const TENANT_ID = getTenantId();

const RequestSchema = z.object({
  pin: z.string().min(4).max(6),
  allowedRoles: z.array(z.enum(['ADMIN', 'MANAGER', 'KITCHEN', 'CASHIER', 'WAITER'])),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, allowedRoles } = RequestSchema.parse(body);

    // Extract metadata
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await authenticate(
      prisma,
      TENANT_ID,
      pin,
      allowedRoles,
      { ip, userAgent }
    );

    if (!result.success) {
      const status = result.errorCode === 'ACCOUNT_LOCKED' ? 429 : 
                     result.errorCode === 'ROLE_NOT_ALLOWED' ? 403 : 401;
      return NextResponse.json(
        { 
          error: result.error,
          errorCode: result.errorCode,
          lockoutUntil: result.lockoutUntil?.toISOString(),
        },
        { status }
      );
    }

    // Return both legacy format and new token
    return NextResponse.json({
      success: true,
      employee: result.employee,
      token: result.token,
      expiresAt: result.expiresAt?.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    console.error('PIN verification error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
