// src/app/api/auth/login/route.ts
// API to authenticate employee with PIN
// Now with JWT tokens and httpOnly cookies for secure authentication
// ADMIN users can access any terminal without terminal validation
// HYBRID MAC validation: Device-level (per employee) + Terminal-level (per terminal)

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '@/src/lib/cors-helpers';
import { authenticate } from '@/src/core/auth/auth.service';
import { validateMAC, checkTerminalAuthorization, registerMAC } from '@/src/core/security/mac-validator-hybrid';
import { detectSimultaneousLogin, createActiveSession, closeAllSessionsExcept } from '@/src/core/security/session-validator';
import { createAlert } from '@/src/core/security/alert-service';
import { rateLimit, getRetryAfterSeconds } from '@/src/core/middleware/rate-limit';
import { EMPLOYEE_ROLES } from '@/src/core/constants/roles';

// Strict rate limit for login: 10 attempts per 60 seconds per IP
const AUTH_RATE_LIMIT = { maxRequests: 10, windowMs: 60000 };

const LoginSchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string().optional(), // Optional for admin panel
  pin: z.string().min(4).max(6),
  // Support both old and new fingerprint formats
  fingerprint: z.object({
    hash: z.string(),
    signals: z.any().optional(),
    signalCount: z.number().optional(),
    timestamp: z.number().optional(),
  }).optional(), // Old format (object)
  device_fingerprint: z.string().min(16).optional(), // New format (string)
  device_id: z.string().optional(), // Device identifier (relaxed from uuid)
  mac_address: z.string().optional(), // MAC address (hybrid validation)
  risk_score: z.number().optional(), // Risk score from frontend
});

