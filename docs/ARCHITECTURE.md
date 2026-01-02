# PARK POS — Arquitectura Enterprise (Velocidad + Escalabilidad + Growth)

**Versión:** 1.1  
**Fecha:** Diciembre 2025  
**Estado:** ✅ Aprobado

> **Objetivo:** POS offline-first para pollería con 1 caja + 15 terminales, KDS por estación, dine-in/takeout/delivery, split bill, facturación por check, promos, reportes instantáneos, seguridad enterprise, y capa growth (WhatsApp/IA) fuera del hot path.

---

## 0) Contexto Operativo

| Aspecto | Detalle |
|---------|---------|
| **Terminales** | 15 (PC táctil/PC) para toma de pedidos |
| **KDS** | Pantalla por estación: PARRILLA, BAR, EMPAQUE... |
| **Tipos pedido** | DINE_IN, TAKEOUT, DELIVERY |
| **Pago** | Caja principal; Delivery: PREPAID (QR) recomendado + COD fallback |
| **Split bill** | Por items y/o porcentaje |
| **Comprobante** | 1 por check (boleta/factura) |
| **Delivery** | Propio (motorizados) + apps externas |
| **Direcciones** | Guardadas por cliente + snapshot por pedido |

---

## 1) Principios "Velocidad Primero"

### 1.1 Hot Path vs Cold Path

| Path | Latencia | Uso | Ejemplos |
|------|----------|-----|----------|
| **Hot** | < 50ms | Lectura frecuente | KDS, Caja, Catálogo |
| **Cold** | > 100ms | Auditoría/Reportes | Events, Marketing/IA |

**Regla:** Hot Path NO depende de JOINs ni JSONB scanning.

### 1.2 Denormalización Controlada
- `orders.items` → JSONB (0 JOINs)
- `orders.checks` → JSONB (split + pagos + totales precalculados)

### 1.3 Columnas Hot Obligatorias
```sql
orders.stations_active TEXT[]     -- KDS ultrarrápido
orders.unpaid_checks_count INT    -- Caja ultrarrápido
orders.fulfillment_status TEXT
orders.handoff_status TEXT
orders.order_status TEXT
orders.created_at TIMESTAMPTZ
```

### 1.4 Derivados: Server-Side (Política Única)
Recalculados por trigger/función:
- `stations_active`
- `unpaid_checks_count`
- `fulfillment_status`

---

## 2) Stack

| Capa | Tecnología |
|------|------------|
| Repo | GitHub |
| Front/Backend | Vercel (Next.js) |
| ORM | Prisma |
| DB Cloud | Supabase (Postgres) |
| DB Local | IndexedDB (Dexie) |

---

## 3) Arquitectura por Capas

### 3.1 DB1 — Local (IndexedDB/Dexie)
```
products_cache          -- Por catalog_version
orders_cache_today      -- Solo activos/hoy
outbox_events          -- Cola de sync
sync_cursor            -- Último evento confirmado
terminal_session       -- Terminal, station, employee
```

### 3.2 DB2 — Nube (Supabase/Postgres)
```
events, orders, products, catalog_meta, tenant_settings,
promotions, daily_sales_summary, employees, terminals, 
shifts, customers, drivers, invoices, stations

**Nota (v1.1):** Ingest API (`/api/events/ingest`) realiza **Proyección Síncrona** a estas tablas para asegurar visibilidad inmediata en BI/Admin Dashboard.
```

### 3.3 Capa Growth (Asíncrona)
- Campañas/promos WhatsApp
- Segmentación
- IA (recomendaciones/forecast)
- **No bloquea caja/KDS**

---

## 4) Seguridad Enterprise

### 4.1 Multi-Tenant
```sql
tenant_id UUID  -- En todas las tablas core
-- RLS: usuario solo ve/escribe dentro de su tenant
```

### 4.2 Auth + Roles + PIN
- Supabase Auth para identidad
- `employees` para rol y `pin_hash`
- Roles: ADMIN, MANAGER, CASHIER, WAITER, KITCHEN, DRIVER

### 4.3 Control de Terminales
```sql
terminals  -- Allowlist de dispositivos autorizados
```

### 4.4 Auditoría
```sql
-- En events siempre:
actor_id, actor_role_snapshot, terminal_id
```

---

## 5) Modelo de Datos

