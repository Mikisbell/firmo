# PARK POS — Enums + Payment Model + Printing + KDS

**Versión:** 1.3  
**Fecha:** Diciembre 2025

---

## 1) Enums Definitivos

### 1.1 order_type
```typescript
type OrderType = 'DINE_IN' | 'TAKEOUT' | 'DELIVERY';
```

### 1.2 order_status
```typescript
type OrderStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
```
- `OPEN` — Recién creado, editable
- `IN_PROGRESS` — En preparación
- `DONE` — Cerrado (pagos + entrega completa)
- `CANCELLED` — Anulado

### 1.3 fulfillment_status (derivado server-side)
```typescript
type FulfillmentStatus = 'COOKING' | 'PARTIAL_READY' | 'ALL_READY';
```

### 1.4 handoff_status
```typescript
type HandoffStatus = 'WAITING' | 'PACKING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
```

### 1.5 item_status
```typescript
type ItemStatus = 'PENDING' | 'COOKING' | 'READY' | 'DONE' | 'VOIDED';
```

### 1.6 payment_status
```typescript
type PaymentStatus = 'UNPAID' | 'AUTHORIZED' | 'PAID' | 'VOIDED' | 'REFUNDED';
```

### 1.7 payment_method
```typescript
type PaymentMethod = 'CASH' | 'YAPE' | 'PLIN' | 'CARD' | 'TRANSFER' | 'APP_WALLET' | 'OTHER';
```

### 1.8 payment_expectation
```typescript
type PaymentExpectation = 'PREPAID' | 'COD';
```

### 1.9 verification_status
```typescript
type VerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';
```

### 1.10 check_mode
```typescript
type SplitMode = 'ITEMS' | 'PERCENT';
```

### 1.11 check_status
```typescript
type CheckStatus = 'OPEN' | 'LOCKED' | 'VOIDED';
```

### 1.12 delivery_status
```typescript
type DeliveryStatus = 'PENDING_ASSIGN' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'FAILED';
```

### 1.13 courier_type
```typescript
type CourierType = 'OWN' | 'APP';
```

---

## 2) Modelo de Pago por Check

### 2.1 Estructura Completa
```json
{
  "check_id": "c1",
  "name": "Juan",
  "mode": "ITEMS",
  "lines": [{"line_id":"l1","qty":1}],
  "subtotal_cents": 2500,
  "discount_cents": 0,
  "tip_cents": 0,
  "total_cents": 2500,
  "status": "OPEN",
  "payment": {
    "status": "UNPAID",
    "expectation": "PREPAID",
    "currency": "PEN",
    "payments": [],
    "paid_total_cents": 0,
    "change_cents": 0,
    "due_cents": 2500,
    "verified": {
      "status": "UNVERIFIED",
      "verified_by": null,
      "verified_at": null,
      "note": null
    },
    "timeline": {
      "created_at": "ISO",
      "paid_at": null,
      "voided_at": null,
      "refunded_at": null
    }
  }
}
```

### 2.2 Estructura de Payment Entry
```json
{
  "method": "YAPE",
  "amount_cents": 2500,
  "ref": "OP123456",
  "meta": {
    "provider": "YAPE",
    "phone_last4": "7788"
  },
  "received_at": "ISO",
  "received_by": "emp_uuid",
  "terminal_id": "CASH-01",
  "status": "RECORDED"
}
```

### 2.3 Reglas de Cálculo (server-side)
```
paid_total_cents = SUM(payments[].amount_cents WHERE status=RECORDED)
due_cents = total_cents - paid_total_cents
payment.status = due_cents <= 0 ? 'PAID' : 'UNPAID'
change_cents = method==CASH && due_cents<0 ? ABS(due_cents) : 0
```

### 2.4 Regla de Verificación
Para emitir `INVOICE_ISSUED`:
- `check.payment.status = PAID`
- Si `method IN (YAPE, PLIN, TRANSFER)`: `verified.status = VERIFIED`
- Controlado por `tenant_settings.require_payment_verification`

---

## 3) Impresión Enterprise

