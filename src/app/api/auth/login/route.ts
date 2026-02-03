// src/app/api/auth/login/route.ts
// API to authenticate employee with PIN
// Now with JWT tokens and httpOnly cookies for secure authentication
// ADMIN users can access any terminal without terminal validation

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
    console.log('[Login API] POST request received');
    console.log('  Body:', JSON.stringify(body));
    
    const data = LoginSchema.parse(body);
    console.log('[Login API] Schema validation passed');

    // Get metadata for audit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    console.log('[Login API] Metadata:', { ip, userAgent, terminal_id: data.terminal_id });

    // Step 1: Authenticate user with PIN
    console.log('[Login API] Step 1: Authenticating user with PIN');
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
      console.log('[Login API] Authentication failed:', authResult.error);
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      );
    }

    console.log('[Login API] Authentication successful');
    console.log('  Employee:', authResult.employee?.name);
    console.log('  Role:', authResult.employee?.role);

    // Step 2: Validate terminal (if provided)
    // ADMIN users bypass terminal validation - they can access any terminal
    const isAdmin = authResult.employee?.role === 'ADMIN';
    console.log('[Login API] Step 2: Terminal validation');
    console.log('  Is Admin:', isAdmin);
    console.log('  Terminal ID:', data.terminal_id);

    if (data.terminal_id && !isAdmin) {
      // Non-admin users must have a registered terminal
      console.log('[Login API] Validating terminal for non-admin user');
      const terminal = await prisma.terminals.findUnique({
        where: {
          tenant_id_terminal_id: {
            tenant_id: data.tenant_id,
            terminal_id: data.terminal_id,
          },
        },
      });

      if (!terminal) {
        console.log('[Login API] Terminal not found:', data.terminal_id);
        return NextResponse.json(
          { error: 'Terminal no registrado' },
          { status: 401 }
        );
      }

      if (!terminal.is_allowed) {
        console.log('[Login API] Terminal is disabled');
        return NextResponse.json(
          { error: 'Terminal desactivado. Contacte al administrador.' },
          { status: 403 }
        );
      }

      // Verify device fingerprint if provided
      if (data.device_fingerprint && terminal.device_secret_hash && 
          terminal.device_secret_hash !== data.device_fingerprint) {
        console.log('[Login API] Device fingerprint mismatch');
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

      console.log('[Login API] Terminal validated successfully');
    } else if (data.terminal_id && isAdmin) {
      // Admin users can access any terminal, but we try to update last_seen if it exists
      console.log('[Login API] ADMIN bypass - skipping terminal validation');
      try {
        await prisma.terminals.update({
          where: {
            tenant_id_terminal_id: {
              tenant_id: data.tenant_id,
              terminal_id: data.terminal_id,
            },
          },
          data: { last_seen_at: new Date() },
        });
        console.log('[Login API] Terminal last_seen updated');
      } catch (e) {
        // Terminal doesn't exist, but that's OK for admin
        console.log('[Login API] Terminal not found for update (OK for admin)');
      }
    }

    // Step 3: Get active shift (if terminal_id provided)
    console.log('[Login API] Step 3: Looking for active shift');
    let activeShift = null as any;
    if (data.terminal_id) {
      activeShift = await prisma.shifts.findFirst({
        where: {
          tenant_id: data.tenant_id,
          terminal_id: data.terminal_id,
          status: 'OPEN',
        },
      });
      console.log('[Login API] Active shift found:', !!activeShift);
    }

    // Step 4: Create response with httpOnly cookie
    console.log('[Login API] Step 4: Creating response with JWT cookie');
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

    console.log('[Login API] Login successful - cookie set');
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
