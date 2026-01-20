/**
 * Terminals API - GET
 * 
 * Requirements: 5.1
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Build where clause
    const where = { tenant_id: tenantId };
    
    // Get total count
    const total = await prisma.terminals.count({ where });
    
    // Get paginated terminals
    const terminals = await prisma.terminals.findMany({
      where,
      orderBy: { terminal_id: 'asc' },
      skip: params.skip,
      take: params.limit,
      select: {
        id: true,
        terminal_id: true,
        station_id: true,
        is_allowed: true,
        last_seen_at: true,
      },
    });
    
    return NextResponse.json(createPaginatedResponse(terminals, total, params));
  } catch (error) {
    console.error('Terminals GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch terminals' },
      { status: 500 }
    );
  }
}
