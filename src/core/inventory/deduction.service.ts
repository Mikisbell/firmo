// src/core/inventory/deduction.service.ts
// Inventory Deduction Service - Schema Completeness Fase 5
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, Prisma } from "@prisma/client";
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '@/src/core/observability/logger';

export interface DeductionIngredient {
  inventory_code: string;
  quantity_deducted: number;
  new_stock: number;
}

export interface DeductionAlert {
  type: "LOW_STOCK" | "NEGATIVE_STOCK";
  inventory_code: string;
  current_stock: number;
  min_stock?: number;
}

export interface DeductionResult {
  success: boolean;
  deductions: DeductionIngredient[];
  alerts: DeductionAlert[];
  error?: string;
}

export interface RecipeIngredient {
  inventory_code: string;
  quantity: number;
  unit: string;
  is_optional?: boolean;
}

/**
 * Deducts inventory for a sold product based on its recipe
 * 
 * 1. Looks up the product's recipe
 * 2. For each ingredient, calculates quantity to deduct (recipe.qty * order_qty)
 * 3. Creates InventoryLog with movement_type='OUT'
 * 4. Updates Inventory.stock and theoretical_stock
 * 5. Generates alerts if stock < min_stock or stock < 0
 */
export async function deductInventoryForOrder(
  prisma: PrismaClient,
  tenantId: string,
  locationId: string,
  orderId: string,
  lineId: string,
  productId: string,
  quantity: number
): Promise<DeductionResult> {
  const deductions: DeductionIngredient[] = [];
  const alerts: DeductionAlert[] = [];

  try {
    // 1. Find the recipe for this product
    const recipe = await prisma.recipes.findUnique({
      where: {
        tenant_id_product_id: {
          tenant_id: tenantId,
          product_id: productId,
        },
      },
    });

    // No recipe = no deduction needed (e.g., service items)
    if (!recipe || !recipe.is_active) {
      return { success: true, deductions: [], alerts: [] };
    }

    // Parse ingredients from JSON
    const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
    if (!ingredients || ingredients.length === 0) {
      return { success: true, deductions: [], alerts: [] };
    }

    // 2. Process each ingredient in a transaction
    await prisma.$transaction(async (tx: any) => {
      for (const ingredient of ingredients) {
        // Skip optional ingredients for now
        if (ingredient.is_optional) continue;

        const deductQty = ingredient.quantity * quantity;

        // 3. Find inventory record
        const inventory = await tx.inventory.findFirst({
          where: {
            tenant_id: tenantId,
            code: ingredient.inventory_code,
          },
        });

        if (!inventory) {
          // Log warning but don't fail - inventory might not be tracked
          logger.warn('INVENTORY_NOT_FOUND', 'Inventory not found for deduction', { code: ingredient.inventory_code });
          continue;
        }

        // 4. Update stock (allow negative)
        const updatedInventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: { decrement: deductQty },
            theoretical_stock: { decrement: deductQty },
            updated_at: new Date(),
          },
        });

        const newStock = Number(updatedInventory.stock);

        // 5. Create InventoryLog
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            inventory_id: inventory.id,
            movement_type: "OUT",
            quantity: new Decimal(-deductQty),
            reference_id: orderId,
            reason: `Venta: Orden ${orderId}, Item ${lineId}`,
          },
        });

        deductions.push({
          inventory_code: ingredient.inventory_code,
          quantity_deducted: deductQty,
          new_stock: newStock,
        });

        // 6. Check for alerts
        if (newStock < 0) {
          alerts.push({
            type: "NEGATIVE_STOCK",
            inventory_code: ingredient.inventory_code,
            current_stock: newStock,
          });

          // Create stock alert in database
          await tx.stock_alerts.create({
            data: {
              id: uuidv4(),
              tenant_id: tenantId,
              location_id: locationId,
              sku: ingredient.inventory_code,
              alert_type: "OUT_OF_STOCK",
              severity: "CRITICAL",
              current_qty: new Decimal(newStock),
              threshold_qty: new Decimal(0),
            },
          });
        } else if (inventory.min_stock && newStock < Number(inventory.min_stock)) {
          alerts.push({
            type: "LOW_STOCK",
            inventory_code: ingredient.inventory_code,
            current_stock: newStock,
            min_stock: Number(inventory.min_stock),
          });

          // Create stock alert in database
          await tx.stock_alerts.create({
            data: {
              id: uuidv4(),
              tenant_id: tenantId,
              location_id: locationId,
              sku: ingredient.inventory_code,
              alert_type: "LOW_STOCK",
              severity: "HIGH",
              current_qty: new Decimal(newStock),
              threshold_qty: inventory.min_stock,
            },
          });
        }
      }
    });

    return { success: true, deductions, alerts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, deductions: [], alerts: [], error: message };
  }
}

/**
 * Batch deduction for multiple items in an order
 */
export async function deductInventoryForOrderItems(
  prisma: PrismaClient,
  tenantId: string,
  locationId: string,
  orderId: string,
  items: Array<{ line_id: string; product_id: string; quantity: number }>
): Promise<{
  success: boolean;
  results: Array<{ line_id: string; result: DeductionResult }>;
}> {
  const results: Array<{ line_id: string; result: DeductionResult }> = [];

  for (const item of items) {
    const result = await deductInventoryForOrder(
      prisma,
      tenantId,
      locationId,
      orderId,
      item.line_id,
      item.product_id,
      item.quantity
    );
    results.push({ line_id: item.line_id, result });
  }

  const allSuccess = results.every((r) => r.result.success);
  return { success: allSuccess, results };
}

/**
 * Reverses a deduction (e.g., for voided items)
 */
export async function reverseDeduction(
  prisma: PrismaClient,
  tenantId: string,
  orderId: string,
  lineId: string,
  productId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const recipe = await prisma.recipes.findUnique({
      where: {
        tenant_id_product_id: {
          tenant_id: tenantId,
          product_id: productId,
        },
      },
    });

    if (!recipe || !recipe.is_active) {
      return { success: true };
    }

    const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
    if (!ingredients || ingredients.length === 0) {
      return { success: true };
    }

    await prisma.$transaction(async (tx: any) => {
      for (const ingredient of ingredients) {
        if (ingredient.is_optional) continue;

        const returnQty = ingredient.quantity * quantity;

        const inventory = await tx.inventory.findFirst({
          where: {
            tenant_id: tenantId,
            code: ingredient.inventory_code,
          },
        });

        if (!inventory) continue;

        // Return stock
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: { increment: returnQty },
            theoretical_stock: { increment: returnQty },
            updated_at: new Date(),
          },
        });

        // Create reversal log
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            inventory_id: inventory.id,
            movement_type: "ADJUST",
            quantity: new Decimal(returnQty),
            reference_id: orderId,
            reason: `Reversión: Orden ${orderId}, Item ${lineId} anulado`,
          },
        });
      }
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
