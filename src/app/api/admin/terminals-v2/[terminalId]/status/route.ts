/**
 * Terminal Status Update API - PATCH
 * 
 * Updates the status of a terminal (active/disabled).
 * When disabled, the server will reject all requests from that terminal.
 * 
 * Requirements: 3.3 (Terminal Architecture v2)
 */

import { NextResponse } from 'next/server';
import { updateTerminalStatus, type TerminalStatus } from '@/src/core/auth/terminal-registry';
import { logger } from '@/src/core/observability/logger';
import { getTenantId } from '@/src/core/config/tenant';
import prisma from '@/src/core/db/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const { terminalId } = await params;
    const tenantId = getTenantId();
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!['active', 'disabled', 'pending'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: active, disabled, or pending' },
        { status: 400 }
      );
    }

    // Update terminal status
    const terminal = await updateTerminalStatus(terminalId, tenantId, status as TerminalStatus);

    if (!terminal) {
      return NextResponse.json(
        { error: 'Terminal no encontrado' },
        { status: 404 }
      );
    }

    logger.info('TERMINAL_STATUS_UPDATED', 'Terminal status updated', {
      terminal_id: terminalId,
      new_status: status,
    });

    return NextResponse.json({
      success: true,
      terminal,
    });
  } catch (error) {
    console.error('Terminal status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update terminal status' },
      { status: 500 }
    );
  }
}
