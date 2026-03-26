/**
 * Business Configuration API
 * Requirements: 8.1, 8.2, 8.3
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/src/core/db/prisma';
import { requireAdminAuth } from '@/src/core/middleware/admin-auth';
import { UpdateConfigSchema } from '@/src/core/admin/schemas/config.schema';
import { ZodError } from 'zod';
import { withRequestLogging } from '@/src/core/middleware/request-logger';
import { createRequestLogger, logAudit, logPerformance } from '@/src/core/observability/logger-pino';
import { cache, generateCacheKey } from '@/src/core/cache/redis.service';
import { metrics } from '@/src/core/observability/metrics';


async function handleGET(request: NextRequest) {
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
    log.info({ operation: 'get_config' }, 'Getting config');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    // Generate cache key with tenantId
    const cacheKey = generateCacheKey('config', tenantId);

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      log.info({
        operation: 'get_config_cache_hit',
        cacheKey,
        durationMs: Date.now() - startTime,
      }, 'Config retrieved from cache');
      return NextResponse.json(cached);
    }

    // Get config from DB with tenantId from JWT
    const dbStart = Date.now();
    const settings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });
    logPerformance('db_query_config', Date.now() - dbStart);
    
    if (!settings) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 });
    }

    // Cache for 10 minutes with tag for proper invalidation
    await cache.set(cacheKey, settings, { ttl: 600, tags: ['config'] });

    // Record business metrics with tenantId from JWT
    metrics.increment('config_requests_total', {
      tenant_id: tenantId,
    });

    log.info({
      operation: 'get_config_success',
      cached: true,
      durationMs: Date.now() - startTime,
    }, 'Config retrieved successfully');
    
    return NextResponse.json(settings);
  } catch (error) {
    log.error({
      operation: 'get_config_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    }, 'Failed to get config');
    
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 });
  }
}

export const GET = withRequestLogging(handleGET);

async function handlePUT(request: NextRequest) {
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
    log.info({ operation: 'update_config' }, 'Updating config');
    
    // Extract tenantId from JWT
    const tenantId = authResult.user.tenantId;
    
    const body = await request.json();
    
    // Validate with Zod
    const validatedData = UpdateConfigSchema.parse(body);

    // Get old values for audit trail with tenantId from JWT
    const oldSettings = await prisma.tenant_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!oldSettings) {
      return NextResponse.json({ error: 'Configuración no encontrada' }, { status: 404 });
    }
    
    // Update settings in transaction with audit trail (using tenantId from JWT)
    const txStart = Date.now();
    const settings = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.tenant_settings.update({
        where: { tenant_id: tenantId },
        data: {
          legal_name: validatedData.legal_name,
          ruc: validatedData.ruc || null,
          address_text: validatedData.address_text || null,
          updated_at: new Date(),
        },
      });

      // Log audit trail
      await tx.admin_access_logs.create({
        data: {
          id: randomUUID(),
          tenant_id: tenantId,
          employee_id: authResult.user.id,
          action: 'UPDATE',
          resource: 'config',
          metadata: {
            old_values: {
              legal_name: oldSettings.legal_name,
              ruc: oldSettings.ruc,
              address_text: oldSettings.address_text,
            },
            new_values: {
              legal_name: validatedData.legal_name,
              ruc: validatedData.ruc || null,
              address_text: validatedData.address_text || null,
            },
          },
          created_at: new Date(),
        },
      });

      return updated;
    });
    logPerformance('db_transaction_update_config', Date.now() - txStart);

    // Invalidate config cache
    await cache.deleteByTag('config');

    // Record business metrics with tenantId from JWT
    metrics.increment('config_updates_total', {
      tenant_id: tenantId,
    });

    // Log audit event
    logAudit('UPDATE', 'config', authResult.user.id, {
      changes: Object.keys(validatedData),
    });

    log.info({
      operation: 'update_config_success',
      durationMs: Date.now() - startTime,
    }, 'Config updated successfully');
    
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn({
        operation: 'update_config_validation_error',
        errors: error.errors,
      }, 'Invalid config data');
      
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
      operation: 'update_config_error',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
      durationMs: Date.now() - startTime,
    }, 'Failed to update config');
    
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 });
  }
}

export const PUT = withRequestLogging(handlePUT);
