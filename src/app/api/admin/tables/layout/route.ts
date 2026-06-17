/**
 * Tables Layout API - Bulk update table positions
 * 
 * Requirements: Visual Editor
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';

const updateLayoutSchema = z.object({
  tables: z.array(
    z.object({
      id: z.string().uuid(),
      position_x: z.number().int().min(0),
      position_y: z.number().int().min(0),
    })
  ).min(1),
});

export async function PUT(request: NextRequest) {
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
    const tenantId = authResult.user.tenantId;

    log.info({ operation: 'update_tables_layout' }, 'Updating tables layout');

    const body = await request.json();

    const parsed = updateLayoutSchema.safeParse(body);
    if (!parsed.success) {
      log.warn({
        operation: 'update_tables_layout_validation_error',
        errors: parsed.error.flatten(),
      }, 'Invalid layout data');

      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tables } = parsed.data;

    // We do multiple updates in a transaction
    const txStart = Date.now();
    await prisma.$transaction(async (tx: any) => {
      // Execute all updates
      await Promise.all(
        tables.map((table) =>
          tx.tables.update({
            where: { id: table.id, tenant_id: tenantId },
            data: {
              position_x: table.position_x,
              position_y: table.position_y,
              updated_at: new Date(),
            },
          })
        )
      );

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE_LAYOUT',
          resource: 'tables',
          metadata: { 
            tables_updated: tables.length,
          },
          created_at: new Date(),
        },
      });
    });
    logPerformance('db_transaction_update_tables_layout', Date.now() - txStart);

    // Invalidate tables cache
    await cache.invalidatePattern('tables:*');

    // Record business metrics
    metrics.increment('tables_layout_updated_total', {
      tenant_id: tenantId,
    });

    logAudit('UPDATE_LAYOUT', 'tables', authResult.user.id, {
      tables_count: tables.length,
    });

    log.info({
      operation: 'update_tables_layout_success',
      durationMs: Date.now() - startTime,
      count: tables.length,
    }, 'Tables layout updated successfully');
    
    return NextResponse.json({ success: true, updated: tables.length });
  } catch (error) {
    log.error({
      operation: 'update_tables_layout_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to update tables layout');
    return NextResponse.json({ error: 'Error al actualizar el layout de mesas' }, { status: 500 });
  }
}
