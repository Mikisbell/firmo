# KDS Order Submission Fix - Implementation Plan

## Problem Summary

**Bug:** Orders created by waiters don't appear on KDS screens (kitchen, bar, grill) or cashier pending orders list.

**Root Cause:** The `ORDER_SUBMITTED` event is generated when a waiter sends an order to the kitchen, but the `sale.reducer.ts` doesn't process this event, so the KDS and cashier never know about new orders.

**Impact:** 
- Kitchen staff don't see orders from waiters
- Cashiers can't see pending orders to charge
- Complete breakdown of waiter → kitchen → cashier workflow

## Technical Analysis

### Current State
- ✅ Event `ORDER_SUBMITTED` is defined in `src/core/domain/events.ts`
- ✅ Waiter uses `POSActions.submitToKitchen()` which generates the event
- ✅ Event groups items by station (PARRILLA, COCINA, BAR, etc.)
- ✅ KDS uses `useKitchenTickets()` which rebuilds state using the reducer
- ✅ Cashier uses `useProjections()` which also uses the reducer
- ❌ Reducer `applySaleEvent()` in `src/core/projections/sale.reducer.ts` has NO case for `ORDER_SUBMITTED`
- ❌ Therefore, the event is ignored and KDS doesn't see orders
- ❌ Cashier's pending orders list is also empty

### Event Structure
```typescript
const OrderSubmittedPayload = z.object({
    order_id: uuidSchema,
    submitted_at: isoDateSchema,
    items_by_station: z.record(z.string(), z.array(z.object({
        line_id: z.string().min(1),
        product_id: z.string().min(1),
        name: z.string().min(1),
        qty: z.number().int().positive(),
        mods: z.array(z.string()).default([]),
        notes: z.string().optional(),
    }))),
});
```

### Current Item Status Flow
1. Item created → `status: "PENDING"`
2. Waiter submits to kitchen → **EVENT IGNORED** (bug)
3. KDS marks cooking → `status: "COOKING"`
4. KDS marks ready → `status: "READY"`
5. Waiter marks served → `status: "DONE"`

### Proposed Fix
Add `ORDER_SUBMITTED` case to reducer that:
1. Marks items as submitted (keep status as "PENDING" or add "SUBMITTED" status if needed)
2. Ensures items are visible to KDS
3. Maintains idempotency (replaying events produces same state)
4. Preserves all item data (name, price, modifiers, station)

## Implementation Tasks

### Task 1: Add ORDER_SUBMITTED case to reducer
**File:** `src/core/projections/sale.reducer.ts`

**Changes:**
1. Add case for `ORDER_SUBMITTED` in the switch statement
2. For each item in `items_by_station`:
   - Find the corresponding line in `sale.lines` by `line_id`
   - Update the line to mark it as submitted (status remains "PENDING" for KDS to pick up)
   - Optionally add a `submitted_at` timestamp to track submission time
3. Ensure idempotency: if item already submitted, don't duplicate
4. Handle missing lines gracefully (warn but don't crash)

**Implementation approach:**
```typescript
case "ORDER_SUBMITTED": {
    const { items_by_station, submitted_at } = e.payload;
    
    // Flatten all items from all stations
    const allSubmittedItems = Object.values(items_by_station).flat();
    
    // Mark each item as submitted
    for (const item of allSubmittedItems) {
        const line = sale.lines[item.line_id];
        if (line) {
            // Keep status as PENDING so KDS can see it
            // Add submitted_at timestamp if not already set
            if (!line.submitted_at) {
                line.submitted_at = submitted_at;
            }
            sale.lines[item.line_id] = line;
        } else {
            warnings.push(`ORDER_SUBMITTED: line_id ${item.line_id} not found.`);
        }
    }
    
    sale.last_event_sequence = e.terminal_sequence;
    return { state: sale, warnings };
}
```

### Task 2: Add submitted_at field to SaleLine type
**File:** `src/core/projections/types.ts`

**Changes:**
1. Add optional `submitted_at?: string` field to `SaleLine` interface
2. This tracks when the item was sent to kitchen

### Task 3: Write unit tests for ORDER_SUBMITTED processing
**File:** `src/core/projections/__tests__/sale.reducer.order-submitted.test.ts` (new)

**Test cases:**
1. ✅ Processing ORDER_SUBMITTED marks items as submitted
2. ✅ Items remain with status PENDING after submission
3. ✅ submitted_at timestamp is set correctly
4. ✅ Multiple stations are handled correctly
5. ✅ Idempotency: replaying same event doesn't duplicate
6. ✅ Missing line_id is handled gracefully (warning, no crash)
7. ✅ KDS can see submitted items (integration with useKitchenTickets)

### Task 4: Write integration test for waiter → KDS flow
**File:** `e2e/waiter-to-kds.spec.ts` (new)

**Test scenario:**
1. Waiter creates order with items for multiple stations
2. Waiter submits order to kitchen
3. Verify ORDER_SUBMITTED event is generated
4. Verify KDS screens show the order
5. Verify items are grouped by station correctly
6. KDS marks items as cooking/ready
7. Verify status updates work correctly

## Verification Checklist

- [x] ORDER_SUBMITTED case added to reducer
- [x] submitted_at field added to SaleLine type
- [x] Unit tests pass (7 test cases)
- [x] Integration test created (E2E waiter → KDS)
- [ ] Manual testing: waiter → KDS flow works
- [x] No regressions in existing reducer tests
- [ ] KDS displays orders correctly after submission

## Files to Modify

1. `src/core/projections/sale.reducer.ts` - Add ORDER_SUBMITTED case
2. `src/core/projections/types.ts` - Add submitted_at field
3. `src/core/projections/__tests__/sale.reducer.order-submitted.test.ts` - New test file
4. `e2e/waiter-to-kds.spec.ts` - New E2E test

## Estimated Effort

- Implementation: 30 minutes
- Unit tests: 45 minutes
- E2E test: 30 minutes
- Manual testing: 15 minutes
- **Total: ~2 hours**

## Risk Assessment

**Low Risk** - This is a straightforward bug fix:
- Event already exists and is generated correctly
- Only adding missing reducer case
- No schema changes required
- Backward compatible (old events still work)
- Idempotent by design

## Success Criteria

1. ✅ Waiter submits order → ORDER_SUBMITTED event generated
2. ✅ Reducer processes ORDER_SUBMITTED → items marked as submitted
3. ✅ KDS screens show submitted orders immediately
4. ✅ Cashier sees orders in "Órdenes Pendientes" list
5. ✅ Items grouped by station correctly
6. ✅ All tests pass (unit + E2E)
7. ✅ No regressions in existing functionality
8. ✅ Complete flow works: Waiter → KDS → Cashier
