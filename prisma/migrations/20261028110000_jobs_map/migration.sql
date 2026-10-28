-- Jobs map: geocoded job points, company office override, saved origins, commute + geocode caches.
-- Additive only.
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "officeAddress" TEXT,
ADD COLUMN     "officeCity" TEXT,
ADD COLUMN     "officeLat" DOUBLE PRECISION,
ADD COLUMN     "officeLng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "geoLat" DOUBLE PRECISION,
ADD COLUMN     "geoLng" DOUBLE PRECISION,
ADD COLUMN     "geoPlaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "geoPrecision" TEXT,
ADD COLUMN     "geoSource" TEXT,
ADD COLUMN     "geocodedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SavedPlace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuteCache" (
    "id" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "destKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "timeBucket" TEXT NOT NULL,
    "seconds" INTEGER,
    "transfers" INTEGER,
    "provider" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuteCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoProviderCall" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoProviderCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "label" TEXT,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPlace_userId_idx" ON "SavedPlace"("userId");

-- CreateIndex
CREATE INDEX "CommuteCache_expiresAt_idx" ON "CommuteCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommuteCache_originKey_destKey_mode_timeBucket_key" ON "CommuteCache"("originKey", "destKey", "mode", "timeBucket");

-- CreateIndex
CREATE INDEX "GeoProviderCall_provider_createdAt_idx" ON "GeoProviderCall"("provider", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_query_key" ON "GeocodeCache"("query");

-- CreateIndex
CREATE INDEX "Job_isActive_geoLat_idx" ON "Job"("isActive", "geoLat");

-- AddForeignKey
ALTER TABLE "SavedPlace" ADD CONSTRAINT "SavedPlace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

