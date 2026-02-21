/**
 * Device Confirmation API - Hybrid Model
 * POST - Confirm a new device and register its MAC address (per employee + terminal)
 * 
 * Implements hybrid model:
 * - Registers MAC for specific employee
 * - Optionally registers for specific terminal (if provided)
 * - If no terminal_id provided, MAC is valid for any terminal
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { registerMAC } from '@/src/core/security/mac-validator-hybrid';
import {
  createActiveSession,
  closeAllSessionsExcept,
  SessionContext,
} from '@/src/core/security/session-validator';
import { logAction } from '@/src/core/security/rate-limiter';
import { getClientIP } from '@/src/core/security/ip-validator';
import { TerminalConfirmationService } from '@/src/core/services/terminal-confirmation.service';

const confirmationService = new TerminalConfirmationService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionToken, // From previous login attempt
      macAddress,
      confirmationCode,
      terminalId, // Optional: if provided, MAC is registered for this terminal only
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

    // Validate confirmation code with rate limiting
    const verifyResult = confirmationService.verifyCode(
      tenantId,
      terminalId || sessionData.terminal_id,
      employeeId,
      confirmationCode,
    );

    if (!verifyResult.success) {
      return NextResponse.json(
        { error: verifyResult.error.message },
        { status: 400 }
      );
    }

    if (!verifyResult.data.verified) {
      const msg = verifyResult.data.lockedUntil
        ? `Dispositivo bloqueado. Intente después de ${verifyResult.data.lockedUntil.toLocaleTimeString()}`
        : `Código incorrecto. ${verifyResult.data.attemptsRemaining} intento(s) restante(s)`;
      return NextResponse.json(
        { error: msg, attemptsRemaining: verifyResult.data.attemptsRemaining },
        { status: 403 }
      );
    }

    // Register the MAC address (hybrid model)
    // If terminalId is provided, MAC is registered for that terminal only
    // If not provided, MAC is registered for any terminal (special UUID)
    await registerMAC(tenantId, employeeId, macAddress, terminalId);

    // Create a new active session with the confirmed MAC
    const sessionContext: SessionContext = {
      employeeId,
      terminalId: terminalId || sessionData.terminal_id,
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
        terminalId: terminalId || 'ANY_TERMINAL',
        sessionId,
      }
    );

    // Return response with new session token
    const response = NextResponse.json({
      success: true,
      sessionToken: newSessionToken,
      sessionId,
      message: 'Dispositivo confirmado exitosamente',
      macAddress,
      registeredFor: terminalId ? `Terminal ${terminalId}` : 'Cualquier terminal',
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
