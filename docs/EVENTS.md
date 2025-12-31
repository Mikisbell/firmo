# PARK POS — Event Contracts & Triggers

**Versión:** 1.0  
**Fecha:** Diciembre 2025

---

## A) Contrato de Eventos

### A1) Envelope Estándar (Estructura fija)

```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,                    -- Idempotencia
    tenant_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,       -- Hora real del terminal
    received_at TIMESTAMPTZ DEFAULT NOW(),  -- Hora en servidor
    type TEXT NOT NULL,
    entity_type TEXT NOT NULL,              -- order|product|customer|shift|invoice
    entity_id UUID,
    actor_id UUID,                          -- Employee
    actor_role_snapshot TEXT,
    terminal_id TEXT NOT NULL,
    shift_id UUID,
    payload_version INTEGER DEFAULT 1,
    payload JSONB NOT NULL
);
```

**Reglas:**
- `id` único → Si llega repetido, se ignora (idempotente)
- Eventos de `order` incluyen `order_revision` monótono

---

### A2) Catálogo de Eventos

#### Grupo 1: Órdenes

| Evento | Payload |
|--------|---------|
| `ORDER_CREATED` | `{order_id, order_number, order_type, items, checks, fulfillment, promotion_id}` |
| `ORDER_UPDATED` | `{order_id, patch: {...}, reason}` |
| `ORDER_CANCELLED` | `{order_id, reason, approved_by?}` |

#### Grupo 2: Items (KDS)

| Evento | Payload |
|--------|---------|
| `ORDER_ITEM_ADDED` | `{order_id, line: {line_id, product_id, sku, name, qty, unit_price_cents, station, mods, notes}}` |
| `ORDER_ITEM_QTY_CHANGED` | `{order_id, line_id, from_qty, to_qty}` |
| `ORDER_ITEM_STATUS_CHANGED` | `{order_id, line_id, from, to, station}` |
| `ORDER_ITEM_VOIDED` | `{order_id, line_id, reason, approved_by}` |

#### Grupo 3: Split Bill (Checks)

| Evento | Payload |
|--------|---------|
| `CHECK_CREATED` | `{order_id, check: {check_id, name}}` |
| `CHECK_SPLIT_ITEMS_SET` | `{order_id, check_id, mode:"ITEMS", lines:[{line_id, qty}]}` |
| `CHECK_SPLIT_PERCENT_SET` | `{order_id, check_id, mode:"PERCENT", percent}` |
| `CHECK_TIP_SET` | `{order_id, check_id, tip_cents}` |

#### Grupo 4: Pagos

| Evento | Payload |
|--------|---------|
| `CHECK_PAYMENT_ADDED` | `{order_id, check_id, payment: {method, amount_cents, ref?}}` |
| `CHECK_MARKED_PAID` | `{order_id, check_id, paid_at, change_cents}` |
| `CHECK_PAYMENT_VOIDED` | `{order_id, check_id, reason, approved_by}` |

#### Grupo 5: Promociones

| Evento | Payload |
|--------|---------|
| `PROMOTION_APPLIED_TENTATIVE` | `{order_id, promotion_id, source:"ORDER_SCREEN"}` |
| `PROMOTION_VALIDATED_APPLIED` | `{order_id, promotion_id, promotion_snapshot, recalculated_totals}` |
| `PROMOTION_REMOVED` | `{order_id, reason}` |

#### Grupo 6: Entrega

| Evento | Payload |
|--------|---------|
| `DELIVERY_ASSIGNED` | `{order_id, driver_id, courier_type, app_name?}` |
| `DELIVERY_STATUS_CHANGED` | `{order_id, from, to}` |
| `HANDOFF_STATUS_CHANGED` | `{order_id, from, to}` |

#### Grupo 7: Facturación

| Evento | Payload |
|--------|---------|
| `INVOICE_ISSUED` | `{order_id, check_id, invoice_id, invoice_type, series, invoice_number, total_cents}` |
| `INVOICE_VOIDED` | `{invoice_id, reason, approved_by}` |
| `REFUND_ISSUED` | `{invoice_id, amount_cents, reason}` |

#### Grupo 8: Caja (Shifts)

| Evento | Payload |
|--------|---------|
| `SHIFT_OPENED` | `{shift_id, terminal_id, cash_opening_cents}` |
| `SHIFT_CLOSED` | `{shift_id, cash_counted_cents, notes?}` |
| `CASH_ADJUSTED` | `{shift_id, delta_cents, reason}` |

#### Grupo 9: Catálogo

