# FIRMO POS — Coupons & Redemptions + Anti-Fraud

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

## 5) Role-Based Event Validation

### 5.1 Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso completo a todos los eventos |
| `MANAGER` | Todo excepto catálogo |
| `CASHIER` | Turnos, órdenes, pagos, facturas |
| `WAITER` | Crear órdenes, agregar items, NO pagos |
| `KITCHEN` | Solo cambiar estado de items |
| `DRIVER` | Solo cambiar estado de items (delivery) |

### 5.2 Permisos por Rol

#### ADMIN
Acceso completo a todos los eventos del sistema.

#### MANAGER
```
SHIFT_OPENED, SHIFT_CLOSED, CASH_ADJUSTED
ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_QTY_CHANGED
ORDER_ITEM_STATUS_CHANGED, ORDER_ITEM_VOIDED, ORDER_CANCELLED
CHECK_CREATED, CHECK_PAYMENT_ADDED, CHECK_MARKED_PAID
CHECK_TIP_SET, CHECK_ITEMS_UPDATED, CHECK_ITEMS_MOVED
INVOICE_ISSUED, INVOICE_VOIDED
```

#### CASHIER
```
SHIFT_OPENED, SHIFT_CLOSED, CASH_ADJUSTED
ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_QTY_CHANGED
ORDER_ITEM_STATUS_CHANGED
CHECK_CREATED, CHECK_PAYMENT_ADDED, CHECK_MARKED_PAID
CHECK_TIP_SET, CHECK_ITEMS_UPDATED, CHECK_ITEMS_MOVED
INVOICE_ISSUED
```

#### WAITER
```
ORDER_CREATED, ORDER_ITEM_ADDED, ORDER_ITEM_QTY_CHANGED
ORDER_ITEM_STATUS_CHANGED
CHECK_CREATED, CHECK_ITEMS_UPDATED, CHECK_ITEMS_MOVED
CHECK_TIP_SET
```

#### KITCHEN / DRIVER
```
ORDER_ITEM_STATUS_CHANGED
```

### 5.3 Eventos que Requieren Aprobación de Manager

| Evento | Descripción |
|--------|-------------|
| `ORDER_ITEM_VOIDED` | Anular item de orden |
| `ORDER_CANCELLED` | Cancelar orden completa |
| `INVOICE_VOIDED` | Anular factura emitida |
| `CASH_ADJUSTED` | Ajuste de caja |

**Regla:** Si el actor no es MANAGER/ADMIN, debe incluir `approved_by` con UUID de un manager activo.

### 5.4 Implementación

```typescript
// src/core/validation/role-permissions.ts
import { canRoleEmitEvent, requiresManagerApproval } from '@/src/core/validation';

// Validar si rol puede emitir evento
const result = canRoleEmitEvent('WAITER', 'CHECK_PAYMENT_ADDED');
// { allowed: false, error: 'ROLE_NOT_AUTHORIZED', details: {...} }

// Verificar si requiere aprobación
const needsApproval = requiresManagerApproval('ORDER_ITEM_VOIDED');
// true
```

### 5.5 Errores de Validación

| Error | Descripción |
|-------|-------------|
| `ROLE_REQUIRED` | Evento requiere actor_role_snapshot |
| `INVALID_ROLE` | Rol no reconocido |
| `ROLE_NOT_AUTHORIZED` | Rol no puede emitir este evento |
| `MANAGER_APPROVAL_REQUIRED` | Falta approved_by para acción peligrosa |
| `APPROVER_NOT_FOUND` | approved_by no existe o inactivo |
| `APPROVER_NOT_AUTHORIZED` | approved_by no es MANAGER/ADMIN |

### 5.6 Eventos de Sistema

`CATALOG_VERSION_BUMPED` no requiere rol (evento de sistema).

---

## 5.7) Autenticación JWT y Seguridad de Sesiones

### 5.7.1 Arquitectura de Autenticación

```
┌─────────────┐     POST /api/auth/session     ┌─────────────┐
│   PinModal  │ ─────────────────────────────► │  Auth API   │
│  (Frontend) │                                │             │
│             │ ◄───────────────────────────── │  - Lockout  │
│             │     { token, employee }        │  - JWT      │
└─────────────┘                                │  - Session  │
       │                                       └─────────────┘
       │ Bearer token                                │
       ▼                                             ▼
┌─────────────┐                              ┌─────────────┐
│ localStorage│                              │  PostgreSQL │
│ park_pos_   │                              │  - Session  │
│ auth_token  │                              │  - Attempts │
└─────────────┘                              │  - AuditLog │
                                             └─────────────┘
```

### 5.7.2 Protección contra Fuerza Bruta

| Configuración | Valor |
|---------------|-------|
| Intentos máximos | 3 |
| Duración lockout | 5 minutos |
| Duración sesión | 30 minutos |
| Inactividad máxima | 15 minutos |

### 5.7.3 Tablas de Seguridad

```sql
-- Intentos de login (para lockout)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    employee_id UUID,
    pin_hash TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    terminal_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Log de acceso admin (auditoría)
CREATE TABLE admin_access_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    action TEXT NOT NULL,  -- LOGIN|LOGOUT|ACCESS_DENIED|SESSION_EXPIRED
    resource TEXT,
    ip_address TEXT,
    user_agent TEXT,
    terminal_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sesiones activas
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    employee_id UUID NOT NULL,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    terminal_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.7.4 Flujo de Autenticación

```typescript
// 1. Login con PIN
const response = await fetch('/api/auth/session', {
    method: 'POST',
    body: JSON.stringify({ pin: '1234', allowedRoles: ['ADMIN', 'MANAGER'] })
});
// → { token: 'eyJ...', employee: {...}, expiresAt: '...' }

// 2. Validar sesión
const session = await fetch('/api/auth/session', {
    headers: { Authorization: `Bearer ${token}` }
});
// → { valid: true, employee: {...} }

// 3. Logout
await fetch('/api/auth/session', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
});
```

### 5.7.5 Errores de Autenticación

| Código | Descripción |
|--------|-------------|
| `INVALID_PIN` | PIN no encontrado |
| `ACCOUNT_LOCKED` | Cuenta bloqueada por intentos fallidos |
| `ROLE_NOT_ALLOWED` | Rol no autorizado para la operación |
| `INACTIVE_EMPLOYEE` | Empleado desactivado |

### 5.7.6 Archivos Relacionados

| Archivo | Propósito |
|---------|-----------|
| `src/core/auth/auth.service.ts` | Servicio de autenticación |
| `src/app/api/auth/session/route.ts` | API de sesiones |
| `src/components/inventory/PinModal.tsx` | Modal de PIN con lockout |

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
