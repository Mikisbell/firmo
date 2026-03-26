/**
 * Terminal Unbind API - POST
 * 
 * Unbinds a device from a terminal, allowing it to be reactivated on a new device.
 * This resets the fingerprint and sets status back to 'pending'.
 * 
 * Requirements: 3.3 (Terminal Architecture v2)
 */

import { NextResponse, NextRequest } from 'next/server';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';

/**
 * Generate a valid UUID v4 using Math.random
 * This is more compatible with Next.js runtime than crypto.randomUUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    // Validate admin authentication
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const { user } = authResult;
    const { terminalId } = await params;

    // Get tenant ID from JWT (never from env)
    const tenantId = authResult.user.tenantId;

    // Find the terminal
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: terminalId,
        tenant_id: tenantId,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal no encontrado' },
        { status: 404 }
      );
    }

    // Check if terminal is already unbound (both conditions must be true)
    // Estado normal de "no vinculado": no tiene fingerprint Y está en pending
    const isActuallyUnbound = !terminal.fingerprint_hash && terminal.status === 'pending';
    
    // Estado inconsistente: tiene fingerprint pero está en pending, o está active pero no tiene fingerprint
    const isInconsistentState = (!terminal.fingerprint_hash && terminal.status === 'active') || 
                                 (terminal.fingerprint_hash && terminal.status === 'pending');
    
    if (isActuallyUnbound) {
      logger.warn('Terminal ya esta desvinculado', {
        terminalId,
        hasFingerprint: !!terminal.fingerprint_hash,
        status: terminal.status,
      });
      return NextResponse.json(
        { 
          error: 'El terminal no está vinculado a ningún dispositivo',
          details: {
            hasFingerprint: !!terminal.fingerprint_hash,
            status: terminal.status,
            message: 'El terminal ya está en estado pendiente sin dispositivo vinculado'
          }
        },
        { status: 400 }
      );
    }
    
    // Log warning if terminal is in inconsistent state
    if (isInconsistentState) {
      logger.warn('Terminal en estado inconsistente, procediendo con desvinculacion', {
        terminalId,
        hasFingerprint: !!terminal.fingerprint_hash,
        status: terminal.status,
      });
    }

    // Unbind the terminal
    const updatedTerminal = await prisma.terminal_devices.update({
      where: { id: terminal.id },
      data: {
        fingerprint_hash: null,
        status: 'pending',
        bound_at: null,
        drift_score: 0,
        updated_at: new Date(),
      },
    });

    // Create audit log event
    await prisma.events.create({
      data: {
        id: generateUUID(),
        tenant_id: tenantId,
        occurred_at: new Date(),
        type: 'TERMINAL_UNBOUND',
        entity_type: 'TERMINAL',
        entity_id: terminal.id,
        actor_id: user.id,
        actor_role_snapshot: user.role,
        terminal_id: terminalId,
        payload: {
          terminal_id: terminalId,
          unbound_by: user.id,
          previous_status: terminal.status,
        },
      },
    });

    logger.info('Terminal desvinculado exitosamente', {
      terminalId,
      unboundBy: user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Terminal desvinculado exitosamente',
      terminal: {
        id: updatedTerminal.id,
        terminal_id: updatedTerminal.terminal_id,
        status: updatedTerminal.status,
        role: updatedTerminal.role,
      },
    });

  } catch (error) {
    logger.error('Error al desvincular terminal', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error al desvincular terminal' },
      { status: 500 }
    );
  }
}
