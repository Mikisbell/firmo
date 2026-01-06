// src/app/api/auth/terminals/route.ts
// API to list available terminals for selection

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  try {
    const terminals = await prisma.terminal.findMany({
      where: {
        tenant_id: TENANT_ID,
        is_allowed: true,
      },
      select: {
        terminal_id: true,
        station_id: true,
      },
    });

    return NextResponse.json({
      terminals: terminals.map(t => ({
        terminal_id: t.terminal_id,
        role: t.terminal_id.startsWith('kds') ? 'KDS' : 
              t.terminal_id.startsWith('waiter') ? 'WAITER' : 'CASHIER',
      })),
    });
  } catch (error) {
    console.error('Error listing terminals:', error);
    return NextResponse.json({ terminals: [] });
  }
}
