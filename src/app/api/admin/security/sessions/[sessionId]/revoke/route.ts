/**
 * Admin Security: Revoke Session API
 * POST - Revoke a specific session
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { validateToken } from '@/src/core/auth/auth.service';
import { closeSession } from '@/src/core/security/session-validator';
import { logAction } from '@/src/core/security/rate-limiter';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  try {
    // Validate admin session
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;
    const adminId = authResult.user.id;
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

    // Close session (include tenant_id to prevent race conditions)
    await prisma.active_sessions.update({
      where: {
        id: sessionId,
        tenant_id: tenantId,
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
    console.error('Revoke session error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Error al revocar sesión' },
      { status: 500 }
    );
  }
}
