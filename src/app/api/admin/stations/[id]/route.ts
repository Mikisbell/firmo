/**
 * Station API - PUT and DELETE by ID
 * Actualización y eliminación de estaciones KDS
 * 
 * Requirements: KDS stations management
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { UpdateStationSchema } from '@/src/core/admin/schemas/station.schema';
import { ZodError } from 'zod';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { getTenantId } from '@/src/core/config/location';

const TENANT_ID = getTenantId();

// PUT - Update station
async function handlePUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id } = await params;
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
    stationId: id,
  });

  try {
    log.info({ operation: 'update_station', stationId: id }, 'Updating station');
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = UpdateStationSchema.parse(body);

    // Check if station exists
    const checkStart = Date.now();
    const existing = await prisma.stations.findFirst({
      where: { 
        id: id,
        tenant_id: TENANT_ID,
      },
    });
    logPerformance('db_check_station_exists', Date.now() - checkStart);

    if (!existing) {
      log.warn({
        operation: 'update_station_not_found',
        stationId: id,
      }, 'Station not found');
      
      return NextResponse.json(
        { error: 'Estación no encontrada' },
        { status: 404 }
      );
    }

    // Update station in transaction with audit trail
    const txStart = Date.now();
    const station = await prisma.$transaction(async (tx) => {
      const updated = await tx.stations.update({
        where: { id: id },
        data: validatedData,
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'stations',
          metadata: { 
            record_id: updated.id,
            changes: validatedData,
          },
          created_at: new Date(),
        },
      });

      return updated;
    });
    logPerformance('db_transaction_update_station', Date.now() - txStart);

    // Invalidate stations cache
    await cache.invalidatePattern('stations:*');

    // Invalidate metrics cache if estimated_time changed
    if (validatedData.estimated_time !== undefined) {
      await cache.invalidatePattern(`station:${id}:metrics*`);
      await cache.invalidatePattern(`station:${id}:trends*`);
      log.info({ stationId: id }, 'Invalidated metrics cache due to estimated_time update');
    }

    // Update active stations gauge if is_active changed
    if (validatedData.is_active !== undefined) {
      const activeCount = await prisma.stations.count({
        where: { 
          tenant_id: TENANT_ID,
          is_active: true,
        },
      });
      metrics.set('stations_active', activeCount, {
        tenant_id: TENANT_ID,
      });
    }

    // Log audit event
    logAudit('UPDATE', 'stations', authResult.user.id, {
      stationId: station.id,
      stationCode: station.code,
      changes: validatedData,
    });

    log.info({
      operation: 'update_station_success',
      stationId: station.id,
      stationCode: station.code,
      durationMs: Date.now() - startTime,
    }, 'Station updated successfully');

    return NextResponse.json(station);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'update_station_validation_error',
        errors: error.errors,
      }, 'Invalid station data');
      
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    
    log.error({
      operation: 'update_station_error',
      stationId: id,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to update station');
    
    return NextResponse.json(
      { error: 'Error al actualizar estación' },
      { status: 500 }
    );
  }
}

export const PUT = handlePUT;

// DELETE - Soft delete station (set is_active = false)
async function handleDELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id } = await params;
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
    stationId: id,
  });

  try {
    log.info({ operation: 'delete_station', stationId: id }, 'Deleting station');
    
    // Check if station exists
    const checkStart = Date.now();
    const existing = await prisma.stations.findFirst({
      where: { 
        id: id,
        tenant_id: TENANT_ID,
      },
      include: {
        _count: {
          select: {
            terminals: true,
          },
        },
      },
    });
    logPerformance('db_check_station_exists', Date.now() - checkStart);

    if (!existing) {
      log.warn({
        operation: 'delete_station_not_found',
        stationId: id,
      }, 'Station not found');
      
      return NextResponse.json(
        { error: 'Estación no encontrada' },
        { status: 404 }
      );
    }

    // Check if station has active terminals
    if (existing._count.terminals > 0) {
      log.warn({
        operation: 'delete_station_has_terminals',
        stationId: id,
        terminalsCount: existing._count.terminals,
      }, 'Cannot delete station with active terminals');
      
      return NextResponse.json(
        { error: `No se puede eliminar: la estación tiene ${existing._count.terminals} terminal(es) asignado(s)` },
        { status: 409 }
      );
    }

    // Soft delete station in transaction with audit trail
    const txStart = Date.now();
    const station = await prisma.$transaction(async (tx) => {
      const deleted = await tx.stations.update({
        where: { id: id },
        data: { is_active: false },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: TENANT_ID,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'stations',
          metadata: { record_id: deleted.id },
          created_at: new Date(),
        },
      });

      return deleted;
    });
    logPerformance('db_transaction_delete_station', Date.now() - txStart);

    // Invalidate stations cache
    await cache.invalidatePattern('stations:*');

    // Update active stations gauge
    const activeCount = await prisma.stations.count({
      where: { 
        tenant_id: TENANT_ID,
        is_active: true,
      },
    });
    metrics.set('stations_active', activeCount, {
      tenant_id: TENANT_ID,
    });

    // Log audit event
    logAudit('DELETE', 'stations', authResult.user.id, {
      stationId: station.id,
      stationCode: station.code,
    });

    log.info({
      operation: 'delete_station_success',
      stationId: station.id,
      stationCode: station.code,
      durationMs: Date.now() - startTime,
    }, 'Station deleted successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({
      operation: 'delete_station_error',
      stationId: id,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to delete station');
    
    return NextResponse.json(
      { error: 'Error al eliminar estación' },
      { status: 500 }
    );
  }
}

export const DELETE = handleDELETE;