// Handle CORS preflight request
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return handleCorsPreflightRequest(origin);
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 attempts per minute per IP
    const rl = await rateLimit(request, AUTH_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Intenta de nuevo más tarde.' },
        { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(rl.resetAt)) } }
      );
    }

    const body = await request.json();
    console.log('[Login API] POST request received');
    const data = LoginSchema.parse(body);
    console.log('[Login API] Schema validation passed');

    // Extract device fingerprint from either format
    const deviceFingerprint = data.fingerprint?.hash || data.device_fingerprint;
    console.log('[Login API] Device fingerprint:', deviceFingerprint ? 'present' : 'not provided');

    // Get metadata for audit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    console.log('[Login API] Metadata:', { ip: ip.slice(0, 15), terminal_id: data.terminal_id });

    // Step 1: Authenticate user with PIN
    console.log('[Login API] Step 1: Authenticating user with PIN');
    const authResult = await authenticate(
      prisma,
      data.tenant_id,
      data.pin,
      [...EMPLOYEE_ROLES], // All POS roles allowed
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

    // Step 2: HYBRID MAC Validation (NEW)
    console.log('[Login API] Step 2: HYBRID MAC Validation');
    let macValidationWarning: string | undefined;
    
    if (data.mac_address && data.terminal_id) {
      console.log('[Login API] Validating MAC address:', data.mac_address);
      
      const macValidation = await validateMAC(
        data.tenant_id,
        authResult.employee!.id,
        data.mac_address,
        data.terminal_id
      );

      if (!macValidation.isValid) {
        if (macValidation.requiresConfirmation) {
          // Unknown device - requires confirmation
          console.log('[Login API] Unknown MAC - requires confirmation');
          return NextResponse.json(
            {
              success: false,
              error: 'UNKNOWN_DEVICE',
              message: 'Dispositivo desconocido. Se requiere confirmación.',
              requires_confirmation: true,
            },
            { status: 403 }
          );
        } else {
          // Device mismatch or blocked
          console.log('[Login API] MAC validation failed:', macValidation.reason);
          
          // Create alert
          await createAlert(data.tenant_id, {
            employeeId: authResult.employee!.id,
            alertType: macValidation.reason === 'DEVICE_MISMATCH' ? 'DEVICE_MISMATCH' : 'BLOCKED_DEVICE',
            reason: macValidation.reason || 'Unknown MAC validation error',
            ipAddress: ip,
          });

          return NextResponse.json(
            {
              success: false,
              error: macValidation.reason,
              message: 'Acceso denegado. Dispositivo no autorizado.',
            },
            { status: 403 }
          );
        }
      }

      if (macValidation.warning) {
        macValidationWarning = macValidation.warning;
        console.log('[Login API] MAC validation warning:', macValidationWarning);
      }

      // Check terminal authorization (audit trail)
      console.log('[Login API] Checking terminal authorization');
      const terminalAuth = await checkTerminalAuthorization(
        data.tenant_id,
        data.terminal_id,
        data.mac_address,
        authResult.employee!.id
      );

      if (!terminalAuth.isAuthorized) {
        console.log('[Login API] Terminal authorization failed:', terminalAuth.reason);
        
        // Create alert
        await createAlert(data.tenant_id, {
          employeeId: authResult.employee!.id,
          alertType: 'UNAUTHORIZED_TERMINAL_ACCESS',
          reason: terminalAuth.reason || 'Unauthorized terminal access',
          ipAddress: ip,
        });

        return NextResponse.json(
          {
            success: false,
            error: 'UNAUTHORIZED_TERMINAL_ACCESS',
            message: 'Acceso a terminal no autorizado.',
          },
          { status: 403 }
        );
      }
    }

    // Step 3: Validate terminal (if provided)
    // ADMIN users bypass terminal validation - they can access any terminal
    const isAdmin = authResult.employee?.role === 'ADMIN';
    console.log('[Login API] Step 3: Terminal validation');
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
          { status: 403 }
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
      if (deviceFingerprint && terminal.device_secret_hash && 
          terminal.device_secret_hash !== deviceFingerprint) {
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

    // Step 4: Detect simultaneous login (NEW)
    console.log('[Login API] Step 4: Detecting simultaneous login');
    const { v4: uuidv4 } = await import('uuid');
    const deviceId = data.device_id || uuidv4();
    const terminalId = data.terminal_id || 'admin-panel';
    
    const simultaneousCheck = await detectSimultaneousLogin(
      data.tenant_id,
      authResult.employee!.id,
      terminalId,
      deviceId
    );

    if (simultaneousCheck.hasActiveSession) {
      console.log('[Login API] Simultaneous login detected');
      
      // Create alert
      await createAlert(data.tenant_id, {
        employeeId: authResult.employee!.id,
        alertType: 'SIMULTANEOUS_LOGIN',
        reason: `Simultaneous login detected on device ${deviceId}`,
        ipAddress: ip,
      });

      // Close previous session
      await closeAllSessionsExcept(
        data.tenant_id,
        authResult.employee!.id,
        'new-session' // Placeholder, will be replaced with actual token
      );
    }

    // Step 5: Get active shift (if terminal_id provided)
    console.log('[Login API] Step 5: Looking for active shift');
    let activeShift: { id: string; opened_at: Date; opened_by: string } | null = null;
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

    // Step 6: Create active session (NEW)
    console.log('[Login API] Step 6: Creating active session');
    const sessionContext = {
      employeeId: authResult.employee!.id,
      terminalId: terminalId,
      deviceId: deviceId,
      macAddress: data.mac_address || 'unknown-mac',
      ipAddress: ip,
      userAgent: userAgent,
    };

    const { sessionId } = await createActiveSession(
      data.tenant_id,
      sessionContext
    );

    console.log('[Login API] Active session created:', sessionId);

    // Step 7: Register MAC if it's new (NEW)
    if (data.mac_address && data.terminal_id) {
      console.log('[Login API] Registering MAC address');
      try {
        await registerMAC(
          data.tenant_id,
          authResult.employee!.id,
          data.mac_address,
          data.terminal_id
        );
        console.log('[Login API] MAC registered successfully');
      } catch (error) {
        console.log('[Login API] MAC registration error (non-fatal):', error);
        // Non-fatal error - continue with login
      }
    }

    // Step 8: Create response with httpOnly cookie
    console.log('[Login API] Step 8: Creating response with JWT cookie');
    const response = NextResponse.json({
      success: true,
      employee: authResult.employee,
      shift: activeShift ? {
        id: activeShift.id,
        opened_at: activeShift.opened_at.toISOString(),
        opened_by: activeShift.opened_by,
      } : null,
      session_id: sessionId,
      warning: macValidationWarning,
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

    // Also set session token cookie for reference
    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1800,
      path: '/',
    });

    console.log('[Login API] Login successful - cookies set');
    return response;
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    // Check for database errors
    if (error instanceof Error && error.message.includes('relation')) {
      return NextResponse.json(
        {
          error: 'Database error - tables may not exist',
          message: 'Please run: npx prisma migrate deploy',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Error de autenticación',
      },
      { status: 500 }
    );
  }
}