### 5.1 tenant_settings
```sql
CREATE TABLE tenant_settings (
    tenant_id UUID PRIMARY KEY,
    legal_name TEXT NOT NULL,
    ruc TEXT,
    address_text TEXT,
    logo_url TEXT,
    timezone TEXT DEFAULT 'America/Lima',
    currency TEXT DEFAULT 'PEN',
    receipt_footer_text TEXT,
    kds_audio_enabled BOOLEAN DEFAULT TRUE,
    default_delivery_fee_cents INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 employees
```sql
CREATE TABLE employees (
    id UUID PRIMARY KEY,  -- = auth.uid
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    pin_hash TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 terminals
```sql
CREATE TABLE terminals (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    terminal_id TEXT NOT NULL,
    station_id UUID REFERENCES stations(id),
    device_secret_hash TEXT,
    is_allowed BOOLEAN DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ,
    UNIQUE(tenant_id, terminal_id)
);
```

### 5.4 stations
```sql
CREATE TABLE stations (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(tenant_id, code)
);
```

### 5.5 products
```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT,
    price_cents INTEGER NOT NULL,
    category TEXT NOT NULL,
    station TEXT NOT NULL,
    type TEXT DEFAULT 'SIMPLE',  -- SIMPLE|COMBO
    components JSONB,
    recipe JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, sku)
);
```

### 5.6 catalog_meta
```sql
CREATE TABLE catalog_meta (
    tenant_id UUID PRIMARY KEY,
    catalog_version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.7 promotions
```sql
CREATE TABLE promotions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- PERCENT|FIXED|HAPPY_HOUR|2X1|COMBO
    value INTEGER,
    rules JSONB,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    stackable BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.8 orders
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    order_number INTEGER NOT NULL,
    order_type TEXT NOT NULL,
    order_status TEXT DEFAULT 'OPEN',
    fulfillment_status TEXT DEFAULT 'COOKING',
    handoff_status TEXT DEFAULT 'WAITING',
    stations_active TEXT[] DEFAULT '{}',
    unpaid_checks_count INTEGER DEFAULT 0,
    subtotal_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    total_cents INTEGER DEFAULT 0,
    promotion_id UUID REFERENCES promotions(id),
    promotion_snapshot JSONB,
    terminal_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    items JSONB NOT NULL DEFAULT '[]',
    checks JSONB NOT NULL DEFAULT '[]',
    fulfillment JSONB,
    delivery JSONB
);

CREATE INDEX idx_orders_active ON orders(tenant_id, order_status) 
    WHERE order_status IN ('OPEN','IN_PROGRESS');
CREATE INDEX idx_orders_unpaid ON orders(tenant_id, unpaid_checks_count) 
    WHERE unpaid_checks_count > 0;
CREATE INDEX idx_orders_stations ON orders USING GIN(stations_active);
```

### 5.9 shifts
```sql
CREATE TABLE shifts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    terminal_id TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    opened_by UUID REFERENCES employees(id),
    closed_by UUID REFERENCES employees(id),
    cash_opening_cents INTEGER NOT NULL,
    cash_expected_cents INTEGER,
    cash_counted_cents INTEGER,
    diff_cents INTEGER
);
```

### 5.10 customers
```sql
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    phone TEXT NOT NULL,
    name TEXT,
    addresses JSONB DEFAULT '[]',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, phone)
);
```

### 5.11 drivers
```sql
CREATE TABLE drivers (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE
);
```

### 5.12 invoices
```sql
CREATE TABLE invoices (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL,
    check_id TEXT NOT NULL,
    invoice_type TEXT NOT NULL,
    series TEXT,
    invoice_number TEXT,
    customer_doc_type TEXT,
    customer_doc TEXT,
    total_cents INTEGER NOT NULL,
    payment_summary JSONB,
    status TEXT DEFAULT 'ISSUED',
    void_reason TEXT,
    voided_by UUID,
    voided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, order_id, check_id),
    UNIQUE(tenant_id, series, invoice_number)
);
```

### 5.13 daily_sales_summary
```sql
CREATE TABLE daily_sales_summary (
    tenant_id UUID NOT NULL,
    business_date DATE NOT NULL,
    gross_sales_cents INTEGER DEFAULT 0,
    net_sales_cents INTEGER DEFAULT 0,
    discount_cents INTEGER DEFAULT 0,
    tips_cents INTEGER DEFAULT 0,
    delivery_fee_cents INTEGER DEFAULT 0,
    voids_cents INTEGER DEFAULT 0,
    refunds_cents INTEGER DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    checks_count INTEGER DEFAULT 0,
    payments_breakdown JSONB,
    PRIMARY KEY(tenant_id, business_date)
);
```

### 5.14 events
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    actor_id UUID,
    actor_role_snapshot TEXT,
    terminal_id TEXT NOT NULL,
    payload JSONB NOT NULL
);

CREATE INDEX idx_events_tenant_time ON events(tenant_id, occurred_at DESC);
CREATE INDEX idx_events_entity ON events(tenant_id, entity_id);
```

