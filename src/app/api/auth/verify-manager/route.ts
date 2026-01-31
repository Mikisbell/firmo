/**
 * Manager Verification API
 * 
 * Verifies manager PIN for step-up authentication
 * Requirements: 4.2 (PIN + manager confirmation)
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/logger';
import { logAuthEvent } from '@/src/core/auth/audit-logger';
import { hashPin } from '@/src/core/auth/auth.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, terminal_id, employee_id, reason } = body;

    if (!pin || !terminal_id || !employee_id) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // Hash the PIN before comparing
    const pinHash = hashPin(pin);

    // Find manager/admin employees
    const managers = await prisma.employees.findMany({
      where: {
        role: {
          in: ['ADMIN', 'MANAGER'],
        },
        pin_hash: pinHash,
      },
    });

    if (managers.length === 0) {
      // Log failed verification
      await logAuthEvent({
        tenant_id: 'default', // Should come from terminal
        terminal_id,
        employee_id,
        event_type: 'step_up_auth_failed',
        risk_score: null,
        fingerprint_match: null,
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          reason,
          manager_pin_incorrect: true,
        },
      });

      return NextResponse.json(
        { verified: false, error: 'PIN de manager incorrecto' },
        { status: 401 }
      );
    }

    const manager = managers[0];

    // Log successful verification
    await logAuthEvent({
      tenant_id: 'default', // Should come from terminal
      terminal_id,
      employee_id,
      event_type: 'step_up_auth_success',
      risk_score: null,
      fingerprint_match: null,
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown',
      metadata: {
        reason,
        manager_id: manager.id,
        manager_name: manager.name,
      },
    });

    logger.info('STEP_UP_AUTH_SUCCESS', 'Manager verification successful', {
      terminal_id,
      employee_id,
      manager_id: manager.id,
      reason,
    });

    return NextResponse.json({
      verified: true,
      manager: {
        id: manager.id,
        name: manager.name,
        role: manager.role,
      },
    });
  } catch (error) {
    logger.error('VERIFY_MANAGER_ERROR', 'Error verifying manager PIN', error as Error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
