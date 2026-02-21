/**
 * Purchases Service
 *
 * Manages purchase orders lifecycle: DRAFT → CONFIRMED → RECEIVED.
 * All amounts in centavos (integer).
 *
 * @module core/services/purchases.service
 */

import type { PrismaClient } from '@prisma/client';
import { ok, err, type Result, DomainError, ValidationError, NotFoundError } from '@/src/core/result';

// ============================================================================
// Types
// ============================================================================

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  locationId: string;
  supplierId: string;
  supplierName?: string;
  orderNumber: number;
  status: PurchaseOrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  expectedDeliveryDate: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  inventoryCode: string;
  quantityOrdered: number;
  unit: string;
  unitCostCents: number;
  totalCents: number;
}

export type PurchaseOrderStatus = 'DRAFT' | 'CONFIRMED' | 'RECEIVED' | 'CANCELLED';

export interface CreatePurchaseOrderInput {
  tenantId: string;
  locationId: string;
  supplierId: string;
  items: {
    inventoryCode: string;
    quantityOrdered: number;
    unit: string;
    unitCostCents: number;
  }[];
  expectedDeliveryDate?: string;
  notes?: string;
  createdBy: string;
}

export interface PurchaseFilters {
  status?: PurchaseOrderStatus;
  supplierId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PurchaseSummary {
  totalOrders: number;
  totalSpentCents: number;
  bySupplier: { supplierId: string; supplierName: string; totalCents: number; orderCount: number }[];
  byStatus: { status: string; count: number }[];
}

// ============================================================================
// Valid transitions
// ============================================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

// ============================================================================
// Service
// ============================================================================

export class PurchasesService {
  constructor(private prisma: PrismaClient) {}

  async createPurchaseOrder(
    input: CreatePurchaseOrderInput,
  ): Promise<Result<PurchaseOrder, DomainError>> {
    if (!input.items.length) {
      return err(new ValidationError('La orden debe tener al menos un ítem', 'items'));
    }

    for (const item of input.items) {
      if (item.quantityOrdered <= 0) {
        return err(new ValidationError('La cantidad debe ser mayor a 0', 'quantityOrdered'));
      }
      if (item.unitCostCents < 0) {
        return err(new ValidationError('El costo unitario no puede ser negativo', 'unitCostCents'));
      }
    }

    // Get next order number
    const lastOrder = await (this.prisma as any).purchase_orders.findFirst({
      where: { tenant_id: input.tenantId, location_id: input.locationId },
      orderBy: { order_number: 'desc' },
      select: { order_number: true },
    });
    const orderNumber = (lastOrder?.order_number ?? 0) + 1;

    const itemsWithTotals = input.items.map((item) => ({
      ...item,
      totalCents: Math.round(item.quantityOrdered * item.unitCostCents),
    }));

    const subtotalCents = itemsWithTotals.reduce((sum, i) => sum + i.totalCents, 0);
    const taxCents = Math.round(subtotalCents * 0.18); // IGV 18%
    const totalCents = subtotalCents + taxCents;

    const poId = crypto.randomUUID();

    const po = await (this.prisma as any).purchase_orders.create({
      data: {
        id: poId,
        tenant_id: input.tenantId,
        location_id: input.locationId,
        supplier_id: input.supplierId,
        order_number: orderNumber,
        status: 'DRAFT',
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        expected_delivery_date: input.expectedDeliveryDate
          ? new Date(input.expectedDeliveryDate)
          : null,
        notes: input.notes ?? null,
        created_by: input.createdBy,
        purchase_order_items: {
          create: itemsWithTotals.map((item) => ({
            id: crypto.randomUUID(),
            inventory_code: item.inventoryCode,
            quantity_ordered: item.quantityOrdered,
            unit: item.unit,
            unit_cost_cents: item.unitCostCents,
            total_cents: item.totalCents,
          })),
        },
      },
      include: { purchase_order_items: true, suppliers: true },
    });

    return ok(this.mapPurchaseOrder(po));
  }

