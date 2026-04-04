/**
 * POST /api/delivery - Crear delivery order
 * GET /api/delivery - Listar deliveries pendientes
 * 
 * Query Parameters (GET):
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - status: Filter by status (comma-separated, default: PENDING,ASSIGNED,DISPATCHED)
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DeliveryService, DeliveryServiceError } from '@/src/core/delivery';
import { asCentavos } from '@/src/core/types/shared';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import prisma from '@/src/core/db/prisma';
import { cache } from '@/src/core/cache/redis.service';
import { logger } from '@/src/core/observability/structured-logger';


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
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const body = await request.json();
    const parsed = CreateDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const delivery = await DeliveryService.createDeliveryOrder({
      tenantId: authResult.user.tenantId,
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

    // Invalidar caché Redis de delivery metrics/history
    await cache.invalidatePattern('delivery:*');

    return NextResponse.json({
      ...delivery,
      trackingCode: delivery.tracking_code,
      trackingUrl: `/track/${delivery.tracking_code}`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    logger.error('Error al crear delivery', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    // Por defecto, obtener pendientes (PENDING, ASSIGNED, DISPATCHED)
    const statuses: string[] = statusParam
      ? statusParam.split(',')
      : ['PENDING', 'ASSIGNED', 'DISPATCHED'];

    // Build where clause
    const where = {
      tenant_id: authResult.user.tenantId,
      status: { in: statuses }
    };

    // Get total count
    const total = await prisma.delivery_orders.count({ where });

    // Get paginated deliveries
    const deliveries = await prisma.delivery_orders.findMany({
      where,
      skip: params.skip,
      take: params.limit,
      orderBy: { created_at: 'desc' },
      include: {
        drivers: {
          select: {
            id: true,
            name: true,
            phone: true,
          }
        }
      }
    });

    // Return standardized paginated response
    const response = createPaginatedResponse(deliveries, total, params);

    return NextResponse.json({
      ...response,
      // Maintain backward compatibility with 'deliveries' key
      deliveries: response.items,
    });
  } catch (error) {
    logger.error('Error al obtener deliveries', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
