/**
 * POST /api/delivery - Crear delivery order
 * GET /api/delivery - Listar deliveries pendientes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { asCentavos } from '@/src/core/types/shared';

const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const CreateDeliverySchema = z.object({
  orderId: z.string().uuid(),
  addressText: z.string().min(10, 'La dirección debe tener al menos 10 caracteres'),
  addressReference: z.string().optional(),
  customerPhone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres'),
  deliveryFee: z.number().int().min(0, 'El costo de envío debe ser no negativo'),
  estimatedDeliveryAt: z.string().datetime().optional(),
  addressId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: TENANT_ID,
      orderId: parsed.data.orderId,
      addressText: parsed.data.addressText,
      addressReference: parsed.data.addressReference,
      customerPhone: parsed.data.customerPhone,
      deliveryFee: asCentavos(parsed.data.deliveryFee),
      estimatedDeliveryAt: parsed.data.estimatedDeliveryAt 
        ? new Date(parsed.data.estimatedDeliveryAt) 
        : undefined,
      addressId: parsed.data.addressId,
    });

    return NextResponse.json(delivery, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    
    // Por defecto, obtener pendientes (PENDING, ASSIGNED, DISPATCHED)
    const statuses = statusParam 
      ? statusParam.split(',') as ('PENDING' | 'ASSIGNED' | 'DISPATCHED' | 'DELIVERED' | 'FAILED')[]
      : ['PENDING', 'ASSIGNED', 'DISPATCHED'] as const;

    const deliveries = await DeliveryService.getByStatus(TENANT_ID, [...statuses]);

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
