/**
 * Tables API - GET and POST
 * Gestión de mesas del restaurante
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';

const tableSchema = z.object({
  number: z.string().min(1).max(20),
  display_name: z.string().max(50).nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  capacity: z.number().int().min(1).max(20).default(4),
  shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).default('SQUARE'),
  position_x: z.number().int().min(0).default(0),
  position_y: z.number().int().min(0).default(0),
  width: z.number().int().min(30).max(200).default(60),
  height: z.number().int().min(30).max(200).default(60),
  rotation: z.number().int().min(0).max(360).default(0),
  is_active: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const locationId = process.env.LOCATION_ID || 'default';
    
    // Parse pagination parameters
    const params = parsePaginationParams(request.nextUrl.searchParams);
    
    // Parse filter parameters
    const zoneId = request.nextUrl.searchParams.get('zone_id');
    const activeOnly = request.nextUrl.searchParams.get('active') === 'true';
    
    // Build where clause
    const where: Record<string, unknown> = {
      tenant_id: tenantId,
      location_id: locationId,
    };
    
    if (zoneId) where.zone_id = zoneId;
    if (activeOnly) where.is_active = true;
    
    // Get total count
    const total = await prisma.tables.count({ where });
    
    // Get paginated tables
    const tables = await prisma.tables.findMany({
      where,
      orderBy: [{ zone_id: 'asc' }, { number: 'asc' }],
      skip: params.skip,
      take: params.limit,
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    
    const items = tables.map(t => ({
      id: t.id,
      number: t.number,
      display_name: t.display_name,
      capacity: t.capacity,
      shape: t.shape,
      position_x: t.position_x,
      position_y: t.position_y,
      width: t.width,
      height: t.height,
      rotation: t.rotation,
      status: t.status,
      is_active: t.is_active,
      zone_id: t.zone_id,
      zone: t.zones ? {
        id: t.zones.id,
        code: t.zones.code,
        name: t.zones.name,
        color: t.zones.color,
      } : null,
    }));
    
    return NextResponse.json(createPaginatedResponse(items, total, params));
  } catch (error) {
    console.error('Tables GET error:', error);
    return NextResponse.json({ error: 'Error al obtener mesas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.TENANT_ID || 'default';
    const locationId = process.env.LOCATION_ID || 'default';
    const body = await request.json();
    
    const parsed = tableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de mesa inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check duplicate number
    const existing = await prisma.tables.findFirst({
      where: { tenant_id: tenantId, location_id: locationId, number: data.number },
    });
    
    if (existing) {
      return NextResponse.json({ error: 'El número de mesa ya existe' }, { status: 409 });
    }
    
    // Validate zone exists if provided
    if (data.zone_id) {
      const zone = await prisma.zones.findFirst({
        where: { id: data.zone_id, tenant_id: tenantId },
      });
      if (!zone) {
        return NextResponse.json({ error: 'Zona no encontrada' }, { status: 400 });
      }
    }
    
    const table = await prisma.tables.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        location_id: locationId,
        number: data.number,
        display_name: data.display_name || `Mesa ${data.number}`,
        zone_id: data.zone_id || null,
        capacity: data.capacity,
        shape: data.shape,
        position_x: data.position_x,
        position_y: data.position_y,
        width: data.width,
        height: data.height,
        rotation: data.rotation,
        is_active: data.is_active,
      },
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    
    return NextResponse.json({
      ...table,
      zone: table.zones,
    }, { status: 201 });
  } catch (error) {
    console.error('Tables POST error:', error);
    return NextResponse.json({ error: 'Error al crear mesa' }, { status: 500 });
  }
}
