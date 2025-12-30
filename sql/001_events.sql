-- ============================================
-- PARK: Event Store (append-only + idempotencia)
-- ============================================

-- Events: append-only
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  store_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  terminal_sequence BIGINT NOT NULL,
  event_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  schema_version INT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id UUID NULL,
  payload JSONB NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dedupe / idempotencia: el mismo evento no entra dos veces
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_store_eventid
  ON events(store_id, event_id);

-- Para ACK eficiente por secuencia
CREATE INDEX IF NOT EXISTS ix_events_store_seq
  ON events(store_id, terminal_sequence);

-- Consultas por venta/turno si luego materializas
CREATE INDEX IF NOT EXISTS ix_events_aggregate
  ON events(store_id, aggregate_type, aggregate_id, terminal_sequence);
