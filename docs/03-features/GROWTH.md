# FIRMO POS — Growth Engine 2025 (WhatsApp + IA + Segmentación)

**Versión:** 1.4  
**Fecha:** Diciembre 2025

> **Principio clave:** Todo Growth es asíncrono. Nunca bloquea caja/KDS.

---

## 1) Objetivos Growth

| Objetivo | Descripción |
|----------|-------------|
| **Cumpleaños** | Cupón automático + WhatsApp |
| **Reactivación** | "30 días sin compra" + oferta |
| **Upsell** | Sugerencias en caja (IA) sin afectar performance |
| **Segmentación** | VIP, high frequency, delivery lovers |
| **Promos dinámicas** | IA sugiere, admin aprueba |

---

## 2) Tablas Growth

### 2.1 customer_profile
```sql
CREATE TABLE customer_profile (
    tenant_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    orders_count INTEGER DEFAULT 0,
    invoices_count INTEGER DEFAULT 0,
    lifetime_value_cents INTEGER DEFAULT 0,
    avg_ticket_cents INTEGER DEFAULT 0,
    favorite_order_type TEXT,
    favorite_products JSONB,
    recency_days INTEGER,
    frequency_30d INTEGER,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(tenant_id, customer_id)
);
```

### 2.2 marketing_segments
```sql
CREATE TABLE marketing_segments (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Ejemplo definition:**
```json
{
  "all": [
    {"field":"recency_days","op":">=","value":30},
    {"field":"lifetime_value_cents","op":">=","value":50000}
  ]
}
```

### 2.3 segment_members (materializado)
```sql
CREATE TABLE segment_members (
    tenant_id UUID NOT NULL,
    segment_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(tenant_id, segment_id, customer_id)
);
```

### 2.4 marketing_campaigns
```sql
CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    channel TEXT NOT NULL,          -- WHATSAPP|SMS|EMAIL|IN_APP
    segment_id UUID,
    message_template_id UUID,
    offer JSONB,
    schedule JSONB,
    status TEXT DEFAULT 'DRAFT',    -- DRAFT|SCHEDULED|RUNNING|PAUSED|COMPLETED
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.5 message_templates
```sql
CREATE TABLE message_templates (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    channel TEXT NOT NULL,
    name TEXT NOT NULL,
    language TEXT DEFAULT 'es_PE',
    template_key TEXT,
    content TEXT NOT NULL,
    variables_schema JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Ejemplo content:**
```
Hola {{name}} 🎉 por tu cumple tienes {{coupon}} con {{discount}}% hasta {{expires}}.
```

### 2.6 message_outbox
```sql
CREATE TABLE message_outbox (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    channel TEXT NOT NULL,
    customer_id UUID,
    to_phone TEXT NOT NULL,
    campaign_id UUID,
    template_id UUID,
    payload JSONB NOT NULL,
    status TEXT DEFAULT 'QUEUED',   -- QUEUED|SENT|DELIVERED|FAILED|CANCELLED
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    provider_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbox_queue ON message_outbox(tenant_id, status, scheduled_at);
```

### 2.7 coupons
```sql
CREATE TABLE coupons (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    code TEXT NOT NULL,
    promotion_id UUID,
    customer_id UUID,               -- Si es personalizado
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'ACTIVE',   -- ACTIVE|REDEEMED|EXPIRED|VOIDED
    UNIQUE(tenant_id, code)
);
```

### 2.8 ai_suggestions
```sql
CREATE TABLE ai_suggestions (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    type TEXT NOT NULL,             -- UPSELL|PROMO_SUGGESTION|FORECAST
    context JSONB,
    suggestion JSONB NOT NULL,
    confidence REAL,
    status TEXT DEFAULT 'DRAFT',    -- DRAFT|APPROVED|REJECTED|APPLIED
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'SYSTEM'
);
```

---

## 3) Eventos Growth

| Evento | Payload |
|--------|---------|
| `CAMPAIGN_CREATED` | `{campaign_id, name, segment_id}` |
| `CAMPAIGN_RUN_STARTED` | `{campaign_id, run_id, scheduled_at}` |
| `CAMPAIGN_RUN_COMPLETED` | `{campaign_id, run_id, queued_messages}` |
| `MESSAGE_QUEUED` | `{message_id, campaign_id, to_phone}` |
| `MESSAGE_SENT` | `{message_id, provider_message_id}` |
| `MESSAGE_DELIVERED` | `{message_id}` |
| `MESSAGE_FAILED` | `{message_id, error}` |

---

## 4) Jobs (Cron)

### 4.1 Job Diario: Actualizar customer_profile
- Fuente: invoices + customers
- Calcula: recency, frequency_30d, LTV, top products

### 4.2 Job Diario: Materializar Segmentos
- Evalúa `marketing_segments.definition`
- Escribe `segment_members`

### 4.3 Job Campaña: Generar Outbox
- Lee `segment_members`
- Genera `message_outbox` con variables resueltas

### 4.4 Worker: Envío WhatsApp
- Toma `message_outbox WHERE status=QUEUED`
- Envía al proveedor
- Actualiza status + reintentos

---

## 5) IA: Flujo Seguro

```
IA analiza datos
      │
      ▼
Genera ai_suggestions (status=DRAFT)
      │
      ▼
Admin aprueba (status=APPROVED)
      │
      ▼
Crea promotions / campañas
```

**Regla:** IA no toca caja en vivo, no aplica promos sin aprobación.

---

## 6) Upsell en Caja (Sin Llamar IA en Tiempo Real)

Opciones:
1. Cache local de "top upsells" precalculados
2. `ai_suggestions` ya aprobadas

Ejemplo:
- POLLO → Sugerir GASEOSA/ENSALADA
- Delivery → Sugerir "combo familiar"

---

## 7) Seguridad

- `customers.marketing_opt_in` (bool) — Consentimiento
- Rate limit: máximo X mensajes/día
- Auditoría en events

---

## 8) Tablas Growth (Resumen)

| # | Tabla | Propósito |
|---|-------|-----------|
| 1 | customer_profile | Features para segmentación |
| 2 | marketing_segments | Definición de segmentos |
| 3 | segment_members | Miembros materializados |
| 4 | marketing_campaigns | Campañas programadas |
| 5 | message_templates | Plantillas WhatsApp |
| 6 | message_outbox | Cola de envío |
| 7 | coupons | Cupones personalizados |
| 8 | ai_suggestions | Sugerencias IA |

---

**Fin del Documento v1.4**
