-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ReadingOrigin" AS ENUM ('REAL', 'SIMULATED');

-- CreateTable
CREATE TABLE "field_devices" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "origin" "ReadingOrigin" NOT NULL,
    "expected_interval_seconds" INTEGER NOT NULL DEFAULT 300,
    "dry_raw" INTEGER,
    "wet_raw" INTEGER,
    "depth_cm" DOUBLE PRECISION,
    "calibration_version" INTEGER NOT NULL DEFAULT 1,
    "last_measured_at" TIMESTAMPTZ(3),
    "last_received_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "field_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_readings" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "reading_id" UUID NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "origin" "ReadingOrigin" NOT NULL,
    "measured_at" TIMESTAMPTZ(3) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soil_moisture_raw" INTEGER,
    "soil_moisture" DOUBLE PRECISION,
    "air_temperature" DOUBLE PRECISION,
    "air_humidity" DOUBLE PRECISION,
    "mq2_raw" INTEGER,
    "calibration_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "field_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "field_devices_key_hash_key" ON "field_devices"("key_hash");

-- CreateIndex
CREATE INDEX "field_devices_zone_id_idx" ON "field_devices"("zone_id");

-- CreateIndex
CREATE INDEX "field_readings_zone_id_measured_at_id_idx" ON "field_readings"("zone_id", "measured_at", "id");

-- CreateIndex
CREATE INDEX "field_readings_measured_at_idx" ON "field_readings"("measured_at");

-- CreateIndex
CREATE UNIQUE INDEX "field_readings_device_id_reading_id_key" ON "field_readings"("device_id", "reading_id");

-- AddForeignKey
ALTER TABLE "field_devices" ADD CONSTRAINT "field_devices_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_readings" ADD CONSTRAINT "field_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "field_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_readings" ADD CONSTRAINT "field_readings_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
