/**
 * Terminal Status Update API - PATCH
 * 
 * Updates the status of a terminal (active/disabled).
 * When disabled, the server will reject all requests from that terminal.
 * 
 * Requirements: 3.3 (Terminal Architecture v2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateTerminalStatus, type TerminalStatus } from '@/src/core/auth/terminal-registry';
import { logger } from '@/src/core/observability/logger';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    // Validate admin authentication and authorization
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) {
      return authResult.response;
    }

    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;

    const { terminalId } = await params;
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
    console.error('Terminal status update error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to update terminal status' },
      { status: 500 }
    );
  }
}
