/**
 * GET /api/drivers - Listar drivers
 * POST /api/drivers - Crear driver
 * 
 * Query Parameters (GET):
 * - page: Page number (default: 1, min: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * 
 * Requirements: 9.6 (Pagination with max 100 items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DriverService, DriverServiceError } from '@/src/core/delivery';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { parsePaginationParams, createPaginatedResponse } from '@/src/lib/pagination';
import prisma from '@/src/core/db/prisma';
import { logger } from '@/src/core/observability/structured-logger';


const CreateDriverSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 caracteres').optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;

    // Parse pagination parameters (supports page/pageSize)
    const params = parsePaginationParams(request.nextUrl.searchParams);

    // Get total count of drivers
    const total = await prisma.drivers.count({
      where: { tenant_id: tenantId }
    });

    // Get paginated drivers with status
    const drivers = await prisma.drivers.findMany({
      where: { tenant_id: tenantId },
      skip: params.skip,
      take: params.limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        is_active: true,
      }
    });
    
    // Enhance with status information
    const driversWithStatus = await Promise.all(
      drivers.map(async (driver) => {
        const activeDeliveries = await prisma.delivery_orders.count({
          where: {
            driver_id: driver.id,
            status: { in: ['ASSIGNED', 'DISPATCHED'] }
          }
        });
        
        return {
          ...driver,
          status: activeDeliveries > 0 ? 'BUSY' : 'AVAILABLE',
          active_deliveries: activeDeliveries
        };
      })
    );
    
    // Return standardized paginated response
    const response = createPaginatedResponse(driversWithStatus, total, params);
    
    return NextResponse.json({
      ...response,
      // Maintain backward compatibility with 'drivers' key
      drivers: response.items,
    });
  } catch (error) {
    logger.error('Error al obtener repartidores', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const parsed = CreateDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Error de validación', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const driver = await DriverService.create(
      authResult.user.tenantId,
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
    logger.error('Error al crear repartidor', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
