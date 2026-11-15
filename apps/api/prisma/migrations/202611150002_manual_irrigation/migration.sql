CREATE TYPE "IrrigationStatus" AS ENUM ('PENDING', 'DELIVERED', 'DONE', 'EXPIRED', 'CANCELLED', 'FAILED');
CREATE TABLE "irrigation_commands" (
 "id" UUID NOT NULL,
 "device_id" UUID NOT NULL,
 "zone_id" UUID NOT NULL,
 "requested_by_user_id" UUID NOT NULL,
 "duration_seconds" INTEGER NOT NULL CHECK (duration_seconds BETWEEN 1 AND 30),
 "status" "IrrigationStatus" NOT NULL DEFAULT 'PENDING',
 "origin" "ReadingOrigin" NOT NULL,
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expires_at" TIMESTAMPTZ(3) NOT NULL,
 "delivered_at" TIMESTAMPTZ(3),
 "finished_at" TIMESTAMPTZ(3),
 "actual_seconds" DOUBLE PRECISION CHECK (actual_seconds >= 0 AND actual_seconds <= duration_seconds),
 CONSTRAINT "irrigation_commands_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "irrigation_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "field_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "irrigation_commands_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "irrigation_commands_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "irrigation_commands_zone_id_created_at_idx" ON "irrigation_commands"("zone_id", "created_at");
CREATE INDEX "irrigation_commands_device_id_status_idx" ON "irrigation_commands"("device_id", "status");
CREATE UNIQUE INDEX "irrigation_commands_active_zone_idx" ON "irrigation_commands"("zone_id") WHERE "status" IN ('PENDING', 'DELIVERED');
CREATE UNIQUE INDEX "irrigation_commands_active_device_idx" ON "irrigation_commands"("device_id") WHERE "status" IN ('PENDING', 'DELIVERED');
