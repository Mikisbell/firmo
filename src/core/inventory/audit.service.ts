/**
 * Inventory Audit Service
 * 
 * Logs all inventory operations for compliance and traceability.
 * Requirements: 5.9, 7.4 - Audit logging for inventory operations
 * 
 * @module audit.service
 */

import prisma from '@/src/core/db/prisma';
import type { Centavos } from '@/src/core/types/shared';

export type InventoryAuditAction = 
  | 'GOODS_RECEIVED'
  | 'WASTE_RECORDED'
  | 'INVENTORY_ADJUSTED'
  | 'STOCK_VIEWED'
  | 'KARDEX_VIEWED'
  | 'DEDUCTION_RECORDED';

export interface AuditLogEntry {
  tenant_id: string;
  actor_id: string;
  action: InventoryAuditAction;
  resource_type: 'inventory' | 'goods_receipt' | 'waste' | 'inventory_log';
  resource_id?: string;
  endpoint: string;
  ip_address?: string;
  user_agent?: string;
  terminal_id?: string;
  payload?: Record<string, unknown>;
  result: 'SUCCESS' | 'FAILURE';
  error_message?: string;
}

/**
 * Log an inventory operation
 */
export async function logInventoryAudit(entry: AuditLogEntry): Promise<string> {
  const log = await prisma.admin_access_logs.create({
    data: {
      id: crypto.randomUUID(),
      tenant_id: entry.tenant_id,
      employee_id: entry.actor_id,
      action: entry.action,
      resource: `${entry.resource_type}${entry.resource_id ? `:${entry.resource_id}` : ''}`,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      terminal_id: entry.terminal_id,
      metadata: {
        endpoint: entry.endpoint,
        payload: entry.payload ? JSON.parse(JSON.stringify(entry.payload)) : null,
        result: entry.result,
        error: entry.error_message || null,
      },
    },
  });

  return log.id;
}

/**
 * Log goods receipt operation
 */
export async function logGoodsReceipt(
  tenantId: string,
  actorId: string,
  goodsReceiptId: string,
  payload: {
    inventory_code: string;
    quantity: number;
    unit_cost_cents: Centavos;
    supplier_id?: string;
    invoice_number?: string;
  },
  metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<string> {
  return logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: 'GOODS_RECEIVED',
    resource_type: 'goods_receipt',
    resource_id: goodsReceiptId,
    endpoint: '/api/inventory/receive',
    ip_address: metadata?.ip,
    user_agent: metadata?.userAgent,
    terminal_id: metadata?.terminalId,
    payload,
    result: 'SUCCESS',
  });
}

/**
 * Log waste recording operation
 */
export async function logWasteRecorded(
  tenantId: string,
  actorId: string,
  wasteId: string,
  payload: {
    inventory_code: string;
    quantity: number;
    reason_code: string;
    cost_cents: Centavos;
  },
  metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<string> {
  return logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: 'WASTE_RECORDED',
    resource_type: 'waste',
    resource_id: wasteId,
    endpoint: '/api/inventory/waste',
    ip_address: metadata?.ip,
    user_agent: metadata?.userAgent,
    terminal_id: metadata?.terminalId,
    payload,
    result: 'SUCCESS',
  });
}

/**
 * Log inventory adjustment
 */
export async function logInventoryAdjustment(
  tenantId: string,
  actorId: string,
  inventoryId: string,
  payload: {
    inventory_code: string;
    old_stock: number;
    new_stock: number;
    reason: string;
  },
  metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<string> {
  return logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action: 'INVENTORY_ADJUSTED',
    resource_type: 'inventory',
    resource_id: inventoryId,
    endpoint: '/api/inventory/adjust',
    ip_address: metadata?.ip,
    user_agent: metadata?.userAgent,
    terminal_id: metadata?.terminalId,
    payload,
    result: 'SUCCESS',
  });
}

/**
 * Log failed operation
 */
export async function logInventoryFailure(
  tenantId: string,
  actorId: string,
  action: InventoryAuditAction,
  endpoint: string,
  errorMessage: string,
  payload?: Record<string, unknown>,
  metadata?: { ip?: string; userAgent?: string; terminalId?: string }
): Promise<string> {
  return logInventoryAudit({
    tenant_id: tenantId,
    actor_id: actorId,
    action,
    resource_type: 'inventory',
    endpoint,
    ip_address: metadata?.ip,
    user_agent: metadata?.userAgent,
    terminal_id: metadata?.terminalId,
    payload,
    result: 'FAILURE',
    error_message: errorMessage,
  });
}

/**
 * Get audit logs for a tenant
 */
export async function getInventoryAuditLogs(
  tenantId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    actorId?: string;
    action?: InventoryAuditAction;
    limit?: number;
    offset?: number;
  }
): Promise<{
  logs: Array<{
    id: string;
    action: string;
    resource: string | null;
    actor_id: string;
    created_at: Date;
    metadata: unknown;
  }>;
  total: number;
}> {
  const where = {
    tenant_id: tenantId,
    ...(options?.startDate && { created_at: { gte: options.startDate } }),
    ...(options?.endDate && { created_at: { lte: options.endDate } }),
    ...(options?.actorId && { employee_id: options.actorId }),
    ...(options?.action && { action: options.action }),
  };

  const [logs, total] = await Promise.all([
    prisma.admin_access_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      select: {
        id: true,
        action: true,
        resource: true,
        employee_id: true,
        created_at: true,
        metadata: true,
      },
    }),
    prisma.admin_access_logs.count({ where }),
  ]);

  return {
    logs: logs.map(log => ({
      id: log.id,
      action: log.action,
      resource: log.resource,
      actor_id: log.employee_id,
      created_at: log.created_at,
      metadata: log.metadata,
    })),
    total,
  };
}