### 3.1 Tabla `printers`
```sql
CREATE TABLE printers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    station_code TEXT NOT NULL,
    connection_type TEXT NOT NULL,  -- USB|LAN|SERIAL
    connection JSONB NOT NULL,      -- {host, port} or {device_path}
    paper_width INTEGER DEFAULT 80,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Tabla `print_jobs`
```sql
CREATE TABLE print_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    printer_id UUID,
    job_type TEXT NOT NULL,         -- KITCHEN_TICKET|RECEIPT|PRECHECK|SHIFT_REPORT
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'QUEUED',   -- QUEUED|SENT|PRINTED|FAILED|CANCELLED
    attempts INTEGER DEFAULT 0,
    payload JSONB NOT NULL,
    order_id UUID,
    check_id TEXT,
    actor_id UUID,
    terminal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    printed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);
```

### 3.3 Payloads de Impresión

#### Kitchen Ticket
```json
{
  "template_version": 1,
  "station": "PARRILLA",
  "order": {
    "order_id": "uuid",
    "order_number": 123,
    "order_type": "DINE_IN",
    "table_number": "12"
  },
  "items": [
    {
      "line_id": "l1",
      "qty": 2,
      "name": "1/4 Pollo",
      "mods": ["Sin sal"],
      "notes": "Bien cocido"
    }
  ],
  "flags": {
    "is_rush": false,
    "is_reprint": false
  }
}
```

#### Receipt
```json
{
  "template_version": 1,
  "order": {"order_number": 123},
  "check": {
    "check_id": "c1",
    "items": [{"qty":1,"name":"1/4 Pollo","price_cents":2500}],
    "totals": {"subtotal_cents":2500,"total_cents":3000},
    "payments": [{"method":"YAPE","amount_cents":3000}]
  },
  "invoice": {
    "invoice_type": "BOLETA",
    "series": "B001",
    "number": "12345"
  }
}
```

### 3.4 Routing
| Job Type | Station |
|----------|---------|
| KITCHEN_TICKET | item.station |
| RECEIPT | CASHIER |
| SHIFT_REPORT | CASHIER |

---

## 4) Notificaciones KDS

### 4.1 Eventos KDS

| Evento | Payload |
|--------|---------|
| `KDS_NEW_ITEMS_FOR_STATION` | `{order_id, order_number, station, new_lines[], sound}` |
| `KDS_ITEM_STATUS_CHANGED` | `{order_id, line_id, station, from, to}` |
| `KDS_REPRINT_REQUESTED` | `{order_id, station, reason}` |

### 4.2 Configuración Audio (tenant_settings)
```sql
kds_audio_enabled BOOLEAN DEFAULT TRUE
kds_audio_volume INTEGER DEFAULT 80
kds_sound_profile TEXT DEFAULT 'default'
```

### 4.3 Reglas UI
- Highlight nuevos items por 10-20s
- Orden: READY → COOKING → PENDING
- Solo KITCHEN role puede cambiar status

---

## 5) Configuración Adicional (tenant_settings)

```sql
-- Pagos
require_payment_verification BOOLEAN DEFAULT FALSE
allow_cod BOOLEAN DEFAULT TRUE
default_payment_expectation_delivery TEXT DEFAULT 'PREPAID'

-- Tips
enable_tips BOOLEAN DEFAULT TRUE
tips_on_invoice BOOLEAN DEFAULT FALSE

-- KDS
kds_audio_enabled BOOLEAN DEFAULT TRUE
kds_audio_volume INTEGER DEFAULT 80
```

---

## 6) Invariantes Finales

1. ✅ Factura por check: `invoices UNIQUE (order_id, check_id)`
2. ✅ PAID si y solo si `due_cents <= 0` (server-side)
3. ✅ `unpaid_checks_count` = checks con `payment.status != PAID`
4. ✅ `stations_active` = estaciones con items no DONE/VOIDED
5. ✅ Para invoice: check PAID + verified (si aplica)
6. ✅ Nunca borrar: void/refund = eventos + flags

---

**Fin del Documento v1.3**
