/**
 * Terminals API - GET
 * 
 * Requirements: 5.1
 */

import { NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    const terminals = await prisma.terminals.findMany({
      where: { tenant_id: tenantId },
      orderBy: { terminal_id: 'asc' },
      select: {
        id: true,
        terminal_id: true,
        station_id: true,
        is_allowed: true,
        last_seen_at: true,
      },
    });
    
    return NextResponse.json(terminals);
  } catch (error) {
    console.error('Terminals GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminals' },
      { status: 500 }
    );
  }
}
