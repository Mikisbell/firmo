/**
 * Admin Security: Revoke Session API
 * POST - Revoke a specific session
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { validateToken } from '@/src/core/auth/auth.service';
import { closeSession } from '@/src/core/security/session-validator';
import { logAction } from '@/src/core/security/rate-limiter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    // Validate admin session
    const cookieToken = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('authorization');
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    const token = cookieToken || headerToken;

    if (!token) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const tokenResult = await validateToken(token);
    if (!tokenResult.valid || !tokenResult.payload) {
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      );
    }

    // Check if user is admin
    if (tokenResult.payload.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const tenantId = DEFAULT_TENANT_ID;
    const adminId = tokenResult.payload.sub;
    const body = await request.json();
    const { reason } = body;

    // Get session
    const session = await prisma.active_sessions.findUnique({
      where: {
        id: sessionId,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 }
      );
    }

    if (session.tenant_id !== tenantId) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    // Close session
    await prisma.active_sessions.update({
      where: {
        id: sessionId,
      },
      data: {
        is_active: false,
        ended_at: new Date(),
        blocked_reason: reason || 'Revoked by admin',
      },
    });

    // Log action
    await logAction(
      tenantId,
      adminId,
      'REVOKE_SESSION',
      sessionId,
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown',
      {
        revokedSessionId: sessionId,
        revokedEmployeeId: session.employee_id,
        reason,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Sesión revocada exitosamente',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    return NextResponse.json(
      { error: 'Error al revocar sesión' },
      { status: 500 }
    );
  }
}
