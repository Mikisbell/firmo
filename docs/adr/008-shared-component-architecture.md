# ADR-008: Shared Component Architecture for Multi-Role POS

**Status:** Accepted  
**Date:** 2026-01-05  
**Author:** Arquitecto de Software

## Context

PARK POS serves multiple user roles (Cajera, Mozo, Cocina/Bar) through different UI interfaces. Initially, each role had independent component implementations, leading to:

- Duplicate code for rendering order items
- Inconsistent behavior between roles
- Higher maintenance burden

## Decision

Implement a **hybrid shared component architecture**:

1. **Shared Logic Layer** (100% DRY):
   - `src/core/actions/POSActions` - Event dispatching
   - `src/core/projections/` - State management
   - `src/core/domain/` - Types and utilities

2. **Shared UI Components** (Reusable):
   - `src/components/shared/LineItem.tsx` - Item rendering
   - `src/components/shared/OrderPanel.tsx` - Order sidebar with `mode` prop

3. **Role-Specific Components** (Differentiated UX):
   - `CheckDetail.tsx` (Caja) - Ticket paper style, split bill, invoices
   - `OrderPanel` with `mode="waiter"` - Dark UI, send to kitchen
   - `KDSCard.tsx` (Cocina) - Kanban-style ticket cards

### Mode-Based Rendering Pattern

```typescript
// OrderPanel accepts mode to determine which actions are visible
<OrderPanel 
    mode="waiter"  // or "cashier"
    items={...}
    onSendToKitchen={...}  // Only shown for waiter
    onPayCash={...}        // Only shown for cashier
/>
```

## Rationale

### Why not fully unify CheckDetail and OrderPanel?

| Factor | CheckDetail (Caja) | OrderPanel (Mozo) |
|--------|-------------------|-------------------|
| Background | White (ticket paper) | Dark (low-light visibility) |
| Features | Split bill, AI recs | Quick send, QR |
| User Context | Seated at counter | Walking between tables |

Forcing visual unification would degrade UX for one or both roles.

### Why share LineItem but not full components?

`LineItem` is pure presentation logic (name, qty, price, buttons). It has no role-specific behavior, making it safe to share.

## Consequences

### Positive
- **Reduced duplication:** ~40% less code for item rendering
- **Consistent behavior:** Same POSActions used everywhere
- **Easy maintenance:** Change LineItem once → updates everywhere

### Negative
- **Two sidebar components:** CheckDetail and OrderPanel coexist
- **Learning curve:** Developers must understand when to use which

### Mitigations
- Document role → component mapping in `roles-modules.md`
- Use `mode` prop pattern for future shared components

## File Structure

```
src/
├── components/
│   └── shared/
│       ├── index.ts          # Exports
│       ├── LineItem.tsx      # Shared item component
│       └── OrderPanel.tsx    # Mode-based order panel
│
├── app/
│   ├── (pos)/
│   │   └── components/
│   │       ├── CheckDetail.tsx    # Caja-specific
│   │       ├── PaymentModal.tsx
│   │       └── InvoiceModal.tsx
│   │
│   ├── waiter/
│   │   └── order/[tableId]/
│   │       └── page.tsx           # Uses OrderPanel(mode="waiter")
│   │
│   └── kds/
│       └── page.tsx               # Uses KDSCard (station-filtered)
```

## Related

- ADR-007: Hybrid Cloud Ingest Security
- ADR-006: Offline-First Architecture
