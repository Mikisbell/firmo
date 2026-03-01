/**
 * Shift Guard Middleware
 *
 * Extends POS auth to also verify an OPEN shift exists
 * for the current terminal. Operations that handle money
 * (orders, payments) MUST have an active shift.
 *
 * @module core/middleware/shift-guard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePosAuth } from './pos-auth';
import prisma from '@/src/core/db/prisma';

export type ShiftAuthResult =
  | {
      authorized: true;
      user: {
        id: string;
        role: string;
        name: string;
        tenantId: string;
        sessionId: string;
        terminalId: string;
        shiftId: string;
      };
    }
  | { authorized: false; response: NextResponse };

/**
 * Requires POS auth + an OPEN shift on the terminal.
 * Returns 403 NO_OPEN_SHIFT if no shift is open.
 * Returns 400 TERMINAL_ID_REQUIRED if x-terminal-id header missing.
 */
export async function requireOpenShift(
  request: NextRequest
): Promise<ShiftAuthResult> {
  // 1. Standard POS auth
  const authResult = await requirePosAuth(request);
  if (!authResult.authorized) {
    return authResult;
  }

  // 2. Terminal ID required
  const terminalId = authResult.user.terminalId;
  if (!terminalId) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'TERMINAL_ID_REQUIRED', message: 'Se requiere x-terminal-id header' },
        { status: 400 },
      ),
    };
  }

  // 3. Query OPEN shift for this terminal
  const shift = await prisma.shifts.findFirst({
    where: {
      tenant_id: authResult.user.tenantId,
      terminal_id: terminalId,
      status: 'OPEN',
    },
    select: { id: true },
    orderBy: { opened_at: 'desc' },
  });

  if (!shift) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'NO_OPEN_SHIFT',
          message: 'No hay turno abierto en esta terminal. Abra un turno antes de operar.',
          terminal_id: terminalId,
        },
        { status: 403 },
      ),
    };
  }

  return {
    authorized: true,
    user: {
      ...authResult.user,
      terminalId,
      shiftId: shift.id,
    },
  };
}
