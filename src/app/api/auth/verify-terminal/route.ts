// src/app/api/auth/verify-terminal/route.ts
// API to verify if terminal is still valid

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const VerifySchema = z.object({
  tenant_id: z.string().uuid(),
  terminal_id: z.string(),
  device_fingerprint: z.string().min(16),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = VerifySchema.parse(body);

    const terminal = await prisma.terminals.findUnique({
      where: {
        tenant_id_terminal_id: {
          tenant_id: data.tenant_id,
          terminal_id: data.terminal_id,
        },
      },
    });

    if (!terminal) {
      return NextResponse.json({
        valid: false,
        reason: 'TERMINAL_NOT_FOUND',
      });
    }

    if (!terminal.is_allowed) {
      return NextResponse.json({
        valid: false,
        reason: 'TERMINAL_DISABLED',
      });
    }

    if (terminal.device_secret_hash !== data.device_fingerprint) {
      return NextResponse.json({
        valid: false,
        reason: 'DEVICE_MISMATCH',
      });
    }

    // Update last seen
    await prisma.terminals.update({
      where: { id: terminal.id },
      data: { last_seen_at: new Date() },
    });

    return NextResponse.json({
      valid: true,
      terminal: {
        terminal_id: terminal.terminal_id,
        is_allowed: terminal.is_allowed,
      },
    });
  } catch (error) {
    console.error('Verify terminal error:', error);
    return NextResponse.json({
      valid: false,
      reason: 'ERROR',
    });
  }
}
