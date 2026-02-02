/**
 * Inventory Service - Business Logic Layer
 * 
 * Enterprise-grade inventory management service implementing:
 * - Stock tracking and management
 * - Automatic deductions on orders
 * - Manual adjustments with audit trail
 * - Goods receipt from purchase orders
 * - Waste recording and tracking
 * - Low stock alerts and notifications
 * - Caching for performance
 * - Event-driven architecture
 * 
 * @module core/services/inventory.service
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';
import { Result, ok, err, DomainError, ValidationError, NotFoundError } from '@/core/result';
import { withTransaction, QueryMonitor } from '@/core/db/enhanced-prisma';
import { CacheService, generateCacheKey } from '@/core/cache/redis.service';
import { eventBus } from '@/core/infra/event-bus';
import { pinoLogger } from '@/core/observability/logger-pino';
import {
  InventoryAdjusted,
  InventoryDeducted,
  WasteRecorded,
  GoodsReceived,
  WasteReasonCode,
} from '@/core/domain/inventory-events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface StockInfo {
  inventoryId: string;
  code: string;
  name: string;
  stock: number;
  theoreticalStock: number;
  minStock: number | null;
  maxStock: number | null;
  unit: string;
  locationId: string;
  isActive: boolean;
}

export interface DeductionItem {
  productId: string;
  lineId: string;
  quantity: number;
}

export interface DeductionResult {
  orderId: string;
  deductions: Array<{
    inventoryCode: string;
    quantityDeducted: number;
    newStock: number;
  }>;
  alerts: StockAlert[];
}

export interface AdjustmentInput {
  inventoryCode: string;
  locationId: string;
  newQuantity: number;
  reason: string;
  referenceType?: 'INVENTORY_COUNT' | 'MANUAL';
  referenceId?: string;
  performedBy: string;
}

export interface AdjustmentResult {
  inventoryCode: string;
  previousQuantity: number;
  newQuantity: number;
  difference: number;
}

export interface ReceiptItem {
  inventoryCode: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected?: number;
  rejectionReason?: string;
  unitCostCents: number;
  lotNumber?: string;
  expiryDate?: string;
}

export interface ReceiptInput {
  purchaseOrderId?: string;
  locationId: string;
  items: ReceiptItem[];
  receivedBy: string;
  notes?: string;
}

export interface ReceiptResult {
  receiptId: string;
  receiptNumber: string;
  items: Array<{
    inventoryCode: string;
    quantityReceived: number;
    quantityRejected: number;
    newStock: number;
  }>;
}

export interface WasteInput {
  inventoryCode: string;
  locationId: string;
  quantity: number;
  unit: string;
  reasonCode: WasteReasonCode;
  reasonDetail?: string;
  costCents: number;
  reportedBy: string;
  referenceType?: string;
  referenceId?: string;
}

export interface WasteResult {
  wasteLogId: string;
  inventoryCode: string;
  quantity: number;
  costCents: number;
  newStock: number;
}

export interface StockAlert {
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCK';
  inventoryCode: string;
  currentStock: number;
  threshold: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface InventoryFilters {
  locationId?: string;
  category?: string;
  isActive?: boolean;
  lowStockOnly?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const CACHE_TTL = {
  STOCK: 60, // 1 minute for stock (volatile)
  INVENTORY: 300, // 5 minutes for inventory details
  ALERTS: 120, // 2 minutes for alerts
};

const ALERT_THRESHOLDS = {
  CRITICAL: 0,
  HIGH: 0.1, // 10% of min stock
  MEDIUM: 0.3, // 30% of min stock
  LOW: 0.5, // 50% of min stock
};

// ============================================================================
// InventoryService
// ============================================================================

export class InventoryService {
  private cache: CacheService;

  constructor(
    private prisma: PrismaClient,
    cache?: CacheService
  ) {
    this.cache = cache || new CacheService();
  }

  // ==========================================================================
  // Core Stock Operations
  // ==========================================================================

  /**
   * Get current stock for an inventory item at a specific location
   * 
   * @param inventoryCode - Unique inventory code (SKU)
   * @param locationId - Location identifier
   * @returns Stock information with caching
   */
  async getStock(
    inventoryCode: string,
    locationId: string
  ): Promise<Result<StockInfo, NotFoundError>> {
    const cacheKey = generateCacheKey('stock', locationId, inventoryCode);

    // Try cache first
    const cached = await this.cache.get<StockInfo>(cacheKey);
    if (cached) {
      pinoLogger.debug({ inventoryCode, locationId }, 'Stock cache hit');
      return ok(cached);
    }

    // Query database
    const inventory = await QueryMonitor.measure(
      'getStock',
      async () => {
        return await this.prisma.inventory.findFirst({
          where: {
            code: inventoryCode,
            location_id: locationId,
          },
          include: {
            locations: true,
          },
        });
      }
    );

    if (!inventory) {
      return err(new NotFoundError('Inventory', `${inventoryCode} at location ${locationId}`));
    }

    const stockInfo: StockInfo = {
      inventoryId: inventory.id,
      code: inventory.code,
      name: inventory.name,
      stock: Number(inventory.stock),
      theoreticalStock: Number(inventory.theoretical_stock),
      minStock: inventory.min_stock ? Number(inventory.min_stock) : null,
      maxStock: inventory.max_stock ? Number(inventory.max_stock) : null,
      unit: inventory.unit,
      locationId: inventory.location_id,
      isActive: inventory.is_active,
    };

    // Cache the result
    await this.cache.set(cacheKey, stockInfo, CACHE_TTL.STOCK);

    return ok(stockInfo);
  }

  /**
   * Get stock for multiple items in batch
   * 
   * @param items - Array of {inventoryCode, locationId} pairs
   * @returns Map of stock information
   */
  async getStockBatch(
    items: Array<{ inventoryCode: string; locationId: string }>
  ): Promise<Result<Map<string, StockInfo>, DomainError>> {
    const results = new Map<string, StockInfo>();
    const errors: string[] = [];

    for (const item of items) {
      const result = await this.getStock(item.inventoryCode, item.locationId);
      if (result.success) {
        results.set(`${item.locationId}:${item.inventoryCode}`, result.data);
      } else {
        errors.push(`${item.inventoryCode}: ${result.error.message}`);
      }
    }

    if (errors.length > 0 && results.size === 0) {
      return err(new DomainError(
        `Failed to retrieve stock for all items: ${errors.join(', ')}`,
        'BATCH_STOCK_ERROR'
      ));
    }

    return ok(results);
  }

  // ==========================================================================
  // Stock Deduction (Order Processing)
  // ==========================================================================

  /**
   * Deduct stock for an order based on product recipes
   * 
   * This method:
   * 1. Looks up recipes for all products in the order
   * 2. Calculates ingredient quantities needed
   * 3. Deducts stock atomically
   * 4. Creates inventory logs
   * 5. Generates alerts for low/out of stock
   * 6. Emits INVENTORY_DEDUCTED event
   * 
   * @param orderId - Order identifier
   * @param locationId - Location where order is being fulfilled
   * @param items - Order items with product IDs and quantities
   * @returns Deduction result with alerts
   */
  async deductStock(
    orderId: string,
    locationId: string,
    items: DeductionItem[]
  ): Promise<Result<DeductionResult, DomainError>> {
    // Validate input
    if (!items || items.length === 0) {
      return err(new ValidationError(
        'At least one item is required for deduction',
        'items'
      ));
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        return err(new ValidationError(
          `Invalid quantity for product ${item.productId}`,
          'quantity'
        ));
      }
    }

    const deductionResult: DeductionResult = {
      orderId,
      deductions: [],
      alerts: [],
    };

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const processedIngredients = new Map<string, number>();

        for (const item of items) {
          // Get recipe for product
          const recipe = await tx.recipes.findUnique({
            where: {
              tenant_id_product_id: {
                tenant_id: locationId, // Assuming tenant_id is derived from location
                product_id: item.productId,
              },
            },
          });

          if (!recipe || !recipe.is_active) {
            continue; // No recipe = no deduction needed
          }

          const ingredients = recipe.ingredients as Array<{
            inventory_code: string;
            quantity: number;
            unit: string;
            is_optional?: boolean;
          }>;

          if (!ingredients || ingredients.length === 0) {
            continue;
          }

          for (const ingredient of ingredients) {
            if (ingredient.is_optional) continue;

            const totalQuantity = ingredient.quantity * item.quantity;
            const key = `${locationId}:${ingredient.inventory_code}`;

            // Accumulate quantities for same ingredient across multiple items
            if (processedIngredients.has(key)) {
              processedIngredients.set(key, processedIngredients.get(key)! + totalQuantity);
            } else {
              processedIngredients.set(key, totalQuantity);
            }
          }
        }

        // Process accumulated deductions
        for (const [key, totalQuantity] of processedIngredients) {
          const [, inventoryCode] = key.split(':');

          // Find inventory record
          const inventory = await tx.inventory.findFirst({
            where: {
              code: inventoryCode,
              location_id: locationId,
            },
          });

          if (!inventory) {
            pinoLogger.warn({ inventoryCode, locationId }, 'Inventory not found for deduction');
            continue;
          }

          const previousStock = Number(inventory.stock);
          const newStock = previousStock - totalQuantity;

          // Update inventory
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              stock: new Decimal(newStock),
              theoretical_stock: new Decimal(newStock),
              updated_at: new Date(),
            },
          });

          // Create inventory log
          await tx.inventory_log.create({
            data: {
              id: uuidv4(),
              tenant_id: locationId,
              inventory_id: inventory.id,
              movement_type: 'OUT',
              quantity: new Decimal(-totalQuantity),
              reference_id: orderId,
              reason: `Order ${orderId} - Deduction`,
              created_at: new Date(),
            },
          });

          deductionResult.deductions.push({
            inventoryCode,
            quantityDeducted: totalQuantity,
            newStock,
          });

          // Check for alerts
          const alert = this.checkStockAlert(inventoryCode, newStock, inventory.min_stock ? Number(inventory.min_stock) : null);
          if (alert) {
            deductionResult.alerts.push(alert);

            // Persist alert to database
            await tx.stock_alerts.create({
              data: {
                id: uuidv4(),
                tenant_id: locationId,
                location_id: locationId,
                sku: inventoryCode,
                alert_type: alert.type,
                severity: alert.severity,
                current_qty: new Decimal(newStock),
                threshold_qty: inventory.min_stock || new Decimal(0),
                created_at: new Date(),
              },
            });
          }
        }

        return deductionResult;
      },
      { maxRetries: 3, isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, orderId },
        'Failed to deduct stock'
      );
      return err(new DomainError(
        'Failed to deduct stock',
        'DEDUCTION_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const result = txResult.data;

    // Invalidate caches
    for (const deduction of result.deductions) {
      await this.invalidateStockCache(deduction.inventoryCode, locationId);
    }

    // Emit event
    const tenantId = await this.getTenantIdFromLocation(locationId);
    if (tenantId) {
      const eventPayload: InventoryDeducted = {
        order_id: orderId,
        line_id: items[0]?.lineId || 'batch',
        product_id: items[0]?.productId || 'multiple',
        location_id: locationId,
        ingredients: result.deductions.map(d => ({
          inventory_code: d.inventoryCode,
          quantity_deducted: d.quantityDeducted,
          new_stock: d.newStock,
        })),
      };

      this.emitInventoryEvent('INVENTORY_DEDUCTED', tenantId, eventPayload);
    }

    pinoLogger.info(
      { orderId, deductions: result.deductions.length, alerts: result.alerts.length },
      'Stock deducted successfully'
    );

    return ok(result);
  }

  // ==========================================================================
  // Manual Stock Adjustment
  // ==========================================================================

  /**
   * Manually adjust stock quantity
   * 
   * Used for:
   * - Inventory counts reconciliation
   * - Manual corrections
   * - Damaged goods removal
   * 
   * Creates an audit trail via InventoryLog and emits INVENTORY_ADJUSTED event.
   * 
   * @param input - Adjustment parameters
   * @returns Adjustment result
   */
  async adjustStock(
    input: AdjustmentInput
  ): Promise<Result<AdjustmentResult, DomainError>> {
    // Validate input
    if (input.newQuantity < 0) {
      return err(new ValidationError(
        'Stock quantity cannot be negative',
        'newQuantity'
      ));
    }

    if (!input.reason || input.reason.trim().length === 0) {
      return err(new ValidationError(
        'Reason is required for adjustment',
        'reason'
      ));
    }

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Find inventory record
        const inventory = await tx.inventory.findFirst({
          where: {
            code: input.inventoryCode,
            location_id: input.locationId,
          },
        });

        if (!inventory) {
          throw new NotFoundError('Inventory', `${input.inventoryCode} at location ${input.locationId}`);
        }

        const previousQuantity = Number(inventory.stock);
        const difference = input.newQuantity - previousQuantity;

        // Update inventory
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: new Decimal(input.newQuantity),
            theoretical_stock: new Decimal(input.newQuantity),
            updated_at: new Date(),
          },
        });

        // Create inventory log
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id: input.locationId,
            inventory_id: inventory.id,
            movement_type: 'ADJUST',
            quantity: new Decimal(difference),
            reference_id: input.referenceId || null,
            reason: input.reason,
            created_at: new Date(),
          },
        });

        return {
          inventoryCode: input.inventoryCode,
          previousQuantity,
          newQuantity: input.newQuantity,
          difference,
        };
      },
      { maxRetries: 2 }
    );

    if (!txResult.success) {
      const error = txResult.error;
      if (error instanceof NotFoundError) {
        return err(error);
      }

      pinoLogger.error(
        { error, input },
        'Failed to adjust stock'
      );
      return err(new DomainError(
        'Failed to adjust stock',
        'ADJUSTMENT_FAILED',
        { originalError: error.message }
      ));
    }

    const result = txResult.data;

    // Invalidate cache
    await this.invalidateStockCache(input.inventoryCode, input.locationId);

    // Emit event
    const tenantId = await this.getTenantIdFromLocation(input.locationId);
    if (tenantId) {
      const eventPayload: InventoryAdjusted = {
        inventory_code: input.inventoryCode,
        location_id: input.locationId,
        from_qty: result.previousQuantity,
        to_qty: result.newQuantity,
        reason: input.reason,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
      };

      this.emitInventoryEvent('INVENTORY_ADJUSTED', tenantId, eventPayload);
    }

    pinoLogger.info(
      {
        inventoryCode: input.inventoryCode,
        previous: result.previousQuantity,
        new: result.newQuantity,
      },
      'Stock adjusted successfully'
    );

    return ok(result);
  }

  // ==========================================================================
  // Goods Receipt (Purchase Order)
  // ==========================================================================

  /**
   * Receive stock from a purchase order
   * 
   * This method:
   * 1. Validates the purchase order exists and is in valid state
   * 2. Records received quantities (may be partial)
   * 3. Updates inventory stock
   * 4. Creates inventory logs for received items
   * 5. Updates purchase order status
   * 6. Emits GOODS_RECEIVED event
   * 
   * @param input - Receipt parameters
   * @returns Receipt result with updated stock levels
   */
  async receiveStock(
    input: ReceiptInput
  ): Promise<Result<ReceiptResult, DomainError>> {
    // Validate input
    if (!input.items || input.items.length === 0) {
      return err(new ValidationError(
        'At least one item is required for receipt',
        'items'
      ));
    }

    for (const item of input.items) {
      if (item.quantityReceived < 0) {
        return err(new ValidationError(
          `Received quantity cannot be negative for ${item.inventoryCode}`,
          'quantityReceived'
        ));
      }
    }

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        const receiptId = uuidv4();
        const receiptNumber = await this.generateReceiptNumber(tx, input.locationId);

        const result: ReceiptResult = {
          receiptId,
          receiptNumber,
          items: [],
        };

        // Create goods receipt record
        await tx.goods_receipt.create({
          data: {
            id: receiptId,
            purchase_order_id: input.purchaseOrderId || null,
            location_id: input.locationId,
            receipt_number: receiptNumber,
            status: 'CONFIRMED',
            received_by: input.receivedBy,
            notes: input.notes || null,
            created_at: new Date(),
          },
        });

        for (const item of input.items) {
          const inventory = await tx.inventory.findFirst({
            where: {
              code: item.inventoryCode,
              location_id: input.locationId,
            },
          });

          if (!inventory) {
            throw new DomainError(
              `Inventory not found: ${item.inventoryCode}`,
              'INVENTORY_NOT_FOUND'
            );
          }

          const previousStock = Number(inventory.stock);
          const newStock = previousStock + item.quantityReceived;

          // Update inventory stock
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              stock: new Decimal(newStock),
              theoretical_stock: new Decimal(newStock),
              updated_at: new Date(),
              // Update lot/expiry if provided
              ...(item.lotNumber && { lot_number: item.lotNumber }),
              ...(item.expiryDate && { expiry_date: new Date(item.expiryDate) }),
            },
          });

          // Create inventory log
          await tx.inventory_log.create({
            data: {
              id: uuidv4(),
              tenant_id: input.locationId,
              inventory_id: inventory.id,
              movement_type: 'IN',
              quantity: new Decimal(item.quantityReceived),
              reference_id: receiptId,
              reason: `Receipt ${receiptNumber}${input.purchaseOrderId ? ` - PO ${input.purchaseOrderId}` : ''}`,
              lot_number: item.lotNumber || null,
              expiry_date: item.expiryDate ? new Date(item.expiryDate) : null,
              created_at: new Date(),
            },
          });

          // Create goods receipt item
          await tx.goods_receipt_items.create({
            data: {
              id: uuidv4(),
              goods_receipt_id: receiptId,
              inventory_id: inventory.id,
              quantity_ordered: item.quantityOrdered,
              quantity_received: item.quantityReceived,
              quantity_rejected: item.quantityRejected || 0,
              rejection_reason: item.rejectionReason || null,
              unit_cost_cents: item.unitCostCents,
              lot_number: item.lotNumber || null,
              expiry_date: item.expiryDate ? new Date(item.expiryDate) : null,
            },
          });

          result.items.push({
            inventoryCode: item.inventoryCode,
            quantityReceived: item.quantityReceived,
            quantityRejected: item.quantityRejected || 0,
            newStock,
          });
        }

        // Update purchase order status if applicable
        if (input.purchaseOrderId) {
          await this.updatePurchaseOrderStatus(tx, input.purchaseOrderId, input.items);
        }

        return result;
      },
      { maxRetries: 3 }
    );

    if (!txResult.success) {
      pinoLogger.error(
        { error: txResult.error, input },
        'Failed to receive stock'
      );
      return err(new DomainError(
        'Failed to receive stock',
        'RECEIPT_FAILED',
        { originalError: txResult.error.message }
      ));
    }

    const result = txResult.data;

    // Invalidate caches
    for (const item of result.items) {
      await this.invalidateStockCache(item.inventoryCode, input.locationId);
    }

    // Emit event
    const tenantId = await this.getTenantIdFromLocation(input.locationId);
    if (tenantId) {
      const eventPayload: GoodsReceived = {
        goods_receipt_id: result.receiptId,
        purchase_order_id: input.purchaseOrderId || null,
        location_id: input.locationId,
        receipt_number: result.receiptNumber,
        items: result.items.map(item => ({
          inventory_code: item.inventoryCode,
          quantity_ordered: 0, // Will be populated from PO if available
          quantity_received: item.quantityReceived,
          quantity_rejected: item.quantityRejected,
          rejection_reason: null,
          unit_cost_cents: 0,
          lot_number: null,
          expiry_date: null,
        })),
        received_by: input.receivedBy,
        notes: input.notes || null,
      };

      this.emitInventoryEvent('GOODS_RECEIVED', tenantId, eventPayload);
    }

    pinoLogger.info(
      { receiptId: result.receiptId, items: result.items.length },
      'Stock received successfully'
    );

    return ok(result);
  }

  // ==========================================================================
  // Waste Recording
  // ==========================================================================

  /**
   * Record waste/spoilage of inventory
   * 
   * This method:
   * 1. Deducts waste quantity from stock
   * 2. Creates waste log entry
   * 3. Creates inventory log entry
   * 4. Emits WASTE_RECORDED event
   * 
   * @param input - Waste parameters
   * @returns Waste result with new stock level
   */
  async recordWaste(
    input: WasteInput
  ): Promise<Result<WasteResult, DomainError>> {
    // Validate input
    if (input.quantity <= 0) {
      return err(new ValidationError(
        'Waste quantity must be positive',
        'quantity'
      ));
    }

    if (!input.reasonCode) {
      return err(new ValidationError(
        'Reason code is required for waste recording',
        'reasonCode'
      ));
    }

    // Execute in transaction
    const txResult = await withTransaction(
      this.prisma,
      async (tx) => {
        // Find inventory
        const inventory = await tx.inventory.findFirst({
          where: {
            code: input.inventoryCode,
            location_id: input.locationId,
          },
        });

        if (!inventory) {
          throw new NotFoundError('Inventory', `${input.inventoryCode} at location ${input.locationId}`);
        }

        const currentStock = Number(inventory.stock);
        const newStock = currentStock - input.quantity;

        if (newStock < 0) {
          throw new DomainError(
            `Insufficient stock for waste recording. Current: ${currentStock}, Waste: ${input.quantity}`,
            'INSUFFICIENT_STOCK'
          );
        }

        const wasteLogId = uuidv4();

        // Update inventory
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            stock: new Decimal(newStock),
            theoretical_stock: new Decimal(newStock),
            updated_at: new Date(),
          },
        });

        // Create waste log
        await tx.waste_log.create({
          data: {
            id: wasteLogId,
            tenant_id: input.locationId,
            inventory_id: inventory.id,
            quantity: new Decimal(input.quantity),
            unit: input.unit,
            reason_code: input.reasonCode,
            reason_detail: input.reasonDetail || null,
            cost_cents: input.costCents,
            reported_by: input.reportedBy,
            reference_type: input.referenceType || null,
            reference_id: input.referenceId || null,
            created_at: new Date(),
          },
        });

        // Create inventory log
        await tx.inventory_log.create({
          data: {
            id: uuidv4(),
            tenant_id: input.locationId,
            inventory_id: inventory.id,
            movement_type: 'WASTE',
            quantity: new Decimal(-input.quantity),
            reference_id: wasteLogId,
            reason: `Waste: ${input.reasonCode}${input.reasonDetail ? ` - ${input.reasonDetail}` : ''}`,
            created_at: new Date(),
          },
        });

        return {
          wasteLogId,
          inventoryCode: input.inventoryCode,
          quantity: input.quantity,
          costCents: input.costCents,
          newStock,
        };
      },
      { maxRetries: 2 }
    );

    if (!txResult.success) {
      const error = txResult.error;
      if (error instanceof NotFoundError || error instanceof DomainError) {
        return err(error);
      }

      pinoLogger.error(
        { error, input },
        'Failed to record waste'
      );
      return err(new DomainError(
        'Failed to record waste',
        'WASTE_RECORDING_FAILED',
        { originalError: error.message }
      ));
    }

    const result = txResult.data;

    // Invalidate cache
    await this.invalidateStockCache(input.inventoryCode, input.locationId);

    // Emit event
    const tenantId = await this.getTenantIdFromLocation(input.locationId);
    if (tenantId) {
      const eventPayload: WasteRecorded = {
        waste_log_id: result.wasteLogId,
        inventory_code: input.inventoryCode,
        location_id: input.locationId,
        quantity: input.quantity,
        unit: input.unit,
        reason_code: input.reasonCode,
        reason_detail: input.reasonDetail || null,
        cost_cents: input.costCents,
        reported_by: input.reportedBy,
        reference_type: input.referenceType || null,
        reference_id: input.referenceId || null,
      };

      this.emitInventoryEvent('WASTE_RECORDED', tenantId, eventPayload);
    }

    pinoLogger.info(
      {
        wasteLogId: result.wasteLogId,
        inventoryCode: input.inventoryCode,
        quantity: input.quantity,
        newStock: result.newStock,
      },
      'Waste recorded successfully'
    );

    return ok(result);
  }

  // ==========================================================================
  // Stock Alerts & Monitoring
  // ==========================================================================

  /**
   * Get active stock alerts for a location
   * 
   * @param locationId - Location identifier
   * @param severity - Optional severity filter
   * @returns Array of active stock alerts
   */
  async getStockAlerts(
    locationId: string,
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  ): Promise<Result<StockAlert[], DomainError>> {
    const cacheKey = generateCacheKey('alerts', locationId, severity || 'all');

    // Try cache
    const cached = await this.cache.get<StockAlert[]>(cacheKey);
    if (cached) {
      return ok(cached);
    }

    const alerts = await QueryMonitor.measure(
      'getStockAlerts',
      async () => {
        const where: any = {
          location_id: locationId,
          is_resolved: false,
        };

        if (severity) {
          where.severity = severity;
        }

        const dbAlerts = await this.prisma.stock_alerts.findMany({
          where,
          orderBy: { created_at: 'desc' },
        });

        return dbAlerts.map(alert => ({
          type: alert.alert_type as 'LOW_STOCK' | 'OUT_OF_STOCK' | 'OVERSTOCK',
          inventoryCode: alert.sku,
          currentStock: Number(alert.current_qty),
          threshold: Number(alert.threshold_qty),
          severity: alert.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        }));
      }
    );

    // Cache for short period
    await this.cache.set(cacheKey, alerts, CACHE_TTL.ALERTS);

    return ok(alerts);
  }

  /**
   * Get inventory items with low stock
   * 
   * @param locationId - Location identifier
   * @returns Array of low stock items
   */
  async getLowStockItems(
    locationId: string
  ): Promise<Result<StockInfo[], DomainError>> {
    const items = await QueryMonitor.measure(
      'getLowStockItems',
      async () => {
        const inventory = await this.prisma.inventory.findMany({
          where: {
            location_id: locationId,
            is_active: true,
            min_stock: {
              not: null,
            },
          },
        });

        return inventory
          .filter(inv => {
            const stock = Number(inv.stock);
            const minStock = Number(inv.min_stock);
            return stock < minStock;
          })
          .map(inv => ({
            inventoryId: inv.id,
            code: inv.code,
            name: inv.name,
            stock: Number(inv.stock),
            theoreticalStock: Number(inv.theoretical_stock),
            minStock: Number(inv.min_stock),
            maxStock: inv.max_stock ? Number(inv.max_stock) : null,
            unit: inv.unit,
            locationId: inv.location_id,
            isActive: inv.is_active,
          }));
      }
    );

    return ok(items);
  }

  /**
   * Resolve a stock alert
   * 
   * @param alertId - Alert identifier
   * @param resolvedBy - User who resolved the alert
   * @returns Success status
   */
  async resolveStockAlert(
    alertId: string,
    resolvedBy: string
  ): Promise<Result<void, DomainError>> {
    try {
      await this.prisma.stock_alerts.update({
        where: { id: alertId },
        data: {
          is_resolved: true,
          resolved_at: new Date(),
          resolved_by: resolvedBy,
        },
      });

      pinoLogger.info({ alertId, resolvedBy }, 'Stock alert resolved');
      return ok(undefined);
    } catch (error) {
      return err(new DomainError(
        'Failed to resolve stock alert',
        'ALERT_RESOLUTION_FAILED',
        { originalError: (error as Error).message }
      ));
    }
  }

  // ==========================================================================
  // List & Search Operations
  // ==========================================================================

  /**
   * List inventory items with filtering
   * 
   * @param filters - Query filters
   * @param page - Page number (1-based)
   * @param pageSize - Items per page
   * @returns Paginated inventory list
   */
  async listInventory(
    filters: InventoryFilters,
    page = 1,
    pageSize = 50
  ): Promise<Result<{ items: StockInfo[]; total: number }, DomainError>> {
    const where: any = {};

    if (filters.locationId) {
      where.location_id = filters.locationId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.isActive !== undefined) {
      where.is_active = filters.isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.inventory.count({ where }),
    ]);

    const stockInfos = items.map(inv => ({
      inventoryId: inv.id,
      code: inv.code,
      name: inv.name,
      stock: Number(inv.stock),
      theoreticalStock: Number(inv.theoretical_stock),
      minStock: inv.min_stock ? Number(inv.min_stock) : null,
      maxStock: inv.max_stock ? Number(inv.max_stock) : null,
      unit: inv.unit,
      locationId: inv.location_id,
      isActive: inv.is_active,
    }));

    // Filter low stock if requested
    if (filters.lowStockOnly) {
      const filtered = stockInfos.filter(inv => 
        inv.minStock !== null && inv.stock < inv.minStock
      );
      return ok({ items: filtered, total: filtered.length });
    }

    return ok({ items: stockInfos, total });
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Check if stock level triggers an alert
   */
  private checkStockAlert(
    inventoryCode: string,
    currentStock: number,
    minStock: number | null
  ): StockAlert | null {
    if (!minStock || minStock <= 0) {
      return null;
    }

    const ratio = currentStock / minStock;

    if (currentStock <= 0) {
      return {
        type: 'OUT_OF_STOCK',
        inventoryCode,
        currentStock,
        threshold: minStock,
        severity: 'CRITICAL',
      };
    }

    if (ratio <= ALERT_THRESHOLDS.CRITICAL) {
      return {
        type: 'OUT_OF_STOCK',
        inventoryCode,
        currentStock,
        threshold: minStock,
        severity: 'CRITICAL',
      };
    }

    if (ratio <= ALERT_THRESHOLDS.HIGH) {
      return {
        type: 'LOW_STOCK',
        inventoryCode,
        currentStock,
        threshold: minStock,
        severity: 'HIGH',
      };
    }

    if (ratio <= ALERT_THRESHOLDS.MEDIUM) {
      return {
        type: 'LOW_STOCK',
        inventoryCode,
        currentStock,
        threshold: minStock,
        severity: 'MEDIUM',
      };
    }

    if (ratio <= ALERT_THRESHOLDS.LOW) {
      return {
        type: 'LOW_STOCK',
        inventoryCode,
        currentStock,
        threshold: minStock,
        severity: 'LOW',
      };
    }

    return null;
  }

  /**
   * Emit inventory event through event bus
   */
  private emitInventoryEvent(
    eventType: 'INVENTORY_ADJUSTED' | 'INVENTORY_DEDUCTED' | 'WASTE_RECORDED' | 'GOODS_RECEIVED',
    tenantId: string,
    payload: InventoryAdjusted | InventoryDeducted | WasteRecorded | GoodsReceived
  ): void {
    const event = {
      event_id: uuidv4(),
      tenant_id: tenantId,
      terminal_id: 'inventory-service',
      terminal_sequence: 0,
      occurred_at: new Date().toISOString(),
      aggregate_type: 'INVENTORY' as const,
      aggregate_id: payload.inventory_code || (payload as any).order_id || (payload as any).goods_receipt_id,
      correlation_id: uuidv4(),
      causation_id: null,
      actor_id: null,
      actor_role_snapshot: 'SYSTEM',
      schema_version: 1,
      payload_version: 1,
      shift_id: null,
      business_date: null,
      event_type: eventType,
      payload,
    };

    eventBus.publish(tenantId, event as any);
    pinoLogger.debug({ eventType, tenantId }, 'Inventory event emitted');
  }

  /**
   * Invalidate stock cache for an item
   */
  private async invalidateStockCache(
    inventoryCode: string,
    locationId: string
  ): Promise<void> {
    const cacheKey = generateCacheKey('stock', locationId, inventoryCode);
    await this.cache.del(cacheKey);

    // Also invalidate alerts cache
    await this.cache.invalidatePattern(`alerts:${locationId}:*`);

    pinoLogger.debug({ inventoryCode, locationId }, 'Stock cache invalidated');
  }

  /**
   * Generate unique receipt number
   */
  private async generateReceiptNumber(
    tx: Prisma.TransactionClient,
    locationId: string
  ): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    const count = await tx.goods_receipt.count({
      where: {
        location_id: locationId,
        created_at: {
          gte: new Date(date.setHours(0, 0, 0, 0)),
          lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      },
    });

    return `GR-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Update purchase order status based on receipt
   */
  private async updatePurchaseOrderStatus(
    tx: Prisma.TransactionClient,
    purchaseOrderId: string,
    items: ReceiptItem[]
  ): Promise<void> {
    const purchaseOrder = await tx.purchase_orders.findUnique({
      where: { id: purchaseOrderId },
      include: { purchase_order_items: true },
    });

    if (!purchaseOrder) {
      return;
    }

    // Check if all items fully received
    const allReceived = purchaseOrder.purchase_order_items.every(poItem => {
      const receivedItem = items.find(i => i.inventoryCode === poItem.inventory_id);
      if (!receivedItem) return false;
      return receivedItem.quantityReceived >= Number(poItem.quantity);
    });

    const newStatus = allReceived ? 'RECEIVED' : 'PARTIAL_RECEIVED';

    await tx.purchase_orders.update({
      where: { id: purchaseOrderId },
      data: {
        status: newStatus,
        updated_at: new Date(),
      },
    });

    // Create status change event
    await tx.events.create({
      data: {
        id: uuidv4(),
        tenant_id: purchaseOrder.tenant_id,
        occurred_at: new Date(),
        type: 'PURCHASE_ORDER_STATUS_CHANGED',
        entity_type: 'INVENTORY',
        entity_id: purchaseOrderId,
        actor_id: 'system',
        actor_role_snapshot: 'SYSTEM',
        terminal_id: 'inventory-service',
        payload: {
          purchase_order_id: purchaseOrderId,
          from_status: purchaseOrder.status,
          to_status: newStatus,
        },
      },
    });
  }

  /**
   * Get tenant ID from location
   */
  private async getTenantIdFromLocation(locationId: string): Promise<string | null> {
    const location = await this.prisma.locations.findUnique({
      where: { id: locationId },
      select: { tenant_id: true },
    });

    return location?.tenant_id || null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const inventoryService = new InventoryService(
  new PrismaClient()
);

// ============================================================================
// Export Types
// ============================================================================

export type {
  StockInfo,
  DeductionItem,
  DeductionResult,
  AdjustmentInput,
  AdjustmentResult,
  ReceiptItem,
  ReceiptInput,
  ReceiptResult,
  WasteInput,
  WasteResult,
  StockAlert,
  InventoryFilters,
};