---

## 6) Contratos JSONB

### 6.1 orders.items
```json
[
  {
    "line_id": "l1",
    "product_id": "p1",
    "sku": "pollo_1_4",
    "name": "1/4 Pollo",
    "short_name": "1/4 P",
    "qty": 2,
    "unit_price_cents": 2500,
    "station": "PARRILLA",
    "status": "COOKING",
    "mods": ["Sin sal"],
    "notes": "Bien cocido",
    "added_at": "ISO",
    "void": null
  }
]
```
**Estados:** PENDING → COOKING → READY → DONE | VOIDED

### 6.2 orders.checks
```json
[
  {
    "check_id": "c1",
    "name": "Juan",
    "mode": "ITEMS",
    "lines": [{"line_id":"l1","qty":1}],
    "subtotal_cents": 2500,
    "discount_cents": 0,
    "tip_cents": 0,
    "total_cents": 2500,
    "payment": {
      "status": "UNPAID",
      "payments": []
    }
  }
]
```

### 6.3 orders.fulfillment
```json
// DINE_IN
{"table_number":"12","guest_count":4}

// TAKEOUT
{"pickup_name":"Carlos","pickup_phone":"+51...","eta_minutes":15}
```

### 6.4 orders.delivery
```json
{
  "courier_type": "OWN",
  "delivery_fee_cents": 500,
  "assigned_driver_id": "d1",
  "delivery_status": "ASSIGNED",
  "payment_expectation": "PREPAID",
  "address_snapshot": {"addr_id":"a1","address_text":"...","reference":"..."}
}
```

---

## 7) Estados y Reglas

### 7.1 fulfillment_status (server-side)
- **COOKING:** Ningún item READY
- **PARTIAL_READY:** Al menos 1 READY
- **ALL_READY:** Todos READY/DONE/VOIDED

### 7.2 stations_active (server-side)
- Array de estaciones con items no DONE/VOIDED
- KDS: `WHERE 'PARRILLA' = ANY(stations_active)`

### 7.3 Cierre del pedido
```
order_status = DONE cuando:
  unpaid_checks_count = 0 AND
  entrega completada según order_type
```

---

## 8) Promociones

### Flujo
1. **Terminal:** Sugiere/aplica tentativo
2. **Caja (server-side):** Valida y aplica final
3. **Snapshot:** `promotion_snapshot` guarda estado al momento de aplicar

---

## 9) Anulaciones/Devoluciones

### Antes de Facturar
```json
"void": {"reason":"...", "voided_by":"emp1", "voided_at":"ISO"}
```

### Después de Facturar
- `invoice.status = VOIDED|REFUNDED`
- Evento `INVOICE_VOIDED`

---

## 10) Impresión Térmica

### Print Server Local (Recomendado)
- Servicio en PC caja que recibe jobs HTTP/WS
- Imprime ESC/POS a térmicas
- Maneja reintentos y colas

---

## 11) Notificaciones KDS

- Escucha cambios por canal WS/eventos
- Sonido si `tenant_settings.kds_audio_enabled = true`
- Highlight "nuevo" por 10-20s

---

## 12) Lista Final de Tablas

### Core (14)
1. events
2. orders
3. products
4. catalog_meta
5. stations
6. employees
7. terminals
8. shifts
9. customers
10. drivers
11. invoices
12. tenant_settings
13. promotions
14. daily_sales_summary

### Opcional/Futuro
15. inventory
16. inventory_log
17. tables
18. reservations
19. marketing_*
20. loyalty/gift_cards

---

## 13) Checklist de Implementación

1. ☐ Tablas P0: tenant_settings, employees, terminals, stations
2. ☐ products + catalog_meta
3. ☐ orders + triggers derivados (✅ Proyección Síncrona)
4. ☐ promotions + función validate/apply
5. ✅ invoices (por check)
6. ✅ shifts (Proyección Síncrona)
7. ☐ daily_sales_summary (job)
8. ☐ Print server
9. ☐ Notificaciones KDS
10. ☐ Growth (WhatsApp/IA) asíncrono

---

**Fin del Documento v1.1**
