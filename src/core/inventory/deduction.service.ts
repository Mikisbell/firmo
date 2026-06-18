// src/core/inventory/deduction.service.ts
// Inventory Deduction Service - Schema Completeness Fase 5
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from "@prisma/client";
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
  // Datos del insumo embebidos para que el caller dispare la notificación push
  // post-commit SIN re-consultar la DB (evita queries dentro de la transacción).
  inventory_name: string;
  unit: string;
}

export interface DeductionResult {
  success: boolean;
  deductions: DeductionIngredient[];
  alerts: DeductionAlert[];
  // product_id si la deducción dejó algún insumo en stock <= 0. El caller debe
  // ejecutar el Auto-86 (ProductAvailabilityService.autoCheckAvailability)
  // DESPUÉS del commit de la transacción externa, usando el prisma global.
  // Es null cuando no hay que reevaluar disponibilidad.
  productIdToReevaluate: string | null;
  error?: string;
}

export interface RecipeIngredient {
  inventory_code: string;
  quantity: number;
  unit: string;
  is_optional?: boolean;
}

/**
 * Deduce inventario para un producto vendido según su receta.
 *
 * 1. Busca la receta del producto
 * 2. Por cada ingrediente, calcula la cantidad a deducir (recipe.qty * order_qty)
 * 3. Pre-chequea stock disponible (C3: evita stock negativo)
 * 4. Crea InventoryLog con movement_type='OUT'
 * 5. Actualiza Inventory.stock y theoretical_stock
 * 6. Genera alertas si stock < min_stock o stock < 0
 *
 * IMPORTANTE (perf): esta función corre TODAS sus operaciones DB sobre el
 * `tx` recibido — NO abre su propia transacción. Antes abría una transacción
 * anidada (prisma.$transaction) que pedía una segunda conexión del pool
 * mientras la transacción externa retenía la suya → starvation del pool de
 * Supabase/pgbouncer y esperas de segundos. Al usar el `tx` del caller la
 * deducción es atómica con la proyección del evento: si el evento revierte,
 * el stock revierte.
 *
 * Los EFECTOS SECUNDARIOS (push notifications de stock bajo y Auto-86) NO se
 * ejecutan aquí — se devuelven en el resultado (alerts + productIdToReevaluate)
 * para que el caller los dispare DESPUÉS del commit con el prisma global.
 *
 * @param tx - Cliente de transacción del caller (Prisma.TransactionClient).
 * @param allowNegative - Si es true, omite el pre-chequeo (override admin). Default: false.
 */
