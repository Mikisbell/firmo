/**
 * GET /api/drivers/[id] - Obtener driver por ID
 * PATCH /api/drivers/[id] - Actualizar driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DriverService, DriverServiceError } from '@/src/core/delivery';

const UpdateDriverSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(9).optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await DriverService.getDriverStatus(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error fetching driver:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Handle activation/deactivation
    if (parsed.data.is_active !== undefined) {
      if (parsed.data.is_active) {
        await DriverService.activate(id);
      } else {
        await DriverService.deactivate(id);
      }
    }

    // Handle name/phone update
    if (parsed.data.name || parsed.data.phone !== undefined) {
      const driver = await DriverService.update(id, {
        name: parsed.data.name,
        phone: parsed.data.phone ?? undefined,
      });
      return NextResponse.json(driver);
    }

    // Return updated driver status
    const result = await DriverService.getDriverStatus(id);
    return NextResponse.json(result.driver);
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error updating driver:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
