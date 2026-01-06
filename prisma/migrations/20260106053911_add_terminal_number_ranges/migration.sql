-- CreateTable
CREATE TABLE "terminal_number_ranges" (
    "terminal_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "range_start" INTEGER NOT NULL,
    "range_end" INTEGER NOT NULL,
    "current_number" INTEGER NOT NULL,

    CONSTRAINT "terminal_number_ranges_pkey" PRIMARY KEY ("terminal_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terminal_number_ranges_tenant_id_range_start_key" ON "terminal_number_ranges"("tenant_id", "range_start");
