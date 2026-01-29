-- CreateTable: location_history
-- Stores historical location data for drivers
CREATE TABLE "location_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "driver_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: whatsapp_messages
-- Stores WhatsApp message history for customer communication
CREATE TABLE "whatsapp_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "phone_number" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "message_body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "twilio_sid" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assignment_weights
-- Stores configurable weights for driver assignment algorithm
CREATE TABLE "assignment_weights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "distance" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "workload" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "performance" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable: assignment_logs
-- Logs all driver assignment decisions for analysis
CREATE TABLE "assignment_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "assignment_score" DOUBLE PRECISION NOT NULL,
    "distance_score" DOUBLE PRECISION NOT NULL,
    "workload_score" DOUBLE PRECISION NOT NULL,
    "performance_score" DOUBLE PRECISION NOT NULL,
    "distance_km" DOUBLE PRECISION NOT NULL,
    "current_orders" INTEGER NOT NULL,
    "performance_rating" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: eta_predictions
-- Stores ETA predictions and actual delivery times for ML learning
CREATE TABLE "eta_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "predicted_minutes" INTEGER NOT NULL,
    "confidence_interval" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "base_time" DOUBLE PRECISION NOT NULL,
    "traffic_adjustment" DOUBLE PRECISION NOT NULL,
    "weather_adjustment" DOUBLE PRECISION NOT NULL,
    "driver_adjustment" DOUBLE PRECISION NOT NULL,
    "actual_minutes" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eta_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: delivery_metrics
-- Aggregated delivery metrics for analytics
CREATE TABLE "delivery_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,
    "active_deliveries" INTEGER NOT NULL,
    "completed_deliveries" INTEGER NOT NULL,
    "failed_deliveries" INTEGER NOT NULL,
    "avg_delivery_time" DOUBLE PRECISION NOT NULL,
    "avg_driver_utilization" DOUBLE PRECISION NOT NULL,
    "avg_customer_rating" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "location_history_driver_id_timestamp_idx" ON "location_history"("driver_id", "timestamp");
CREATE INDEX "location_history_timestamp_idx" ON "location_history"("timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_messages_order_id_idx" ON "whatsapp_messages"("order_id");
CREATE INDEX "whatsapp_messages_phone_number_created_at_idx" ON "whatsapp_messages"("phone_number", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_weights_tenant_id_key" ON "assignment_weights"("tenant_id");
CREATE INDEX "assignment_weights_tenant_id_idx" ON "assignment_weights"("tenant_id");

-- CreateIndex
CREATE INDEX "assignment_logs_order_id_idx" ON "assignment_logs"("order_id");
CREATE INDEX "assignment_logs_driver_id_created_at_idx" ON "assignment_logs"("driver_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "eta_predictions_order_id_created_at_idx" ON "eta_predictions"("order_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_metrics_tenant_id_date_hour_key" ON "delivery_metrics"("tenant_id", "date", "hour");
CREATE INDEX "delivery_metrics_tenant_id_date_idx" ON "delivery_metrics"("tenant_id", "date");

-- AddForeignKey
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_logs" ADD CONSTRAINT "assignment_logs_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eta_predictions" ADD CONSTRAINT "eta_predictions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "delivery_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