export async function deductInventoryForOrder(
  tx: Prisma.TransactionClient,
  tenantId: string,
  locationId: string,
  orderId: string,
  lineId: string,
  productId: string,
  quantity: number,
  allowNegative: boolean = false
): Promise<DeductionResult> {
  const deductions: DeductionIngredient[] = [];
  const alerts: DeductionAlert[] = [];

  try {
    // 1. Busca la receta del producto
    const recipe = await tx.recipes.findUnique({
      where: {
        tenant_id_product_id: {
          tenant_id: tenantId,
          product_id: productId,
        },
      },
    });

    // Sin receta = no hay deducción (ej: ítems de servicio)
    if (!recipe || !recipe.is_active) {
      return { success: true, deductions: [], alerts: [], productIdToReevaluate: null };
    }

    // Parsea los ingredientes del JSON
    const ingredients = recipe.ingredients as unknown as RecipeIngredient[];
    if (!ingredients || ingredients.length === 0) {
      return { success: true, deductions: [], alerts: [], productIdToReevaluate: null };
    }

    // 2. Procesa cada ingrediente sobre el tx del caller (sin transacción anidada)
    for (const ingredient of ingredients) {
      // Omite ingredientes opcionales por ahora
      if (ingredient.is_optional) continue;

      const deductQty = ingredient.quantity * quantity;

      // 3. Busca el registro de inventario
      const inventory = await tx.inventory.findFirst({
        where: {
          tenant_id: tenantId,
          code: ingredient.inventory_code,
        },
      });

      if (!inventory) {
        // Loguea warning pero no falla — el insumo puede no estar trackeado
        logger.warn('INVENTORY_NOT_FOUND', 'Inventory not found for deduction', { code: ingredient.inventory_code });
        continue;
      }

      // Datos del insumo para embeber en alertas (evita re-query post-commit)
      const inventoryName = inventory.name ?? ingredient.inventory_code;
      const inventoryUnit = inventory.unit ?? 'unidades';

      // C3: Pre-chequeo de stock disponible antes de deducir
      const currentStock = Number(inventory.stock);
      if (!allowNegative && currentStock < deductQty) {
        const errorMsg = `INSUFFICIENT_STOCK: ${ingredient.inventory_code} tiene ${currentStock}, necesita ${deductQty}`;
        logger.warn('INSUFFICIENT_STOCK', errorMsg, {
          inventory_code: ingredient.inventory_code,
          current_stock: currentStock,
          required: deductQty,
          order_id: orderId,
          line_id: lineId,
        });

        // Crea log DEDUCTION_FAILED para reconciliación (H5 prep)
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id: tenantId,
            inventory_id: inventory.id,
            movement_type: "DEDUCTION_FAILED",
            quantity: new Decimal(-deductQty),
            reference_id: orderId,
            reason: errorMsg,
          },
        });

        alerts.push({
          type: "NEGATIVE_STOCK",
          inventory_code: ingredient.inventory_code,
          current_stock: currentStock,
          inventory_name: inventoryName,
          unit: inventoryUnit,
        });

        throw new Error(errorMsg);
      }

      // 4. Actualiza el stock
      const updatedInventory = await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          stock: { decrement: deductQty },
          theoretical_stock: { decrement: deductQty },
          updated_at: new Date(),
        },
      });

      const newStock = Number(updatedInventory.stock);

      // 5. Crea el InventoryLog
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

      // 6. Verifica alertas
      if (newStock < 0) {
        alerts.push({
          type: "NEGATIVE_STOCK",
          inventory_code: ingredient.inventory_code,
          current_stock: newStock,
          inventory_name: inventoryName,
          unit: inventoryUnit,
        });

        // Crea la alerta de stock en la DB
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
          inventory_name: inventoryName,
          unit: inventoryUnit,
        });

        // Crea la alerta de stock en la DB
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

    // H4: Auto-86 — si algún insumo llegó a stock <= 0, hay que reevaluar la
    // disponibilidad del producto. NO lo hacemos aquí (correría queries dentro
    // de la transacción); devolvemos el product_id para que el caller dispare
    // ProductAvailabilityService.autoCheckAvailability post-commit.
    const hasStockOut = deductions.some((d) => d.new_stock <= 0);
    const productIdToReevaluate = hasStockOut ? productId : null;

    return { success: true, deductions, alerts, productIdToReevaluate };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, deductions: [], alerts: [], productIdToReevaluate: null, error: message };
  }
}

/**
 * Deducción batch para varios ítems de una orden.
 *
 * Corre sobre el `tx` recibido — todas las deducciones comparten la misma
 * transacción del caller (sin transacciones anidadas).
 */
export async function deductInventoryForOrderItems(
  tx: Prisma.TransactionClient,
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
      tx,
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
 * Reversa una deducción (ej: para ítems anulados).
 *
 * Corre sobre el `tx` recibido — NO abre transacción anidada. La reversa es
 * atómica con la proyección del evento de anulación.
 */
export async function reverseDeduction(
  tx: Prisma.TransactionClient,
  tenantId: string,
  orderId: string,
  lineId: string,
  productId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const recipe = await tx.recipes.findUnique({
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

      // Devuelve el stock
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          stock: { increment: returnQty },
          theoretical_stock: { increment: returnQty },
          updated_at: new Date(),
        },
      });

      // Crea el log de reversión
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

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
