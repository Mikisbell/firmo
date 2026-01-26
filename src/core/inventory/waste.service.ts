// src/core/inventory/waste.service.ts
// Waste Log Service - Schema Completeness Fase 4
import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { unsafeCentavos, type Centavos } from "@/src/core/types/shared";

export type WasteReasonCode =
  | "EXPIRED"
  | "DAMAGED"
  | "THEFT"
  | "PRODUCTION_LOSS"
  | "REJECTED_ON_RECEIPT"
  | "COUNT_ADJUSTMENT"
  | "OTHER";

export interface RecordWasteInput {
  tenant_id: string;
  location_id: string;
  shift_id?: string;
  inventory_code: string;
  quantity: number;
  unit: string;
  reason_code: WasteReasonCode;
  reason_detail?: string;
  reported_by: string;
  photo_url?: string;
  reference_type?: "GOODS_RECEIPT" | "INVENTORY_COUNT" | "MANUAL";
  reference_id?: string;
}

export interface RecordWasteResult {
  success: boolean;
  waste_log_id?: string;
  cost_cents?: Centavos;
  error?: string;
}

/**
 * Records waste and creates corresponding inventory movement
 * 
 * 1. Creates WasteLog record
 * 2. Creates InventoryLog with movement_type='WASTE'
 * 3. Decrements Inventory.stock
 */
export async function recordWaste(
  prisma: PrismaClient,
  input: RecordWasteInput
): Promise<RecordWasteResult> {
  const {
    tenant_id,
    location_id,
    shift_id,
    inventory_code,
    quantity,
    unit,
    reason_code,
    reason_detail,
    reported_by,
    photo_url,
    reference_type,
    reference_id,
  } = input;

  try {
    // 1. Find inventory to get cost
    const inventory = await prisma.inventory.findFirst({
      where: { tenant_id, code: inventory_code },
    });

    if (!inventory) {
      return { success: false, error: `Inventory not found: ${inventory_code}` };
    }

    const cost_cents = unsafeCentavos(Math.round(quantity * (inventory.cost_cents || 0)));

    // 2. Create waste log and update inventory in transaction
    const result = await prisma.$transaction(async (tx: any) => {
      // Create WasteLog
      const wasteLog = await tx.waste_logs.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id,
          location_id,
          shift_id,
          inventory_code,
          quantity: new Decimal(quantity),
          unit,
          reason_code,
          reason_detail,
          cost_cents,
          reported_by,
          photo_url,
          reference_type,
          reference_id,
        },
      });

      // Create InventoryLog
      await tx.inventory_log.create({
        data: {
          id: crypto.randomUUID(),
          tenant_id,
          inventory_id: inventory.id,
          movement_type: "WASTE",
          quantity: new Decimal(-quantity),
          reference_id: wasteLog.id,
          reason: `Merma: ${reason_code}${reason_detail ? ` - ${reason_detail}` : ""}`,
        },
      });

      // Decrement stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          stock: { decrement: quantity },
          theoretical_stock: { decrement: quantity },
          updated_at: new Date(),
        },
      });

      return wasteLog;
    });

    return { success: true, waste_log_id: result.id, cost_cents };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Gets waste summary for a period
 */
export async function getWasteSummary(
  prisma: PrismaClient,
  tenant_id: string,
  location_id: string,
  from_date: Date,
  to_date: Date
): Promise<{
  total_cost_cents: Centavos;
  by_reason: Record<WasteReasonCode, { count: number; cost_cents: Centavos }>;
  top_items: Array<{ inventory_code: string; quantity: number; cost_cents: Centavos }>;
}> {
  const wasteLogs = await prisma.waste_logs.findMany({
    where: {
      tenant_id,
      location_id,
      created_at: { gte: from_date, lte: to_date },
    },
  });

  const by_reason: Record<string, { count: number; cost_cents: Centavos }> = {};
  const by_item: Record<string, { quantity: number; cost_cents: Centavos }> = {};
  let total_cost_cents = 0;

  for (const log of wasteLogs) {
    total_cost_cents += log.cost_cents;

    // By reason
    if (!by_reason[log.reason_code]) {
      by_reason[log.reason_code] = { count: 0, cost_cents: unsafeCentavos(0) };
    }
    by_reason[log.reason_code].count++;
    by_reason[log.reason_code].cost_cents = unsafeCentavos(by_reason[log.reason_code].cost_cents + log.cost_cents);

    // By item
    if (!by_item[log.inventory_code]) {
      by_item[log.inventory_code] = { quantity: 0, cost_cents: unsafeCentavos(0) };
    }
    by_item[log.inventory_code].quantity += Number(log.quantity);
    by_item[log.inventory_code].cost_cents = unsafeCentavos(by_item[log.inventory_code].cost_cents + log.cost_cents);
  }

  // Top items by cost
  const top_items = Object.entries(by_item)
    .map(([inventory_code, data]) => ({ inventory_code, ...data }))
    .sort((a, b) => b.cost_cents - a.cost_cents)
    .slice(0, 10);

  return {
    total_cost_cents: unsafeCentavos(total_cost_cents),
    by_reason: by_reason as Record<WasteReasonCode, { count: number; cost_cents: Centavos }>,
    top_items,
  };
}
