// src/core/inventory/inventory-count.service.ts
// Inventory Count Service - Schema Completeness Fase 4
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { unsafeCentavos, type Centavos } from "@/src/core/types/shared";

export type CountType = "FULL" | "PARTIAL" | "SPOT";
export type CountStatus = "IN_PROGRESS" | "PENDING_APPROVAL" | "APPROVED" | "CANCELLED";

export interface InventoryCountItemInput {
  inventory_code: string;
  counted_qty: number;
  notes?: string;
}

export interface StartCountInput {
  tenant_id: string;
  location_id: string;
  count_type: CountType;
  counted_by: string;
  inventory_codes?: string[]; // For PARTIAL/SPOT counts
}

export interface StartCountResult {
  success: boolean;
  inventory_count_id?: string;
  items_count?: number;
  error?: string;
}

export interface ApproveCountInput {
  tenant_id: string;
  inventory_count_id: string;
  approved_by: string;
}

export interface ApproveCountResult {
  success: boolean;
  adjustments_made: number;
  total_difference_cents: Centavos;
  errors: string[];
}

/**
 * Starts a new inventory count
 * 
 * 1. Creates InventoryCount record
 * 2. For each inventory item, creates InventoryCountItem with expected_qty from current stock
 */
export async function startInventoryCount(
  prisma: PrismaClient,
  input: StartCountInput
): Promise<StartCountResult> {
  const { tenant_id, location_id, count_type, counted_by, inventory_codes } = input;

  try {
    // 1. Get inventory items to count
    const whereClause: any = { tenant_id };
    if (inventory_codes && inventory_codes.length > 0) {
      whereClause.code = { in: inventory_codes };
    }

    const inventoryItems = await prisma.inventory.findMany({
      where: whereClause,
      select: { code: true, stock: true, cost_cents: true },
    });

    if (inventoryItems.length === 0) {
      return { success: false, error: "No inventory items found to count" };
    }

    // 2. Create count with items
    const count = await prisma.inventory_counts.create({
      data: {
        id: uuidv4(),
        tenant_id,
        location_id,
        count_date: new Date(),
        count_type,
        status: "IN_PROGRESS",
        counted_by,
        inventory_count_items: {
          create: inventoryItems.map((inv) => ({
            id: uuidv4(),
            inventory_code: inv.code,
            expected_qty: inv.stock,
            counted_qty: new Decimal(0), // To be filled during count
            difference_qty: new Decimal(0),
            unit_cost_cents: inv.cost_cents || 0,
            difference_value_cents: 0,
          })),
        },
      },
    });

    return {
      success: true,
      inventory_count_id: count.id,
      items_count: inventoryItems.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Updates counted quantities for items in an inventory count
 */
export async function updateCountItems(
  prisma: PrismaClient,
  inventory_count_id: string,
  items: InventoryCountItemInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const count = await prisma.inventory_counts.findUnique({
      where: { id: inventory_count_id },
    });

    if (!count) {
      return { success: false, error: "Inventory count not found" };
    }

    if (count.status !== "IN_PROGRESS") {
      return { success: false, error: `Cannot update count in status: ${count.status}` };
    }

    // Update each item
    for (const item of items) {
      const countItem = await prisma.inventory_count_items.findFirst({
        where: {
          inventory_count_id,
          inventory_code: item.inventory_code,
        },
      });

      if (countItem) {
        const expectedQty = Number(countItem.expected_qty);
        const differenceQty = item.counted_qty - expectedQty;
        const differenceValueCents = Math.round(differenceQty * countItem.unit_cost_cents);

        await prisma.inventory_count_items.update({
          where: { id: countItem.id },
          data: {
            counted_qty: new Decimal(item.counted_qty),
            difference_qty: new Decimal(differenceQty),
            difference_value_cents: differenceValueCents,
            notes: item.notes,
          },
        });
      }
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Submits count for approval
 */
export async function submitCountForApproval(
  prisma: PrismaClient,
  inventory_count_id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const count = await prisma.inventory_counts.findUnique({
      where: { id: inventory_count_id },
      include: { inventory_count_items: true },
    });

    if (!count) {
      return { success: false, error: "Inventory count not found" };
    }

    if (count.status !== "IN_PROGRESS") {
      return { success: false, error: `Cannot submit count in status: ${count.status}` };
    }

    // Validate: items with differences must have notes
    const itemsWithDifference = count.inventory_count_items.filter(
      (i) => Number(i.difference_qty) !== 0 && !i.notes
    );

    if (itemsWithDifference.length > 0) {
      return {
        success: false,
        error: `${itemsWithDifference.length} items with differences require notes`,
      };
    }

    await prisma.inventory_counts.update({
      where: { id: inventory_count_id },
      data: { status: "PENDING_APPROVAL" },
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Approves an inventory count and adjusts stock
 * 
 * 1. Updates InventoryCount status to APPROVED
 * 2. For each item with difference, creates InventoryLog ADJUST
 * 3. Updates Inventory.stock to counted_qty
 * 4. Updates Inventory.last_count_at
 */
export async function approveInventoryCount(
  prisma: PrismaClient,
  input: ApproveCountInput
): Promise<ApproveCountResult> {
  const { tenant_id, inventory_count_id, approved_by } = input;
  const errors: string[] = [];
  let adjustments_made = 0;
  let total_difference_cents = 0;

  try {
    const count = await prisma.inventory_counts.findUnique({
      where: { id: inventory_count_id },
      include: { inventory_count_items: true },
    });

    if (!count) {
      return { success: false, adjustments_made: 0, total_difference_cents: unsafeCentavos(0), errors: ["Count not found"] };
    }

    if (count.status !== "PENDING_APPROVAL") {
      return { success: false, adjustments_made: 0, total_difference_cents: unsafeCentavos(0), errors: [`Invalid status: ${count.status}`] };
    }

    await prisma.$transaction(async (tx: any) => {
      for (const item of count.inventory_count_items) {
        const differenceQty = Number(item.difference_qty);
        
        if (differenceQty === 0) continue;

        // Find inventory record
        const inventory = await tx.inventory.findFirst({
          where: { tenant_id, code: item.inventory_code },
        });

        if (!inventory) {
          errors.push(`Inventory not found: ${item.inventory_code}`);
          continue;
        }

        // Create adjustment log
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id,
            inventory_id: inventory.id,
            movement_type: "ADJUST",
            quantity: new Decimal(differenceQty),
            reference_id: inventory_count_id,
            reason: `Conteo: ${item.notes || "Ajuste por conteo físico"}`,
          },
        });

        // Update stock to counted value
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: item.counted_qty,
            last_count_at: new Date(),
            updated_at: new Date(),
          },
        });

        adjustments_made++;
        total_difference_cents += item.difference_value_cents;
      }

      // Update count status
      await tx.inventory_counts.update({
        where: { id: inventory_count_id },
        data: {
          status: "APPROVED",
          approved_by,
          approved_at: new Date(),
        },
      });
    });

    return { success: true, adjustments_made, total_difference_cents: unsafeCentavos(total_difference_cents), errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, adjustments_made: 0, total_difference_cents: unsafeCentavos(0), errors: [message] };
  }
}
