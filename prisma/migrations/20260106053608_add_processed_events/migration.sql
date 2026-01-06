-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "processed_events_tenant_id_processed_at_idx" ON "processed_events"("tenant_id", "processed_at");
