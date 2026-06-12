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
import { logger, createRequestLogger } from '@/src/core/observability/structured-logger';

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
        { error: 'Demasiados intentos. Intenta de nuevo más tarde.', errorCode: 'RATE_LIMIT' },
        { status: 429, headers: { 'Retry-After': String(getRetryAfterSeconds(rl.resetAt)) } }
      );
    }

    const body = await request.json();
    const log = createRequestLogger(crypto.randomUUID(), { terminalId: body.terminal_id });
    log.debug('Solicitud POST recibida');
    const data = LoginSchema.parse(body);
    log.debug('Validación de schema completada');

    // Extract device fingerprint from either format
    const deviceFingerprint = data.fingerprint?.hash || data.device_fingerprint;
    log.debug('Device fingerprint', { hasFingerprint: !!deviceFingerprint });

    // Get metadata for audit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    log.debug('Metadata extraído', { ip: ip.slice(0, 15), terminalId: data.terminal_id });

    // Step 1: Authenticate user with PIN
    log.debug('Paso 1: Autenticando usuario con PIN');
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
      log.warn('Autenticación fallida', { error: authResult.error });
      return NextResponse.json(
        { error: authResult.error, errorCode: authResult.errorCode },
        { status: 401 }
      );
    }

    log.info('Autenticación exitosa', { employeeName: authResult.employee?.name, role: authResult.employee?.role });

    // Step 2: HYBRID MAC Validation (NEW)
    log.debug('Paso 2: Validación MAC híbrida');
    let macValidationWarning: string | undefined;

    if (data.mac_address && data.terminal_id) {
      log.debug('Validando dirección MAC');
      
      const macValidation = await validateMAC(
        data.tenant_id,
        authResult.employee!.id,
        data.mac_address,
        data.terminal_id
      );

      if (!macValidation.isValid) {
        if (macValidation.requiresConfirmation) {
          // Unknown device - requires confirmation
          log.info('MAC desconocido - requiere confirmación');
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
          log.warn('Validación MAC fallida', { reason: macValidation.reason });
          
          // Create alert
          await createAlert(data.tenant_id, {
            employeeId: authResult.employee!.id,
            alertType: macValidation.reason === 'DEVICE_MISMATCH' ? 'DEVICE_MISMATCH' : 'BLOCKED_DEVICE',
            reason: macValidation.reason || 'Error desconocido de validación MAC',
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
        log.warn('Advertencia de validación MAC', { warning: macValidationWarning });
      }

      // Check terminal authorization (audit trail)
      log.debug('Verificando autorización de terminal');
      const terminalAuth = await checkTerminalAuthorization(
        data.tenant_id,
        data.terminal_id,
        data.mac_address,
        authResult.employee!.id
      );

      if (!terminalAuth.isAuthorized) {
        log.warn('Autorización de terminal fallida', { reason: terminalAuth.reason });
        
        // Create alert
        await createAlert(data.tenant_id, {
          employeeId: authResult.employee!.id,
          alertType: 'UNAUTHORIZED_TERMINAL_ACCESS',
          reason: terminalAuth.reason || 'Acceso a terminal no autorizado',
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
    log.debug('Paso 3: Validación de terminal', { isAdmin, terminalId: data.terminal_id });

    if (data.terminal_id && !isAdmin) {
      // Non-admin users must have a registered terminal
      log.debug('Validando terminal para usuario no-admin');
      const terminal = await prisma.terminals.findUnique({
        where: {
          tenant_id_terminal_id: {
            tenant_id: data.tenant_id,
            terminal_id: data.terminal_id,
          },
        },
      });

      if (!terminal) {
        log.warn('Terminal no encontrado', { terminalId: data.terminal_id });
        return NextResponse.json(
          { error: 'Terminal no registrado' },
          { status: 403 }
        );
      }

      if (!terminal.is_allowed) {
        log.warn('Terminal desactivado', { terminalId: data.terminal_id });
        return NextResponse.json(
          { error: 'Terminal desactivado. Contacte al administrador.' },
          { status: 403 }
        );
      }

      // Verify device fingerprint if provided
      if (deviceFingerprint && terminal.device_secret_hash &&
          terminal.device_secret_hash !== deviceFingerprint) {
        log.warn('Discrepancia de huella digital del dispositivo');
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

      log.debug('Terminal validado exitosamente');
    } else if (data.terminal_id && isAdmin) {
      // Admin users can access any terminal, but we try to update last_seen if it exists
      log.debug('ADMIN bypass - omitiendo validación de terminal');
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
        log.debug('Terminal last_seen actualizado');
      } catch (e) {
        // Terminal doesn't exist, but that's OK for admin
        log.debug('Terminal no encontrado para actualizar (OK para admin)');
      }
    }

    // Step 4: Detect simultaneous login (NEW)
    log.debug('Paso 4: Detectando login simultáneo');
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
      log.warn('Login simultáneo detectado', { employeeId: authResult.employee!.id });
      
      // Create alert
      await createAlert(data.tenant_id, {
        employeeId: authResult.employee!.id,
        alertType: 'SIMULTANEOUS_LOGIN',
        reason: `Login simultáneo detectado en dispositivo ${deviceId}`,
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
    log.debug('Paso 5: Buscando turno activo');
    let activeShift: { id: string; opened_at: Date; opened_by: string } | null = null;
    if (data.terminal_id) {
      activeShift = await prisma.shifts.findFirst({
        where: {
          tenant_id: data.tenant_id,
          terminal_id: data.terminal_id,
          status: 'OPEN',
        },
      });
      log.debug('Turno activo encontrado', { hasShift: !!activeShift });
    }

    // Step 6: Create active session (NEW)
    log.debug('Paso 6: Creando sesión activa');
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

    log.debug('Sesión activa creada', { sessionId });

    // Step 7: Register MAC if it's new (NEW)
    if (data.mac_address && data.terminal_id) {
      log.debug('Registrando dirección MAC');
      try {
        await registerMAC(
          data.tenant_id,
          authResult.employee!.id,
          data.mac_address,
          data.terminal_id
        );
        log.debug('MAC registrado exitosamente');
      } catch (error) {
        log.warn('Error de registro MAC (no fatal)', { error: error instanceof Error ? error.message : String(error) });
        // Non-fatal error - continue with login
      }
    }

    // Step 8: Create response with httpOnly cookie
    log.debug('Paso 8: Creando respuesta con cookie JWT');
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
      maxAge: 28800,                               // 8 hours (consistent with auth.service.ts)
      path: '/',
    });

    // Also set session token cookie for reference
    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 28800,                               // 8 hours (consistent with auth.service.ts)
      path: '/',
    });

    log.info('Login exitoso - cookies configuradas', { employeeId: authResult.employee!.id });
    return response;
  } catch (error) {
    logger.error('Error en login', error instanceof Error ? error : new Error(String(error)));

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
          error: 'Error de base de datos - las tablas pueden no existir',
          message: 'Ejecute: npx prisma migrate deploy',
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
