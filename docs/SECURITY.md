# PARK POS — Coupons & Redemptions + Anti-Fraud

**Versión:** 1.0  
**Fecha:** Diciembre 2025

---

# Parte 1: Modelo de Redenciones

## 1) Objetivos

- Evitar doble uso de cupones (online y offline)
- Soportar cupones públicos, personalizados, y de campaña
- Auditar todo: emisión, reserva, redención, cancelación

---

## 2) Tablas

### 2.1 coupons
```sql
CREATE TABLE coupons (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    promotion_id UUID,
    customer_id UUID,                    -- Si personalizado
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',        -- ACTIVE|RESERVED|REDEEMED|EXPIRED|VOIDED
    reserved_at TIMESTAMPTZ,
    reserved_by_terminal_id TEXT,
    redeemed_at TIMESTAMPTZ,
    redeemed_order_id UUID,
    redeemed_check_id TEXT,
    void_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_coupons_status ON coupons(tenant_id, status, expires_at);
CREATE INDEX idx_coupons_customer ON coupons(tenant_id, customer_id, status);
```

### 2.2 coupon_redemptions (ledger append-only)
```sql
CREATE TABLE coupon_redemptions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    coupon_id UUID NOT NULL,
    code TEXT NOT NULL,
    action TEXT NOT NULL,                -- ISSUED|RESERVED|RESERVE_CANCELLED|REDEEMED|VOIDED
    order_id UUID,
    check_id TEXT,
    actor_id UUID,
    terminal_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB
);

CREATE INDEX idx_redemptions_coupon ON coupon_redemptions(tenant_id, coupon_id, occurred_at DESC);
```

---

## 3) Flujo de Estados

```
ACTIVE → RESERVED → REDEEMED
           ↓
   RESERVE_CANCELLED (TTL)
           
VOIDED / EXPIRED (terminales)
```

---

## 4) Reserva (Crítico para Offline)

### Online
```sql
-- Transacción
SELECT * FROM coupons WHERE tenant_id = $1 AND code = $2 FOR UPDATE;
-- Validar status=ACTIVE, expires_at
UPDATE coupons SET status='RESERVED', reserved_at=NOW(), reserved_by_terminal_id=$3;
INSERT INTO coupon_redemptions(action='RESERVED', ...);
```

### Offline
- Terminal marca `PENDING_RESERVE` local
- Al reconectar: intenta confirmar
- Si falla: crea `sync_conflicts`

### TTL
- Reserva expira en 15 min
- Job libera: `status=ACTIVE`, log `RESERVE_CANCELLED(TTL_EXPIRED)`

---

## 5) Redención

**Regla:** Cupón se consume al emitir `INVOICE_ISSUED`

```sql
-- Lock cupón
-- Verificar status IN (ACTIVE, RESERVED)
UPDATE coupons SET status='REDEEMED', redeemed_at=NOW(), redeemed_order_id=$1, redeemed_check_id=$2;
INSERT INTO coupon_redemptions(action='REDEEMED', ...);
```

---

## 6) Eventos

| Evento | Payload |
|--------|---------|
| `COUPON_RESERVED` | `{coupon_code, order_id}` |
| `COUPON_RESERVE_CANCELLED` | `{coupon_code, reason}` |
| `COUPON_REDEEMED` | `{coupon_code, order_id, check_id}` |
| `COUPON_VOIDED` | `{coupon_code, reason}` |

---

# Parte 2: Anti-Fraude

## 1) Amenazas

| Amenaza | Control |
|---------|---------|
| Terminal no autorizada | `terminals.is_allowed` |
| Replay de eventos | Firma HMAC + idempotencia |
| Edición offline maliciosa | Server recalcula todo |
| Cupón doble uso | Reserva + reconciliación |
| Void/refund sin permiso | Roles MANAGER/ADMIN |

---

## 2) Firma HMAC por Terminal

### En cada evento
```json
{
  "sig": {
    "payload_hash": "sha256(...)",
    "signature": "hmac_sha256(device_secret, terminal_id + event_id + payload_hash + occurred_at)",
    "algo": "HMAC-SHA256",
    "v": 1
  }
}
```

### Validación Server
1. Busca terminal
2. Valida `is_allowed`
3. Valida firma
4. Si falla: rechaza + log `SECURITY_EVENT_REJECTED`

---

## 3) Tabla sync_conflicts

```sql
CREATE TABLE sync_conflicts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    entity_type TEXT NOT NULL,           -- coupon|order|payment
    entity_id UUID,
    severity TEXT DEFAULT 'WARN',        -- INFO|WARN|BLOCKING
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB NOT NULL,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    resolution JSONB
);
```

**Ejemplo details:**
```json
{
  "type": "COUPON_ALREADY_REDEEMED",
  "coupon_code": "CUMPLE10",
  "local_order_id": "...",
  "server_order_id": "...",
  "recommended_actions": ["REMOVE_PROMO", "CHARGE_DIFFERENCE", "MANAGER_OVERRIDE"]
}
```

---

## 4) Anti-Replay: orders.revision

```sql
ALTER TABLE orders ADD COLUMN revision INTEGER DEFAULT 0;
```

### Regla
```
Evento aceptado solo si:
  event.order_revision = orders.revision + 1
```

---

## 5) Roles para Operaciones Peligrosas

| Acción | Rol Requerido |
|--------|---------------|
| `ITEM_VOIDED` | MANAGER, ADMIN |
| `CHECK_PAYMENT_VOIDED` | MANAGER, ADMIN |
| `INVOICE_VOIDED` | MANAGER, ADMIN |
| `REFUND_ISSUED` | MANAGER, ADMIN |
| `COUPON_VOIDED` | MANAGER, ADMIN |

---

## 6) Configuración tenant_settings

```sql
allow_offline_coupon BOOLEAN DEFAULT FALSE
max_offline_coupons_per_order INTEGER DEFAULT 1
require_manager_for_offline_coupon BOOLEAN DEFAULT TRUE
```

---

## 7) Resumen de Tablas Nuevas

| Tabla | Propósito |
|-------|-----------|
| coupons | Estado de cupones |
| coupon_redemptions | Ledger de acciones |
| sync_conflicts | Conflictos offline |

---

**Fin del Documento v1.0**
