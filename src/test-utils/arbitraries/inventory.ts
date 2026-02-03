/**
 * Inventory Arbitraries - fast-check generators for inventory types
 * 
 * These arbitraries generate random inventory-related values for property-based testing.
 */

import * as fc from 'fast-check';
import {
  centavosArb,
  positiveCentavosArb,
  tenantIdArb,
  uuidArb,
  shortStringArb,
  mediumStringArb,
  skuArb,
  quantityArb,
  isoDateArb,
} from './domain';

/**
 * Generates InventoryItem objects
 */
export const inventoryItemArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  sku: skuArb,
  name: shortStringArb,
  unit: fc.constantFrom('UNIDAD', 'KG', 'LT', 'DOCENA'),
  current_qty: fc.integer({ min: 0, max: 10000 }),
  unit_cost_cents: positiveCentavosArb,
  weighted_avg_cost_cents: positiveCentavosArb,
  reorder_level: fc.integer({ min: 0, max: 1000 }),
  is_active: fc.boolean(),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

/**
 * Generates Recipe objects (ingredient list for a product)
 */
export const recipeArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  product_id: uuidArb,
  ingredients: fc.array(
    fc.record({
      inventory_item_id: uuidArb,
      quantity: quantityArb,
    }),
    { minLength: 1, maxLength: 10 }
  ),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

/**
 * Generates WasteLog objects
 */
export const wasteLogArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  inventory_item_id: uuidArb,
  quantity: quantityArb,
  unit_cost_cents: positiveCentavosArb,
  reason: fc.constantFrom('SPOILAGE', 'DAMAGE', 'EXPIRATION', 'SAMPLE'),
  recorded_by: uuidArb,
  recorded_at: isoDateArb,
});

/**
 * Generates PurchaseOrder objects
 */
export const purchaseOrderArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  po_number: fc.integer({ min: 1, max: 99999 }),
  supplier_id: uuidArb,
  status: fc.constantFrom('DRAFT', 'SENT', 'RECEIVED', 'CANCELLED'),
  items: fc.array(
    fc.record({
      inventory_item_id: uuidArb,
      quantity: quantityArb,
      unit_cost_cents: positiveCentavosArb,
    }),
    { minLength: 1, maxLength: 20 }
  ),
  total_cents: centavosArb,
  received_at: fc.option(isoDateArb, { nil: null }),
  created_at: isoDateArb,
  updated_at: isoDateArb,
});

/**
 * Generates GoodsReceipt objects (when PO is received)
 */
export const goodsReceiptArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  po_id: uuidArb,
  items: fc.array(
    fc.record({
      inventory_item_id: uuidArb,
      received_qty: quantityArb,
      unit_cost_cents: positiveCentavosArb,
    }),
    { minLength: 1, maxLength: 20 }
  ),
  received_by: uuidArb,
  received_at: isoDateArb,
});

/**
 * Generates StockAdjustment objects
 */
export const stockAdjustmentArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  inventory_item_id: uuidArb,
  adjustment_qty: fc.integer({ min: -1000, max: 1000 }),
  reason: mediumStringArb,
  adjusted_by: uuidArb,
  adjusted_at: isoDateArb,
});

/**
 * Generates InventoryCount objects (physical count)
 */
export const inventoryCountArb = fc.record({
  id: uuidArb,
  tenant_id: tenantIdArb,
  count_date: isoDateArb,
  items: fc.array(
    fc.record({
      inventory_item_id: uuidArb,
      counted_qty: fc.integer({ min: 0, max: 10000 }),
      system_qty: fc.integer({ min: 0, max: 10000 }),
    }),
    { minLength: 1, maxLength: 50 }
  ),
  counted_by: uuidArb,
});

/**
 * Generates realistic inventory transaction sequences
 * Useful for testing inventory reconciliation
 */
export const inventoryTransactionSequenceArb = fc.array(
  fc.oneof(
    fc.record({
      type: fc.constant('PURCHASE'),
      item_id: uuidArb,
      qty: quantityArb,
      unit_cost_cents: positiveCentavosArb,
    }),
    fc.record({
      type: fc.constant('DEDUCTION'),
      item_id: uuidArb,
      qty: quantityArb,
    }),
    fc.record({
      type: fc.constant('WASTE'),
      item_id: uuidArb,
      qty: quantityArb,
      unit_cost_cents: positiveCentavosArb,
    }),
    fc.record({
      type: fc.constant('ADJUSTMENT'),
      item_id: uuidArb,
      qty: fc.integer({ min: -100, max: 100 }),
    })
  ),
  { minLength: 1, maxLength: 50 }
);
