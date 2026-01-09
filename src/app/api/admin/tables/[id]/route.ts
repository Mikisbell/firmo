/**
 * Tables API - GET, PUT, DELETE by ID
 * 
 * Requirements: 2.1, 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { z } from 'zod';

const updateTableSchema = z.object({
  number: z.string().min(1).max(20).optional(),
  display_name: z.string().max(50).nullable().optional(),
  zone_id: z.string().uuid().nullable().optional(),
  capacity: z.number().int().min(1).max(20).optional(),
  shape: z.enum(['SQUARE', 'ROUND', 'RECTANGLE']).optional(),
  position_x: z.number().int().min(0).optional(),
  position_y: z.number().int().min(0).optional(),
  width: z.number().int().min(30).max(200).optional(),
  height: z.number().int().min(30).max(200).optional(),
  rotation: z.number().int().min(0).max(360).optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    const table = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    
    if (!table) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      ...table,
      zone: table.zones,
    });
  } catch (error) {
    console.error('Table GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch table' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    const locationId = process.env.LOCATION_ID || 'default';
    const body = await request.json();
    
    const parsed = updateTableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid table data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check table exists
    const existing = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    
    // Check duplicate number if changing
    if (data.number && data.number !== existing.number) {
      const duplicate = await prisma.tables.findFirst({
        where: {
          tenant_id: tenantId,
          location_id: locationId,
          number: data.number,
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Table number already exists' }, { status: 409 });
      }
    }
    
    // Validate zone if provided
    if (data.zone_id) {
      const zone = await prisma.zones.findFirst({
        where: { id: data.zone_id, tenant_id: tenantId },
      });
      if (!zone) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 400 });
      }
    }
    
    const table = await prisma.tables.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    
    return NextResponse.json({
      ...table,
      zone: table.zones,
    });
  } catch (error) {
    console.error('Table PUT error:', error);
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = process.env.TENANT_ID || 'default';
    
    const existing = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
    });
    
    if (!existing) {
      return NextResponse.json({ error: 'Table not found' }, { status: 404 });
    }
    
    // Check if table has active orders
    if (existing.current_order_id) {
      return NextResponse.json(
        { error: 'Cannot delete table with active order' },
        { status: 400 }
      );
    }
    
    // Soft delete - just deactivate
    await prisma.tables.update({
      where: { id },
      data: { is_active: false, updated_at: new Date() },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Table DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 });
  }
}
