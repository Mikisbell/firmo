/**
 * Device Confirmation API
 * POST - Confirm a new device and register its MAC address
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { registerMAC } from '@/src/core/security/mac-validator';
import {
  createActiveSession,
  closeAllSessionsExcept,
  SessionContext,
} from '@/src/core/security/session-validator';
import { logAction } from '@/src/core/security/rate-limiter';
import { getClientIP } from '@/src/core/security/ip-validator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionToken, // From previous login attempt
      macAddress,
      confirmationCode,
      location,
    } = body;

    if (!sessionToken || !macAddress || !confirmationCode) {
      return NextResponse.json(
        { error: 'sessionToken, macAddress y confirmationCode requeridos' },
        { status: 400 }
      );
    }

    const tenantId = DEFAULT_TENANT_ID;
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = getClientIP(request.headers);

    // TODO: Validate confirmation code (should be sent via email/SMS)
    // For now, we'll accept any code as this is a placeholder

    // Get employee from session token (from previous login)
    // This is a simplified version - in production, you'd validate the token properly
    const sessionData = await prisma.active_sessions.findUnique({
      where: { session_token: sessionToken },
    });

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Sesión inválida o expirada' },
        { status: 401 }
      );
    }

    const employeeId = sessionData.employee_id;

    // Register the MAC address
    await registerMAC(tenantId, employeeId, macAddress);

    // Create a new active session with the confirmed MAC
    const sessionContext: SessionContext = {
      employeeId,
      terminalId: sessionData.terminal_id,
      deviceId: sessionData.device_id,
      macAddress,
      ipAddress,
      userAgent,
      location,
    };

    const { sessionToken: newSessionToken, sessionId } =
      await createActiveSession(tenantId, sessionContext);

    // Close the old session
    await closeAllSessionsExcept(tenantId, employeeId, newSessionToken);

    // Log the action
    await logAction(
      tenantId,
      employeeId,
      'DEVICE_CONFIRMED',
      undefined,
      ipAddress,
      {
        macAddress,
        sessionId,
      }
    );

    // Return response with new session token
    const response = NextResponse.json({
      success: true,
      sessionToken: newSessionToken,
      sessionId,
      message: 'Dispositivo confirmado exitosamente',
    });

    // Set httpOnly cookie
    response.cookies.set('auth_token', newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Device confirmation error:', error);
    return NextResponse.json(
      { error: 'Error al confirmar dispositivo' },
      { status: 500 }
    );
  }
}
