// src/app/api/inventory/kardex/[code]/route.ts
// API para historial de movimientos (Kardex)
// Task 1.4 - Inventory UI Spec

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/src/core/db/prisma';

export type KardexMovementType = 'IN' | 'OUT' | 'WASTE' | 'ADJUST';

export interface KardexEntry {
  id: string;
  timestamp: string;
  type: KardexMovementType;
  quantity: number;
  balance: number;
  reference: string;
  actorName: string;
  notes: string | null;
  lotNumber: string | null;
}

export interface KardexSummary {
  totalIn: number;
  totalOut: number;
  totalWaste: number;
  periodStart: string;
  periodEnd: string;
}

export interface KardexResponse {
  entries: KardexEntry[];
  summary: KardexSummary;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

/**
 * GET /api/inventory/kardex/:code
 * 
 * Query params:
 * - tenant_id: string (requerido)
 * - page: number (default 1)
 * - page_size: number (default 50, max 100)
 * - start_date: string YYYY-MM-DD (opcional)
 * - end_date: string YYYY-MM-DD (opcional)
 * - type: IN|OUT|WASTE|ADJUST (opcional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse<KardexResponse | { error: string }>> {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    
    const tenantId = searchParams.get('tenant_id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '50')));
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const typeFilter = searchParams.get('type') as KardexMovementType | null;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Se requiere tenant_id' },
        { status: 400 }
      );
    }

    // Find inventory item
    const inventory = await prisma.inventory.findFirst({
      where: {
        tenant_id: tenantId,
        code: code,
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: 'Insumo no encontrado' },
        { status: 404 }
      );
    }

    // Build date filter
    const dateFilter: { created_at?: { gte?: Date; lte?: Date } } = {};
    if (startDate || endDate) {
      dateFilter.created_at = {};
      if (startDate) {
        dateFilter.created_at.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.created_at.lte = end;
      }
    }

    // Build type filter
    const typeFilterClause = typeFilter ? { movement_type: typeFilter } : {};

    // Get total count
    const total = await prisma.inventory_log.count({
      where: {
        tenant_id: tenantId,
        inventory_id: inventory.id,
        ...dateFilter,
        ...typeFilterClause,
      },
    });

    // Get paginated logs (ordered by date DESC for display)
    const logs = await prisma.inventory_log.findMany({
      where: {
        tenant_id: tenantId,
        inventory_id: inventory.id,
        ...dateFilter,
        ...typeFilterClause,
      },
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Get all logs for balance calculation (ordered ASC)
    const allLogs = await prisma.inventory_log.findMany({
      where: {
        tenant_id: tenantId,
        inventory_id: inventory.id,
      },
      orderBy: { created_at: 'asc' },
    });

    // Calculate running balances
    const balanceMap = new Map<string, number>();
    let runningBalance = 0;
    for (const log of allLogs) {
      runningBalance += Number(log.quantity);
      balanceMap.set(log.id, runningBalance);
    }

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
    const entries: KardexEntry[] = logs.map((log) => ({
      id: log.id,
      timestamp: log.created_at.toISOString(),
      type: log.movement_type as KardexMovementType,
      quantity: Number(log.quantity),
      balance: balanceMap.get(log.id) || 0,
      reference: log.reference_id || '-',
      actorName: log.actor_id ? (actorMap.get(log.actor_id) || 'Desconocido') : 'Sistema',
      notes: log.reason,
      lotNumber: null, // Could be extracted from reason if needed
    }));

    // Calculate summary for the filtered period
    const filteredLogs = allLogs.filter(log => {
      if (startDate && log.created_at < new Date(startDate)) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (log.created_at > end) return false;
      }
      return true;
    });

    const summary: KardexSummary = {
      totalIn: filteredLogs
        .filter(l => l.movement_type === 'IN')
        .reduce((acc, l) => acc + Number(l.quantity), 0),
      totalOut: filteredLogs
        .filter(l => l.movement_type === 'OUT')
        .reduce((acc, l) => acc + Math.abs(Number(l.quantity)), 0),
      totalWaste: filteredLogs
        .filter(l => l.movement_type === 'WASTE')
        .reduce((acc, l) => acc + Math.abs(Number(l.quantity)), 0),
      periodStart: startDate || (allLogs[0]?.created_at.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]),
      periodEnd: endDate || new Date().toISOString().split('T')[0],
    };

    return NextResponse.json({
      entries,
      summary,
      pagination: {
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching kardex:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
