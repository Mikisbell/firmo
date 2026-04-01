// src/app/api/inventory/movements/recent/route.ts
// API para obtener los últimos movimientos de inventario
// Task 5.3 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';
import { requirePosAuth } from '@/src/core/middleware/pos-auth';
import { KardexMovementType } from '@/src/app/api/inventory/kardex/[code]/route';
import { logger } from '@/src/core/observability/structured-logger';

interface RecentMovement {
  id: string;
  timestamp: string;
  type: KardexMovementType;
  quantity: number;
  inventoryCode: string;
  inventoryName: string;
  actorName: string;
}

interface RecentMovementsResponse {
  movements: RecentMovement[];
}

/**
 * GET /api/inventory/movements/recent
 * 
 * Query params:
 * - tenant_id: string (requerido)
 * - location_id: string (opcional)
 * - limit: number (default 10, max 50)
 */
export async function GET(
  request: NextRequest
) {
  try {
    const authResult = await requirePosAuth(request);
    if (!authResult.authorized) return authResult.response;

    const { searchParams } = new URL(request.url);

    const tenantId = authResult.user.tenantId;
    const locationId = searchParams.get('location_id');
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));

    // Get recent inventory logs with inventory info
    const logs = await prisma.inventory_log.findMany({
      where: {
        tenant_id: tenantId,
        ...(locationId && {
          inventory: {
            location_id: locationId,
          },
        }),
      },
      include: {
        inventory: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    // Get actor names
    const actorIds = [...new Set(logs.map(l => l.actor_id).filter(Boolean))] as string[];
    const actors = actorIds.length > 0 
      ? await prisma.employees.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true },
        })
      : [];
    const actorMap = new Map(actors.map(a => [a.id, a.name]));

    // Transform to response format
    const movements: RecentMovement[] = logs.map((log) => ({
      id: log.id,
      timestamp: log.created_at.toISOString(),
      type: log.movement_type as KardexMovementType,
      quantity: Number(log.quantity),
      inventoryCode: log.inventory.code,
      inventoryName: log.inventory.name,
      actorName: log.actor_id ? (actorMap.get(log.actor_id) || 'Desconocido') : 'Sistema',
    }));

    return NextResponse.json({ movements });
  } catch (error) {
    logger.error('Error al obtener movimientos recientes', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
