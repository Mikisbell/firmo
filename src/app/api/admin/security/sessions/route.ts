/**
 * Admin Security: Active Sessions API
 * GET - List all active sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { DEFAULT_TENANT_ID } from '@/src/core/config/terminal';
import { validateToken } from '@/src/core/auth/auth.service';

export async function GET(request: NextRequest) {
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

    // Get all active sessions
    const sessions = await prisma.active_sessions.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      orderBy: {
        started_at: 'desc',
      },
      select: {
        id: true,
        employee_id: true,
        terminal_id: true,
        device_id: true,
        ip_address: true,
        user_agent: true,
        location_lat: true,
        location_lng: true,
        started_at: true,
        last_activity_at: true,
        is_suspicious: true,
        blocked_reason: true,
      },
    });

    return NextResponse.json({
      sessions,
      total: sessions.length,
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: 'Error al obtener sesiones' },
      { status: 500 }
    );
  }
}
