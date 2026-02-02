/**
 * Secure Login API with Multi-Factor Security
 * POST - Login with IP, location, and device validation
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateToken, authenticate } from '@/src/core/auth/auth.service';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import {
  detectSimultaneousLogin,
  createActiveSession,
  closeAllSessionsExcept,
  SessionContext,
} from '@/src/core/security/session-validator';
import { validateIP, getClientIP, logIPAccess } from '@/src/core/security/ip-validator';
import { validateLocation, logLocationAccess } from '@/src/core/security/location-validator';
import { createAlert } from '@/src/core/security/alert-service';
import { logAction } from '@/src/core/security/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pin,
      deviceId,
      ipAddress: clientIP,
      location,
      allowedRoles = ['ADMIN', 'MANAGER'],
    } = body;

    if (!pin || !deviceId) {
      return NextResponse.json(
        { error: 'PIN y deviceId requeridos' },
        { status: 400 }
      );
    }

    const tenantId = DEFAULT_TENANT_ID;
    const userAgent = request.headers.get('user-agent') || undefined;
    const serverIP = getClientIP(request.headers);
    const ipToUse = clientIP || serverIP;

    // 1. Authenticate with PIN
    const metadata = {
      ip: ipToUse,
      userAgent,
      terminalId: 'terminal',
    };

    const authResult = await authenticate(
      prisma,
      tenantId,
      pin,
      allowedRoles,
      metadata
    );

    if (!authResult.success) {
      return NextResponse.json(
        {
          error: authResult.error || 'PIN inválido',
          errorCode: authResult.errorCode,
          lockoutUntil: authResult.lockoutUntil,
        },
        { status: 401 }
      );
    }

    const employeeId = authResult.employee?.id;
    if (!employeeId) {
      return NextResponse.json(
        { error: 'No se pudo obtener ID del empleado' },
        { status: 500 }
      );
    }

    // 2. Detectar acceso simultáneo
    const simultaneousCheck = await detectSimultaneousLogin(
      tenantId,
      employeeId,
      'terminal',
      deviceId
    );

    if (simultaneousCheck.hasActiveSession) {
      // Crear alerta
      await createAlert(tenantId, {
        employeeId,
        alertType: 'SIMULTANEOUS_LOGIN',
        reason: `Acceso simultáneo detectado desde dispositivo ${deviceId}`,
        ipAddress: ipToUse,
      });

      return NextResponse.json(
        {
          error: 'SIMULTANEOUS_LOGIN',
          message: 'Ya hay una sesión activa en otro dispositivo',
          existingSession: {
            deviceId: simultaneousCheck.session.device_id,
            ipAddress: simultaneousCheck.session.ip_address,
            startedAt: simultaneousCheck.session.started_at,
          },
        },
        { status: 403 }
      );
    }

    // 3. Validar IP
    const ipValidation = await validateIP(tenantId, employeeId, ipToUse);
    if (ipValidation.isSuspicious) {
      // Crear alerta
      await createAlert(tenantId, {
        employeeId,
        alertType: 'SUSPICIOUS_IP',
        reason: ipValidation.reason || 'IP sospechosa detectada',
        ipAddress: ipToUse,
      });

      // Log del acceso
      await logIPAccess(tenantId, employeeId, ipToUse, userAgent);

      // Retornar error pero permitir confirmación
      return NextResponse.json(
        {
          error: 'SUSPICIOUS_IP',
          message: 'Acceso desde IP sospechosa',
          requiresConfirmation: true,
          confirmationCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        },
        { status: 403 }
      );
    }

    // 4. Validar ubicación
    if (location) {
      const locationValidation = await validateLocation(
        tenantId,
        employeeId,
        location
      );

      if (!locationValidation.isValid) {
        // Crear alerta
        await createAlert(tenantId, {
          employeeId,
          alertType: 'IMPOSSIBLE_TRAVEL',
          reason: locationValidation.reason || 'Viaje imposible detectado',
          ipAddress: ipToUse,
          location,
        });

        return NextResponse.json(
          {
            error: 'IMPOSSIBLE_TRAVEL',
            message: 'Viaje imposible entre ubicaciones',
          },
          { status: 403 }
        );
      }

      // Log de ubicación
      await logLocationAccess(tenantId, employeeId, location, ipToUse);
    }

    // 5. Crear sesión activa
    const sessionContext: SessionContext = {
      employeeId,
      terminalId: 'terminal',
      deviceId,
      ipAddress: ipToUse,
      userAgent,
      location,
    };

    const { sessionToken, sessionId } = await createActiveSession(
      tenantId,
      sessionContext
    );

    // 6. Cerrar otras sesiones del mismo empleado
    await closeAllSessionsExcept(tenantId, employeeId, sessionToken);

    // 7. Log de acción
    await logAction(
      tenantId,
      employeeId,
      'LOGIN',
      undefined,
      ipToUse,
      {
        deviceId,
        location,
        sessionId,
      }
    );

    // 8. Retornar respuesta exitosa
    const response = NextResponse.json({
      success: true,
      sessionToken,
      sessionId,
      employee: authResult.employee,
    });

    // Set httpOnly cookie
    response.cookies.set('auth_token', authResult.token!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Secure login error:', error);
    return NextResponse.json(
      { error: 'Error al procesar login' },
      { status: 500 }
    );
  }
}
