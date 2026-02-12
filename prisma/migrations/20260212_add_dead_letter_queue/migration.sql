-- CreateTable: dead_letter_queue
-- Almacena eventos que expiraron en la cola de out-of-order
-- Timeout: 60 segundos
-- Usado para análisis y debugging de eventos problemáticos

CREATE TABLE IF NOT EXISTS "dead_letter_queue" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "enqueued_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id")
);

-- Índices para consultas comunes
CREATE INDEX IF NOT EXISTS "dead_letter_queue_tenant_id_idx" ON "dead_letter_queue"("tenant_id");
CREATE INDEX IF NOT EXISTS "dead_letter_queue_event_id_idx" ON "dead_letter_queue"("event_id");
CREATE INDEX IF NOT EXISTS "dead_letter_queue_aggregate_id_idx" ON "dead_letter_queue"("aggregate_id");
CREATE INDEX IF NOT EXISTS "dead_letter_queue_expired_at_idx" ON "dead_letter_queue"("expired_at");

-- Comentarios
COMMENT ON TABLE "dead_letter_queue" IS 'Eventos que expiraron en la cola de out-of-order (timeout 60s)';
COMMENT ON COLUMN "dead_letter_queue"."reason" IS 'Razón por la que el evento fue encolado (ej: DEPENDENCY_MISSING, OUT_OF_ORDER)';
COMMENT ON COLUMN "dead_letter_queue"."enqueued_at" IS 'Timestamp cuando el evento fue encolado';
COMMENT ON COLUMN "dead_letter_queue"."expired_at" IS 'Timestamp cuando el evento expiró y fue movido a DLQ';
