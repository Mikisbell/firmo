/**
 * Location API Endpoints
 * 
 * POST /api/locations - Driver updates location
 * GET /api/locations/drivers - Get all active driver locations (admin)
 * 
 * Requirements: 2.1, 2.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  updateDriverLocation,
  getActiveDriverLocations,
} from '@/src/core/delivery/geolocation.service';
import { toDriverId } from '@/src/core/delivery/types-2026';
import { logger } from '@/src/core/observability/logger';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { ADMIN_ROLES } from '@/src/core/constants/roles';
import prisma from '@/src/core/db/prisma';

// Validation schema for location update
const locationUpdateSchema = z.object({
  driverId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  timestamp: z.string().datetime(),
});

/**
 * POST /api/locations
 * Driver updates their location
 * 
 * Body:
 * {
 *   driverId: string,
 *   latitude: number,
 *   longitude: number,
 *   accuracy: number,
 *   speed?: number,
 *   heading?: number,
 *   timestamp: string (ISO 8601)
 * }
 * 
 * Validates: Requirements 2.1
 */
export async function POST(request: NextRequest) {
  try {
    // Auth required: any employee role (DRIVER included). Tenant comes from JWT.
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const user = authResult.user;

    const body = await request.json();

    // Validate request body
    const validation = locationUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Cuerpo de solicitud inválido',
          details: validation.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Driver must belong to the authenticated tenant (tenant_id from JWT, never from client)
    const driver = await prisma.drivers.findFirst({
      where: { id: data.driverId, tenant_id: user.tenantId },
      select: { id: true, employee_id: true },
    });

    if (!driver) {
      return NextResponse.json(
        { error: 'Repartidor no encontrado' },
        { status: 404 }
      );
    }

    // A non-admin user can only report their OWN location:
    // the driver record must be linked to the authenticated employee.
    const isAdmin = (ADMIN_ROLES as readonly string[]).includes(user.role);
    if (!isAdmin && driver.employee_id !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado para reportar la ubicación de otro repartidor' },
        { status: 403 }
      );
    }

    // Update location
    await updateDriverLocation(toDriverId(data.driverId), {
      latitude: data.latitude,
      longitude: data.longitude,
      accuracy: data.accuracy,
      speed: data.speed,
      heading: data.heading,
      timestamp: new Date(data.timestamp),
    });

    return NextResponse.json({
      success: true,
      message: 'Ubicación actualizada exitosamente',
    });
  } catch (error) {
    logger.error('LOCATION_UPDATE_ERROR', 'Failed to update location', error instanceof Error ? error : undefined);

    if (error instanceof Error && error.message.includes('Invalid coordinates')) {
      return NextResponse.json(
        {
          error: 'Coordenadas proporcionadas inválidas',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/locations/drivers
 * Get all active driver locations (admin only)
 * 
 * Response:
 * {
 *   drivers: Array<{
 *     driverId: string,
 *     location: {
 *       latitude: number,
 *       longitude: number,
 *       accuracy: number,
 *       speed?: number,
 *       heading?: number,
 *       timestamp: string
 *     }
 *   }>
 * }
 * 
 * Validates: Requirements 2.3
 */
export async function GET(request: NextRequest) {
  try {
    // Admin only (OWNER/ADMIN/MANAGER/SUPERVISOR). Tenant from JWT.
    const authResult = await requireAdminAuth(request);
    if (!authResult.authorized) return authResult.response;

    const tenantId = authResult.user.tenantId;

    const locations = await getActiveDriverLocations();

    // Redis keys are global — restrict results to drivers of the authenticated tenant
    const tenantDrivers = await prisma.drivers.findMany({
      where: { tenant_id: tenantId },
      select: { id: true },
    });
    const tenantDriverIds = new Set(tenantDrivers.map((d) => d.id));

    // Convert Map to array (tenant-scoped)
    const drivers = Array.from(locations.entries())
      .filter(([driverId]) => tenantDriverIds.has(driverId))
      .map(([driverId, location]) => ({
        driverId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          timestamp: location.timestamp.toISOString(),
        },
      })
    );

    return NextResponse.json({
      drivers,
      count: drivers.length,
    });
  } catch (error) {
    logger.error('DRIVER_LOCATIONS_ERROR', 'Failed to get driver locations', error instanceof Error ? error : undefined);

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
      },
      { status: 500 }
    );
  }
}
