// src/app/api/auth/login/route.ts
// API to authenticate employee with PIN
// Now with JWT tokens and httpOnly cookies for secure authentication

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { authenticate } from '@/src/core/auth/auth.service';

const LoginSchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string().optional(), // Optional for admin panel
  pin: z.string().length(4),
  device_fingerprint: z.string().min(16).optional(), // Optional for admin panel
});

// Handle CORS preflight request
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = LoginSchema.parse(body);

    // Get metadata for audit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // If terminal_id is provided, verify terminal (for POS terminals)
    if (data.terminal_id) {
      const terminal = await prisma.terminals.findUnique({
        where: {
          tenant_id_terminal_id: {
            tenant_id: data.tenant_id,
            terminal_id: data.terminal_id,
          },
        },
      });

      if (!terminal) {
        return NextResponse.json(
          { error: 'Terminal no registrado' },
          { status: 401 }
        );
      }

      if (!terminal.is_allowed) {
        return NextResponse.json(
          { error: 'Terminal desactivado. Contacte al administrador.' },
          { status: 403 }
        );
      }

      // Verify device fingerprint if provided
      if (data.device_fingerprint && terminal.device_secret_hash && 
          terminal.device_secret_hash !== data.device_fingerprint) {
        return NextResponse.json(
          { error: 'Dispositivo no reconocido' },
          { status: 403 }
        );
      }

      // Update terminal last seen
      await prisma.terminals.update({
        where: { id: terminal.id },
        data: { last_seen_at: new Date() },
      });
    }

    // Authenticate with JWT and session
    const authResult = await authenticate(
      prisma,
      data.tenant_id,
      data.pin,
      ['OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'DRIVER', 'BAR'], // All roles allowed
      {
        ip,
        userAgent,
        terminalId: data.terminal_id,
      }
    );

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    // Get active shift (if terminal_id provided)
    let activeShift = null as any;
    if (data.terminal_id) {
      activeShift = await prisma.shifts.findFirst({
        where: {
          tenant_id: data.tenant_id,
          terminal_id: data.terminal_id,
          status: 'OPEN',
        },
      });
    }

    // Create response with httpOnly cookie
    const response = NextResponse.json({
      success: true,
      employee: authResult.employee,
      shift: activeShift ? {
        id: activeShift.id,
        opened_at: activeShift.opened_at.toISOString(),
        opened_by: activeShift.opened_by,
      } : null,
    });

    // Set httpOnly cookie with JWT token
    // httpOnly: protects against XSS (token not accessible from JavaScript)
    // sameSite: 'strict' protects against CSRF (cookie only sent on same-site requests)
    // secure: only sent over HTTPS in production
    response.cookies.set('auth_token', authResult.token!, {
      httpOnly: true,                              // XSS protection
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
      sameSite: 'strict',                          // CSRF protection
      maxAge: 1800,                                // 30 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error de autenticación' },
      { status: 500 }
    );
  }
}
