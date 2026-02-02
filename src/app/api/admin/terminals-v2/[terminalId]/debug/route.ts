/**
 * Debug Terminal Status API
 * 
 * Returns raw terminal data for debugging unbind issues
 */

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ terminalId: string }> }
) {
  try {
    const { terminalId } = await params;
    const tenantId = process.env.TENANT_ID || 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    const terminal = await prisma.terminal_devices.findFirst({
      where: {
        terminal_id: terminalId,
        tenant_id: tenantId,
      },
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    return NextResponse.json({
      terminal: {
        id: terminal.id,
        terminal_id: terminal.terminal_id,
        status: terminal.status,
        fingerprint_hash: terminal.fingerprint_hash,
        fingerprint_hash_preview: terminal.fingerprint_hash ? terminal.fingerprint_hash.slice(0, 32) + '...' : null,
        bound_at: terminal.bound_at,
        last_seen_at: terminal.last_seen_at,
        drift_score: terminal.drift_score,
      },
      checks: {
        has_fingerprint: !!terminal.fingerprint_hash,
        is_pending: terminal.status === 'pending',
        is_active: terminal.status === 'active',
        can_unbind: !!terminal.fingerprint_hash && terminal.status !== 'pending',
      }
    });

  } catch (error) {
    console.error('Debug terminal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
