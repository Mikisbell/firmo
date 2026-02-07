/**
 * Tables API - GET, PUT, DELETE by ID
 * 
 * Requirements: 2.1, 2.2
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';
import { getTenantId } from '@/src/core/config/tenant';
import { getLocationId } from '@/src/core/config/location';

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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    const { id } = await params;
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    log.info({ operation: 'get_table', tableId: id }, 'Getting table');
    
    const dbStart = Date.now();
    const table = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        zones: { select: { id: true, code: true, name: true, color: true } },
      },
    });
    logPerformance('db_query_table', Date.now() - dbStart);
    
    if (!table) {
      log.warn({ operation: 'get_table_not_found', tableId: id }, 'Table not found');
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }
    
    log.info({
      operation: 'get_table_success',
      tableId: id,
      durationMs: Date.now() - startTime,
    }, 'Table retrieved successfully');
    
    return NextResponse.json({
      ...table,
      zone: table.zones,
    });
  } catch (error) {
    log.error({
      operation: 'get_table_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to fetch table');
    return NextResponse.json({ error: 'Error al obtener mesa' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    const { id } = await params;
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    const locationId = getLocationId();
    
    log.info({ operation: 'update_table', tableId: id }, 'Updating table');
    
    const body = await request.json();
    
    const parsed = updateTableSchema.safeParse(body);
    if (!parsed.success) {
      log.warn({
        operation: 'update_table_validation_error',
        errors: parsed.error.flatten(),
      }, 'Invalid table data');
      
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const data = parsed.data;
    
    // Check table exists with tenantId from JWT
    const checkStart = Date.now();
    const existing = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
    });
    logPerformance('db_check_table_exists', Date.now() - checkStart);
    
    if (!existing) {
      log.warn({ operation: 'update_table_not_found', tableId: id }, 'Table not found');
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }
    
    // Check duplicate number if changing (with tenantId from JWT)
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
        log.warn({
          operation: 'update_table_duplicate_number',
          tableId: id,
          number: data.number,
        }, 'Table number already exists');
        return NextResponse.json({ error: 'El número de mesa ya existe' }, { status: 409 });
      }
    }
    
    // Validate zone if provided (with tenantId from JWT)
    if (data.zone_id) {
      const zone = await prisma.zones.findFirst({
        where: { id: data.zone_id, tenant_id: tenantId },
      });
      if (!zone) {
        log.warn({
          operation: 'update_table_invalid_zone',
          tableId: id,
          zoneId: data.zone_id,
        }, 'Zone not found');
        return NextResponse.json({ error: 'Zona no encontrada' }, { status: 400 });
      }
    }
    
    // Update table in transaction with audit trail (using tenantId from JWT)
    const txStart = Date.now();
    const table = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.tables.update({
        where: { id },
        data: {
          ...data,
          updated_at: new Date(),
        },
        include: {
          zones: { select: { id: true, code: true, name: true, color: true } },
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'tables',
          metadata: { 
            record_id: updated.id,
            changes: data,
          },
          created_at: new Date(),
        },
      });

      return updated;
    });
    logPerformance('db_transaction_update_table', Date.now() - txStart);

    // Invalidate tables cache
    await cache.invalidatePattern('tables:*');

    // Record business metrics with tenantId from JWT
    metrics.increment('tables_updated_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('UPDATE', 'tables', authResult.user.id, {
      tableId: table.id,
      tableNumber: table.number,
      changes: data,
    });

    log.info({
      operation: 'update_table_success',
      tableId: table.id,
      durationMs: Date.now() - startTime,
    }, 'Table updated successfully');
    
    return NextResponse.json({
      ...table,
      zone: table.zones,
    });
  } catch (error) {
    log.error({
      operation: 'update_table_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to update table');
    return NextResponse.json({ error: 'Error al actualizar mesa' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const startTime = Date.now();
  
  // Validate admin authentication and authorization
  const authResult = await requireAdminAuth(request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  const log = createRequestLogger(requestId, authResult.user.id, {
    userRole: authResult.user.role,
  });
  
  try {
    const { id } = await params;
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    log.info({ operation: 'delete_table', tableId: id }, 'Deleting table');
    
    const checkStart = Date.now();
    const existing = await prisma.tables.findFirst({
      where: { id, tenant_id: tenantId },
    });
    logPerformance('db_check_table_exists', Date.now() - checkStart);
    
    if (!existing) {
      log.warn({ operation: 'delete_table_not_found', tableId: id }, 'Table not found');
      return NextResponse.json({ error: 'Mesa no encontrada' }, { status: 404 });
    }
    
    // Check if table has active orders
    if (existing.current_order_id) {
      log.warn({
        operation: 'delete_table_has_active_order',
        tableId: id,
        orderId: existing.current_order_id,
      }, 'Cannot delete table with active order');
      return NextResponse.json(
        { error: 'No se puede eliminar mesa con orden activa' },
        { status: 400 }
      );
    }
    
    // Soft delete - just deactivate in transaction with audit trail (using tenantId from JWT)
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      await tx.tables.update({
        where: { id },
        data: { is_active: false, updated_at: new Date() },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'DELETE',
          resource: 'tables',
          metadata: { record_id: id },
          created_at: new Date(),
        },
      });
    });
    logPerformance('db_transaction_delete_table', Date.now() - txStart);

    // Invalidate tables cache
    await cache.invalidatePattern('tables:*');

    // Update active tables gauge with tenantId from JWT
    const activeCount = await prisma.tables.count({
      where: { tenant_id: tenantId, is_active: true },
    });
    metrics.set('tables_active', activeCount, {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('DELETE', 'tables', authResult.user.id, {
      tableId: id,
      tableNumber: existing.number,
    });

    log.info({
      operation: 'delete_table_success',
      tableId: id,
      durationMs: Date.now() - startTime,
    }, 'Table deleted successfully');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error({
      operation: 'delete_table_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to delete table');
    return NextResponse.json({ error: 'Error al eliminar mesa' }, { status: 500 });
  }
}