  async updatePOStatus(
    tenantId: string,
    poId: string,
    newStatus: PurchaseOrderStatus,
  ): Promise<Result<void, DomainError>> {
    const po = await (this.prisma as any).purchase_orders.findFirst({
      where: { id: poId, tenant_id: tenantId },
    });

    if (!po) {
      return err(new NotFoundError('purchase_order', poId));
    }

    const allowed = VALID_TRANSITIONS[po.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return err(
        new ValidationError(
          `No se puede cambiar de ${po.status} a ${newStatus}`,
          'status',
        ),
      );
    }

    await (this.prisma as any).purchase_orders.update({
      where: { id: poId },
      data: { status: newStatus, updated_at: new Date() },
    });

    return ok(undefined);
  }

  async getPurchaseOrders(
    tenantId: string,
    locationId: string,
    filters?: PurchaseFilters,
  ): Promise<Result<PurchaseOrder[], DomainError>> {
    const where: any = { tenant_id: tenantId, location_id: locationId };

    if (filters?.status) where.status = filters.status;
    if (filters?.supplierId) where.supplier_id = filters.supplierId;
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }

    const orders = await (this.prisma as any).purchase_orders.findMany({
      where,
      include: { purchase_order_items: true, suppliers: true },
      orderBy: { created_at: 'desc' },
    });

    return ok(orders.map((po: any) => this.mapPurchaseOrder(po)));
  }

  async getPurchaseSummary(
    tenantId: string,
    locationId: string,
    period: { start: Date; end: Date },
  ): Promise<Result<PurchaseSummary, DomainError>> {
    const orders = await (this.prisma as any).purchase_orders.findMany({
      where: {
        tenant_id: tenantId,
        location_id: locationId,
        created_at: { gte: period.start, lte: period.end },
        status: { not: 'CANCELLED' },
      },
      include: { suppliers: true },
    });

    const bySupplierMap = new Map<
      string,
      { supplierId: string; supplierName: string; totalCents: number; orderCount: number }
    >();
    const byStatusMap = new Map<string, number>();

    for (const po of orders) {
      // By supplier
      const existing = bySupplierMap.get(po.supplier_id);
      if (existing) {
        existing.totalCents += po.total_cents;
        existing.orderCount += 1;
      } else {
        bySupplierMap.set(po.supplier_id, {
          supplierId: po.supplier_id,
          supplierName: po.suppliers?.name ?? 'Desconocido',
          totalCents: po.total_cents,
          orderCount: 1,
        });
      }

      // By status
      byStatusMap.set(po.status, (byStatusMap.get(po.status) ?? 0) + 1);
    }

    return ok({
      totalOrders: orders.length,
      totalSpentCents: orders.reduce((sum: number, po: any) => sum + po.total_cents, 0),
      bySupplier: Array.from(bySupplierMap.values()).sort(
        (a, b) => b.totalCents - a.totalCents,
      ),
      byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({
        status,
        count,
      })),
    });
  }

  private mapPurchaseOrder(po: any): PurchaseOrder {
    return {
      id: po.id,
      tenantId: po.tenant_id,
      locationId: po.location_id,
      supplierId: po.supplier_id,
      supplierName: po.suppliers?.name,
      orderNumber: po.order_number,
      status: po.status,
      subtotalCents: po.subtotal_cents,
      taxCents: po.tax_cents,
      totalCents: po.total_cents,
      expectedDeliveryDate: po.expected_delivery_date?.toISOString().split('T')[0] ?? null,
      notes: po.notes,
      createdBy: po.created_by,
      createdAt: po.created_at.toISOString(),
      updatedAt: po.updated_at.toISOString(),
      items: (po.purchase_order_items ?? []).map((item: any) => ({
        id: item.id,
        inventoryCode: item.inventory_code,
        quantityOrdered: Number(item.quantity_ordered),
        unit: item.unit,
        unitCostCents: item.unit_cost_cents,
        totalCents: item.total_cents,
      })),
    };
  }
}
