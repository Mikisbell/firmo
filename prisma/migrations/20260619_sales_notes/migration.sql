-- Nota de Venta: documento interno NO fiscal (pre-cuenta) convertible a boleta/factura.
-- Read-model proyectado desde eventos SALES_NOTE_ISSUED/CONVERTED/VOIDED.

CREATE TABLE IF NOT EXISTS sales_notes (
  id           UUID NOT NULL,
  tenant_id    UUID NOT NULL,
  order_id     UUID NOT NULL,
  check_id     TEXT NOT NULL,
  serie        TEXT NOT NULL,
  numero       TEXT NOT NULL,
  total_cents  INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN',  -- OPEN | CONVERTED | VOIDED
  invoice_id   UUID,
  invoice_type TEXT,
  void_reason  TEXT,
  converted_at TIMESTAMPTZ(6),
  voided_at    TIMESTAMPTZ(6),
  created_at   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT sales_notes_pkey PRIMARY KEY (id)
);

-- Fail-proof DB: una sola nota por check (no doble emision) y serie-numero unico por tenant.
CREATE UNIQUE INDEX IF NOT EXISTS sales_notes_tenant_order_check_key
  ON sales_notes(tenant_id, order_id, check_id);
CREATE UNIQUE INDEX IF NOT EXISTS sales_notes_tenant_serie_numero_key
  ON sales_notes(tenant_id, serie, numero);
CREATE INDEX IF NOT EXISTS sales_notes_tenant_created_idx
  ON sales_notes(tenant_id, created_at DESC);
