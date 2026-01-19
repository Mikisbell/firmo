# KDS Order Submission Fix

## Problem

**Bug:** Orders created by waiters don't appear on KDS screens (kitchen, bar, grill) or cashier pending orders list.

**Root Cause:** The `ORDER_SUBMITTED` event was generated when waiters sent orders to the kitchen, but the `sale.reducer.ts` didn't process this event, so the KDS and cashier never knew about new orders.

## Solution

Added processing for the `ORDER_SUBMITTED` event in the sale reducer:

1. **Added `submitted_at` field** to `SaleLine` type to track when items are sent to kitchen
2. **Added `ORDER_SUBMITTED` case** to the reducer that:
   - Marks items as submitted with timestamp
   - Keeps status as `PENDING` so KDS can see them
   - Handles idempotency (replaying events produces same state)
   - Handles missing line_ids gracefully with warnings

## Files Changed

- `src/core/projections/types.ts` - Added `submitted_at?: string | null` to `SaleLine`
- `src/core/projections/sale.reducer.ts` - Added `ORDER_SUBMITTED` case
- `src/core/projections/__tests__/sale.reducer.order-submitted.test.ts` - 7 unit tests
- `e2e/waiter-to-kds.spec.ts` - 5 E2E tests

## Tests

### Unit Tests (7 passing)
✅ Process ORDER_SUBMITTED and mark items as submitted  
✅ Keep items with status PENDING after submission  
✅ Idempotency - replaying same event doesn't change submitted_at  
✅ Handle multiple stations correctly  
✅ Handle missing line_id gracefully with warning  
✅ Don't crash when items_by_station is empty  
✅ Preserve all item data after submission  

### E2E Tests (5 scenarios)
✅ Waiter creates order and submits to kitchen, KDS shows order  
✅ KDS can change item status after submission  
✅ Multiple waiters can submit orders simultaneously  
✅ Order with no items cannot be submitted  
✅ Submitted items remain visible on waiter screen  

## How It Works

### Before Fix
```
Waiter → submitToKitchen() → ORDER_SUBMITTED event → ❌ Ignored by reducer → KDS sees nothing, Cashier sees nothing
```

### After Fix
```
Waiter → submitToKitchen() → ORDER_SUBMITTED event → ✅ Processed by reducer → KDS sees order, Cashier sees order
```

### Complete Flow: Waiter → KDS → Cashier

1. **Waiter creates order:**
   - Adds items (Pollo → PARRILLA, Papas → COCINA, Gaseosa → BAR)
   - Clicks "Enviar a Cocina"
   - Generates `ORDER_SUBMITTED` event

2. **Reducer processes event:**
   - Marks items with `submitted_at` timestamp
   - Keeps status as `PENDING`

3. **KDS screens receive order:**
   - KDS Parrilla sees: "1x Pollo Entero"
   - KDS Cocina sees: "2x Papas Fritas"
   - KDS Bar sees: "4x Gaseosa"

4. **Cashier sees order:**
   - Order appears in "Órdenes Pendientes" list
   - Shows: Mesa 12 - S/ 85.00 (3 items)
   - Cashier can select and charge the order

5. **Kitchen updates status:**
   - Cook marks items: PENDING → COOKING → READY
   - Generates `ORDER_ITEM_STATUS_CHANGED` events

6. **Cashier processes payment:**
   - Selects order from pending list
   - Charges with CASH/YAPE/CARD
   - Issues invoice (BOLETA/FACTURA)

## Verification

Run tests:
```bash
npm test -- sale.reducer.order-submitted.test.ts
npm test -- sale.reducer  # Verify no regressions
npx playwright test waiter-to-kds.spec.ts
```

Manual testing:
1. Open `/mozo` (waiter page)
2. Select a table
3. Add items (Pollo, Papas, Gaseosa)
4. Click "Enviar a Cocina"
5. Open `/cocina` (KDS) in another tab
6. Verify order appears with items
7. Open `/pos` (Cashier) in another tab
8. Verify order appears in "Órdenes Pendientes"
9. Select order and verify all items are visible
10. Process payment and verify flow completes

## Impact

- **Low Risk** - Only adds missing reducer case, no schema changes
- **Backward Compatible** - Old events still work
- **Idempotent** - Replaying events produces same state
- **No Breaking Changes** - Existing functionality unchanged
- **Multi-Terminal Benefit** - Fixes flow for Waiter → KDS → Cashier

### Systems Affected
1. **KDS Screens** - Now receive orders from waiters
2. **Cashier (POS)** - Now sees waiter orders in pending list
3. **Projections** - Correctly rebuild order state with submitted_at timestamp

## Status

✅ **FIXED** - All tests passing, ready for production
