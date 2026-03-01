/**
 * Security Alert Acknowledge API - POST
 * 
 * Task 16.2 - Terminal Architecture v2
 * Requirements: 6.3
 * 
 * Acknowledges a security alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/src/core/observability/structured-logger';
import { acknowledgeAlert } from '@/src/core/auth/audit-logger';

const AcknowledgeAlertSchema = z.object({
  acknowledged_by: z.string().min(1).max(255),
});

/**
 * POST /api/admin/audit/alerts/[alertId]/acknowledge
 * 
 * Acknowledges a security alert
 * 
 * Body:
 * - acknowledged_by (required): Employee ID who is acknowledging the alert
 * 
 * Example:
 * POST /api/admin/audit/alerts/alert-123/acknowledge
 * Body: { "acknowledged_by": "EMP_001" }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;
    
    if (!alertId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la alerta' },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    const parsed = AcknowledgeAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { acknowledged_by } = parsed.data;

    // Acknowledge the alert
    const alert = await acknowledgeAlert(alertId, acknowledged_by);

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
