/**
 * Security Alert Acknowledge API - POST
 * 
 * Task 16.2 - Terminal Architecture v2
 * Requirements: 6.3
 * 
 * Acknowledges a security alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/src/core/observability/structured-logger';
import { acknowledgeAlert } from '@/src/core/auth/audit-logger';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

/**
 * POST /api/admin/audit/alerts/[alertId]/acknowledge
 *
 * Acknowledges a security alert. The acknowledger is taken from the
 * authenticated session — NOT from the request body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const { alertId } = await params;

    // Acknowledge the alert using the authenticated user's ID
    const alert = await acknowledgeAlert(alertId, authResult.user.id);

    return NextResponse.json({
      success: true,
      alert,
    });
  } catch (error) {
    logger.error('Error al confirmar alerta de seguridad', error instanceof Error ? error : new Error(String(error)));
    
    // Check if it's a "not found" error
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Alerta no encontrada' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error al reconocer alerta' },
      { status: 500 }
    );
  }
}
