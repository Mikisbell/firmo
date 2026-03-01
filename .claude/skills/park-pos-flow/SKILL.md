---
name: park-pos-flow
description: >
  PARK POS transaction flow: order lifecycle, POSActions, payments, shifts.
  Trigger: When working with POS, orders, payments, checks, shifts, or caja.
license: MIT
metadata:
  author: park-pos-team
  version: "1.0"
---

## Order Lifecycle (Event Sequence)

```
SHIFT_OPENED
  └→ ORDER_CREATED (generates order_number from range allocator)
       ├→ ORDER_ITEM_ADDED (one per product)
       ├→ ORDER_ITEM_QTY_CHANGED
       ├→ ORDER_SUBMITTED (to kitchen)
       │    └→ ORDER_ITEM_STATUS_CHANGED (PENDING → COOKING → READY → DELIVERED)
       ├→ ORDER_COURSE_FIRED
       ├→ REQUEST_CHECK
       ├→ CHECK_CREATED
       ├→ CHECK_PAYMENT_ADDED (CASH | CARD | YAPE | PLIN | TRANSFER)
       ├→ CHECK_TIP_SET (optional)
       ├→ CHECK_MARKED_PAID (closes check, records change_cents)
       ├→ INVOICE_ISSUED (BOLETA | FACTURA)
       ├→ REFUND_ISSUED (partial or full)
       └→ ORDER_CANCELLED
SHIFT_CLOSED
```

## POSActions (Client-Side)

File: `src/core/actions/pos.actions.ts`

Every action: `appendEvent()` → Dexie insert → `getSyncClient().start()`

```typescript
// Full lifecycle
const { order_id, check_id } = await POSActions.createOrder(
  tenant, terminal, actor, { order_type: 'DINE_IN', order_number: 42 }
);
await POSActions.addItem(tenant, terminal, actor, order_id, {
  product_id, sku, name, unit_price_cents, station
});
await POSActions.submitToKitchen(tenant, terminal, actor, order_id, items);
await POSActions.addPayment(tenant, terminal, actor, order_id, check_id, {
  method: 'CASH', amount_cents: 2500  // S/. 25.00
});
await POSActions.markCheckPaid(tenant, terminal, actor, order_id, check_id, change_cents);
await POSActions.issueInvoice(tenant, terminal, actor, order_id, check_id, 'BOLETA', total);
```

**Result pattern** (addPayment, issueRefund):
```typescript
const result = await POSActions.addPayment(...);
if (!result.success) { showError(result.error); return; }
```

## appendEvent Internals

1. Get next `terminal_sequence` from Dexie: `db.events.orderBy("terminal_sequence").last()`
2. Stamp: `occurred_at`, `schema_version: 1`, `payload_version: 1`, `synced: 0`
3. Insert into `db.events` (Dexie/IndexedDB)
4. Trigger sync: `getSyncClient().start()`

## Order Number Range Allocator

File: `src/app/api/terminals/range/route.ts`

```
Terminal requests range:
  GET  /api/terminals/range?terminal_id=&tenant_id=
  POST /api/terminals/range { action: 'allocate' }  → assigns range_start..range_end
  POST /api/terminals/range { action: 'extend' }    → extends range when < 100 remaining
  POST /api/terminals/range { action: 'next' }      → increments current_number, returns it
```

Order numbers are **persistent per terminal** — survives offline/restart.

## Money Rules

- ALL amounts in **centavos** (integer): `2500` = S/. 25.00
- Branded type: `Centavos` from `@/src/core/types/shared`
- Helper: `unsafeCentavos(n)` to brand
- Zod: `z.number().int().nonnegative()`
- **NEVER** use float/decimal for money

## Shift Rules

- `SHIFT_OPENED` required before any order operations
- `SHIFT_CLOSED` finalizes all pending operations
- `requireOpenShift` middleware enforces on payment routes
- One open shift per terminal at a time

## Anti-Patterns

- Creating orders without SHIFT_OPENED → rejected by business rules
- Using `Math.round(price * 1.18)` for IGV → use integer arithmetic on cents
- Hardcoding order numbers → use range allocator
- Skipping CHECK_MARKED_PAID → check stays open, shift can't close cleanly
