/**
 * Zones API - GET and POST
 * Gestión de zonas/pisos del restaurante
 * 
 * Requirements: 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const zoneSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4CAF50'),
  is_outdoor: z.boolean().default(false),
  is_smoking: z.boolean().default(false),
  has_ac: z.boolean().default(false),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export async function GET() {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const locationId = process.env.LOCATION_ID || 'default';
    
    const zones = await prisma.zones.findMany({
      where: { tenant_id: tenantId, location_id: locationId },
      orderBy: { sort_order: 'asc' },
      include: {
        _count: { select: { tables: true } },
      },
    });
    
    return NextResponse.json(zones.map(z => ({
      ...z,
      tables_count: z._count.tables,
    })));
  } catch (error) {
    console.error('Zones GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch zones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const locationId = process.env.LOCATION_ID || 'default';
    const body = await request.json();
    
    const parsed = zoneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid zone data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check duplicate code
    const existing = await prisma.zones.findFirst({
      where: { tenant_id: tenantId, location_id: locationId, code: data.code },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Zone code already exists' }, { status: 409 });
    }
    
    const zone = await prisma.zones.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        location_id: locationId,
        ...data,
      },
    });
    
    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Zones POST error:', error);
    return NextResponse.json({ error: 'Failed to create zone' }, { status: 500 });
  }
}
