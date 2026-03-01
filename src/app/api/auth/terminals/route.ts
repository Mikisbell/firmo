// src/app/api/auth/terminals/route.ts
// API to list available terminals for selection

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { getTenantId } from '@/src/core/config/tenant';
import { logger } from '@/src/core/observability/structured-logger';

const TENANT_ID = getTenantId();

export async function GET() {
  try {
    const terminals = await prisma.terminals.findMany({
      where: {
        tenant_id: TENANT_ID,
        is_allowed: true,
      },
      select: {
        terminal_id: true,
        station_id: true,
      },
      take: 200,
    });

    return NextResponse.json({
      terminals: terminals.map(t => ({
        terminal_id: t.terminal_id,
        role: t.terminal_id.startsWith('kds') ? 'KDS' : 
              t.terminal_id.startsWith('waiter') ? 'WAITER' : 'CASHIER',
      })),
    });
  } catch (error) {
    logger.error('Error al listar terminales', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ terminals: [] });
  }
}