| Evento | Payload |
|--------|---------|
| `CATALOG_VERSION_BUMPED` | `{catalog_version, reason}` |
| `PRODUCT_UPSERTED` | `{product_id, changes: {...}}` |

---

## B) Triggers y Funciones

### B1) Función Maestra: recompute_order_derived

```sql
CREATE OR REPLACE FUNCTION recompute_order_derived(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_items JSONB;
  v_checks JSONB;
  v_stations TEXT[];
  v_unpaid INT;
  v_any_ready BOOLEAN;
  v_all_ready BOOLEAN;
BEGIN
  SELECT items, checks INTO v_items, v_checks
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- 1) stations_active
  SELECT ARRAY_AGG(DISTINCT (it->>'station'))
  INTO v_stations
  FROM jsonb_array_elements(v_items) it
  WHERE COALESCE(it->>'status','') NOT IN ('DONE','VOIDED')
    AND COALESCE(it->>'station','') <> '';

  -- 2) fulfillment_status
  SELECT
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_items) it
      WHERE it->>'status' = 'READY'
    ),
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_items) it
      WHERE COALESCE(it->>'status','') NOT IN ('READY','DONE','VOIDED')
    )
  INTO v_any_ready, v_all_ready;

  -- 3) unpaid_checks_count
  SELECT COUNT(*)
  INTO v_unpaid
  FROM jsonb_array_elements(v_checks) ck
  WHERE COALESCE(ck #>> '{payment,status}', 'UNPAID') <> 'PAID';

  UPDATE orders
  SET
    stations_active = COALESCE(v_stations, '{}'::TEXT[]),
    fulfillment_status = CASE
      WHEN v_all_ready THEN 'ALL_READY'
      WHEN v_any_ready THEN 'PARTIAL_READY'
      ELSE 'COOKING'
    END,
    unpaid_checks_count = v_unpaid,
    updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;
```

### B2) Trigger para Recalcular

```sql
CREATE OR REPLACE FUNCTION trg_orders_recompute()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM recompute_order_derived(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_recompute_after_update
AFTER UPDATE OF items, checks, promotion_id, promotion_snapshot, delivery
ON orders
FOR EACH ROW
EXECUTE FUNCTION trg_orders_recompute();
```

### B3) Validación de Factura

```sql
CREATE OR REPLACE FUNCTION validate_invoice_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_checks JSONB;
  v_paid TEXT;
BEGIN
  SELECT checks INTO v_checks
  FROM orders
  WHERE id = NEW.order_id
  FOR UPDATE;

  SELECT ck #>> '{payment,status}'
  INTO v_paid
  FROM jsonb_array_elements(v_checks) ck
  WHERE ck->>'check_id' = NEW.check_id
  LIMIT 1;

  IF v_paid IS NULL THEN
    RAISE EXCEPTION 'Check not found in order';
  END IF;

  IF v_paid <> 'PAID' THEN
    RAISE EXCEPTION 'Cannot issue invoice for unpaid check';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_validate_before_insert
BEFORE INSERT ON invoices
FOR EACH ROW
EXECUTE FUNCTION validate_invoice_before_insert();
```

---

## C) Invariantes (Reglas Inquebrantables)

1. ✅ `events.id` único → Idempotencia real
2. ✅ `orders.unpaid_checks_count` = conteo real server-side
3. ✅ `orders.stations_active` refleja items no DONE/VOIDED
4. ✅ No invoice si check no está PAID
5. ✅ Promoción "final" solo en caja con snapshot inmutable
6. ✅ Nunca borrar: void/refund = eventos + flags

---

## D) Enums Sugeridos

```typescript
// order_type
type OrderType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';

// order_status
type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

// fulfillment_status
type FulfillmentStatus = 'COOKING' | 'PARTIAL_READY' | 'ALL_READY';

// handoff_status
type HandoffStatus = 'WAITING' | 'PACKING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED';

// item_status
type ItemStatus = 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED';

// payment_status
type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

// payment_method
type PaymentMethod = 'CASH' | 'CARD' | 'YAPE' | 'PLIN' | 'TRANSFER';

// invoice_type
type InvoiceType = 'BOLETA' | 'FACTURA';

// invoice_status
type InvoiceStatus = 'ISSUED' | 'VOIDED' | 'REFUNDED';

// promotion_type
type PromotionType = 'PERCENT' | 'FIXED' | 'HAPPY_HOUR' | '2X1' | 'COMBO';

// split_mode
type SplitMode = 'ITEMS' | 'PERCENT';

// payment_expectation (delivery)
type PaymentExpectation = 'PREPAID' | 'COD';
```

---

**Fin del Documento**
