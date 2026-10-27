-- CreateEnum
CREATE TYPE "CompanySyncMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "StartupCandidateStatus" AS ENUM ('PENDING', 'ADDED', 'REJECTED', 'DUPLICATE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "addedVia" TEXT,
ADD COLUMN     "careersUrl" TEXT,
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncErrorAt" TIMESTAMP(3),
ADD COLUMN     "notesEn" TEXT,
ADD COLUMN     "notesHe" TEXT,
ADD COLUMN     "syncFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syncMode" "CompanySyncMode" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "StartupCandidate" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "description" TEXT,
    "location" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "foundedYear" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "hints" JSONB,
    "status" "StartupCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "careersUrl" TEXT,
    "detectedProvider" "AtsProvider",
    "detectedBoardId" TEXT,
    "israelJobs" INTEGER,
    "checkedAt" TIMESTAMP(3),
    "checkError" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartupCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "imported" JSONB,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "addedAuto" INTEGER NOT NULL DEFAULT 0,
    "pending" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StartupCandidate_domain_key" ON "StartupCandidate"("domain");

-- CreateIndex
CREATE INDEX "StartupCandidate_status_checkedAt_idx" ON "StartupCandidate"("status", "checkedAt");

-- CreateIndex
CREATE INDEX "StartupCandidate_checkedAt_priority_idx" ON "StartupCandidate"("checkedAt", "priority");

-- AddForeignKey
ALTER TABLE "StartupCandidate" ADD CONSTRAINT "StartupCandidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
