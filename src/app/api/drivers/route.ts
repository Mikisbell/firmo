/**
 * GET /api/drivers - Listar drivers
 * POST /api/drivers - Crear driver
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DriverService, DriverServiceError } from '@/src/core/delivery';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const CreateDriverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(9, 'Phone must be at least 9 characters').optional(),
});

export async function GET() {
  try {
    const drivers = await DriverService.listWithStatus(TENANT_ID);
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const driver = await DriverService.create(
      TENANT_ID,
      parsed.data.name,
      parsed.data.phone
    );

    return NextResponse.json(driver, { status: 201 });
  } catch (error) {
    if (error instanceof DriverServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error creating driver:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
