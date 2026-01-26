// src/core/inventory/goods-receipt.service.ts
// Goods Receipt Service - Schema Completeness Fase 3
import { PrismaClient, Prisma } from "@prisma/client";
import type { Centavos } from "@/src/core/types/shared";

export interface GoodsReceiptItemInput {
  inventory_code: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_rejected?: number;
  rejection_reason?: string;
  unit_cost_cents: Centavos;
  lot_number?: string;
  expiry_date?: string; // YYYY-MM-DD
}

export interface ConfirmGoodsReceiptInput {
  tenant_id: string;
  location_id: string;
  goods_receipt_id: string;
  received_by: string;
}

export interface ConfirmGoodsReceiptResult {
  success: boolean;
  inventory_logs_created: number;
  waste_logs_created: number;
  errors: string[];
}

/**
 * Confirms a goods receipt and updates inventory
 * 
 * For each item:
 * 1. Creates InventoryLog with movement_type='IN' for quantity_received
 * 2. Updates Inventory.stock
 * 3. If quantity_rejected > 0, creates WasteLog with reason_code='REJECTED_ON_RECEIPT'
 */
export async function confirmGoodsReceipt(
  prisma: PrismaClient,
  input: ConfirmGoodsReceiptInput
): Promise<ConfirmGoodsReceiptResult> {
  const { tenant_id, location_id, goods_receipt_id, received_by } = input;
  const errors: string[] = [];
  let inventory_logs_created = 0;
  let waste_logs_created = 0;

  try {
    // 1. Get the goods receipt with items
    const receipt = await prisma.goods_receipts.findUnique({
      where: { id: goods_receipt_id },
      include: { goods_receipt_items: true },
    });

    if (!receipt) {
      return { success: false, inventory_logs_created: 0, waste_logs_created: 0, errors: ["Goods receipt not found"] };
    }

    if (receipt.status === "CONFIRMED") {
      return { success: false, inventory_logs_created: 0, waste_logs_created: 0, errors: ["Goods receipt already confirmed"] };
    }

    if (receipt.status === "CANCELLED") {
      return { success: false, inventory_logs_created: 0, waste_logs_created: 0, errors: ["Goods receipt is cancelled"] };
    }

    // 2. Process each item in a transaction
    await prisma.$transaction(async (tx: any) => {
      for (const item of receipt.goods_receipt_items) {
        const quantityReceived = Number(item.quantity_received);
        const quantityRejected = Number(item.quantity_rejected);

        // 2a. Find or create inventory record
        let inventory = await tx.inventory.findFirst({
          where: {
            tenant_id,
            code: item.inventory_code,
          },
        });

        if (!inventory) {
          // Create inventory record if it doesn't exist
          inventory = await tx.inventory.create({
            data: {
              id: crypto.randomUUID(),
              tenant_id,
              code: item.inventory_code,
              name: item.inventory_code, // Default name
              unit: "UND",
              stock: new Prisma.Decimal(0),
              location_id,
              theoretical_stock: new Prisma.Decimal(0),
            },
          });
        }

        // 2b. Create InventoryLog for received quantity
        if (quantityReceived > 0) {
          await tx.inventory_log.create({
            data: {
              id: crypto.randomUUID(),
              tenant_id,
              inventory_id: inventory.id,
              movement_type: "IN",
              quantity: new Prisma.Decimal(quantityReceived),
              reference_id: goods_receipt_id,
              reason: `Recepción: ${receipt.receipt_number}`,
            },
          });
          inventory_logs_created++;

          // 2c. Update inventory stock
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              stock: { increment: quantityReceived },
              theoretical_stock: { increment: quantityReceived },
              updated_at: new Date(),
            },
          });
        }

        // 2d. Create WasteLog for rejected quantity
        if (quantityRejected > 0) {
          await tx.waste_logs.create({
            data: {
              id: crypto.randomUUID(),
              tenant_id,
              location_id,
              inventory_code: item.inventory_code,
              quantity: new Prisma.Decimal(quantityRejected),
              unit: "UND",
              reason_code: "REJECTED_ON_RECEIPT",
              reason_detail: item.rejection_reason,
              cost_cents: item.unit_cost_cents * quantityRejected,
              reported_by: received_by,
              reference_type: "GOODS_RECEIPT",
              reference_id: goods_receipt_id,
            },
          });
          waste_logs_created++;

          // Also create InventoryLog for waste tracking
          await tx.inventory_log.create({
            data: {
              id: crypto.randomUUID(),
              tenant_id,
              inventory_id: inventory.id,
              movement_type: "WASTE",
              quantity: new Prisma.Decimal(-quantityRejected),
              reference_id: goods_receipt_id,
              reason: `Rechazado en recepción: ${item.rejection_reason || "Sin razón"}`,
            },
          });
        }
      }

      // 3. Update goods receipt status
      await tx.goods_receipts.update({
        where: { id: goods_receipt_id },
        data: {
          status: "CONFIRMED",
          received_at: new Date(),
        },
      });

      // 4. Update purchase order status if linked
      if (receipt.purchase_order_id) {
        // Check if all items are received
        const po = await tx.purchase_orders.findUnique({
          where: { id: receipt.purchase_order_id },
          include: { goods_receipts: { include: { goods_receipt_items: true } } },
        });

        if (po) {
          // Simple logic: if this receipt exists, mark as at least PARTIAL_RECEIVED
          const newStatus = po.status === "SENT" ? "PARTIAL_RECEIVED" : po.status;
          if (newStatus !== po.status) {
            await tx.purchase_orders.update({
              where: { id: receipt.purchase_order_id },
              data: { status: newStatus, updated_at: new Date() },
            });
          }
        }
      }
    });

    return { success: true, inventory_logs_created, waste_logs_created, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, inventory_logs_created: 0, waste_logs_created: 0, errors: [message] };
  }
}

/**
 * Creates a new goods receipt (draft)
 */
export async function createGoodsReceipt(
  prisma: PrismaClient,
  input: {
    tenant_id: string;
    location_id: string;
    purchase_order_id?: string;
    receipt_number: string;
    received_by: string;
    items: GoodsReceiptItemInput[];
    notes?: string;
  }
): Promise<{ success: boolean; goods_receipt_id?: string; error?: string }> {
  try {
    const receipt = await prisma.goods_receipts.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: input.tenant_id,
        location_id: input.location_id,
        purchase_order_id: input.purchase_order_id,
        receipt_number: input.receipt_number,
        received_by: input.received_by,
        status: "DRAFT",
        notes: input.notes,
        goods_receipt_items: {
          create: input.items.map((item) => ({
            id: crypto.randomUUID(),
            inventory_code: item.inventory_code,
            quantity_ordered: new Prisma.Decimal(item.quantity_ordered),
            quantity_received: new Prisma.Decimal(item.quantity_received),
            quantity_rejected: new Prisma.Decimal(item.quantity_rejected || 0),
            rejection_reason: item.rejection_reason,
            unit_cost_cents: item.unit_cost_cents,
            lot_number: item.lot_number,
            expiry_date: item.expiry_date ? new Date(item.expiry_date) : null,
          })),
        },
      },
    });

    return { success: true, goods_receipt_id: receipt.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
