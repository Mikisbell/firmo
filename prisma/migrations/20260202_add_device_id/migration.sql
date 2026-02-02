-- Add device_id column to terminal_devices
ALTER TABLE "terminal_devices" ADD COLUMN "device_id" TEXT;

-- Create unique index on device_id
CREATE UNIQUE INDEX "terminal_devices_device_id_key" ON "terminal_devices"("device_id");

-- Create index for faster lookups
CREATE INDEX "terminal_devices_device_id_idx" ON "terminal_devices"("device_id");
