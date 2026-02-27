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
import { logger } from '@/src/core/observability/logger';

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

    // Get tenant ID
    const tenantId = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    // Find the terminal
    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: terminalId,
        tenant_id: tenantId,
      },
    });

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal not found' },
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
      console.log('[UNBIND] Terminal already unbound:', {
        terminal_id: terminalId,
        has_fingerprint: !!terminal.fingerprint_hash,
        status: terminal.status,
      });
      return NextResponse.json(
        { 
          error: 'Terminal is not bound to any device',
          details: {
            hasFingerprint: !!terminal.fingerprint_hash,
            status: terminal.status,
            message: 'Terminal is already in pending status with no device bound'
          }
        },
        { status: 400 }
      );
    }
    
    // Log warning if terminal is in inconsistent state
    if (isInconsistentState) {
      console.log('[UNBIND] Terminal in inconsistent state - proceeding with reset:', {
        terminal_id: terminalId,
        has_fingerprint: !!terminal.fingerprint_hash,
        status: terminal.status,
        fingerprint_hash_preview: terminal.fingerprint_hash ? terminal.fingerprint_hash.slice(0, 20) + '...' : null
      });
      logger.warn('TERMINAL_INCONSISTENT_STATE', 'Terminal has inconsistent state, proceeding with unbind', {
        terminal_id: terminalId,
        has_fingerprint: !!terminal.fingerprint_hash,
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

    logger.info('TERMINAL_UNBOUND', 'Terminal unbound successfully', {
      terminal_id: terminalId,
      unbound_by: user.id,
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
    console.error('Unbind terminal error:', error instanceof Error ? error.message : String(error));
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('TERMINAL_UNBIND_FAILED', 'Failed to unbind terminal', err);
    return NextResponse.json(
      { error: 'Failed to unbind terminal' },
      { status: 500 }
    );
  }
}
