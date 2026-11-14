-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priorities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "water" INTEGER NOT NULL DEFAULT 25,
    "soil" INTEGER NOT NULL DEFAULT 25,
    "income" INTEGER NOT NULL DEFAULT 25,
    "risk" INTEGER NOT NULL DEFAULT 25,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "priorities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lon" DOUBLE PRECISION,
    "current_crop_id" TEXT NOT NULL,
    "irrigated" BOOLEAN NOT NULL DEFAULT false,
    "soil_notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_histories" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "crop_id" TEXT NOT NULL,
    "planted_at" TIMESTAMPTZ(3) NOT NULL,
    "harvested_at" TIMESTAMPTZ(3) NOT NULL,
    "yield_ton_ha" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "crop_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nasa_caches" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nasa_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "priorities_user_id_key" ON "priorities"("user_id");

-- CreateIndex
CREATE INDEX "parcels_owner_id_idx" ON "parcels"("owner_id");

-- CreateIndex
CREATE INDEX "zones_parcel_id_idx" ON "zones"("parcel_id");

-- CreateIndex
CREATE INDEX "crop_histories_zone_id_planted_at_idx" ON "crop_histories"("zone_id", "planted_at");

-- CreateIndex
CREATE UNIQUE INDEX "nasa_caches_key_key" ON "nasa_caches"("key");

-- CreateIndex
CREATE INDEX "nasa_caches_expires_at_idx" ON "nasa_caches"("expires_at");

-- AddForeignKey
ALTER TABLE "priorities" ADD CONSTRAINT "priorities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zones" ADD CONSTRAINT "zones_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_histories" ADD CONSTRAINT "crop_histories_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
