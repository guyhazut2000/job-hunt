-- CreateEnum
CREATE TYPE "PeopleGroup" AS ENUM ('RECRUITER', 'TEAM_LEAD', 'ENGINEER', 'MANAGER', 'SENIOR_MGMT', 'FOUNDER');

-- CreateEnum
CREATE TYPE "PeopleSuppressionReason" AS ENUM ('HIDDEN', 'REPORTED');

-- CreateTable
CREATE TABLE "PeopleSearchCache" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "group" "PeopleGroup" NOT NULL,
    "queryHash" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL,
    "hasMore" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeopleSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleSearchUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "group" "PeopleGroup" NOT NULL,
    "cached" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeopleSearchUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeopleSearchSuppression" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "reason" "PeopleSuppressionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeopleSearchSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeopleSearchCache_expiresAt_idx" ON "PeopleSearchCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PeopleSearchCache_companyId_group_queryHash_key" ON "PeopleSearchCache"("companyId", "group", "queryHash");

-- CreateIndex
CREATE INDEX "PeopleSearchUsage_userId_createdAt_idx" ON "PeopleSearchUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PeopleSearchUsage_cached_createdAt_idx" ON "PeopleSearchUsage"("cached", "createdAt");

-- CreateIndex
CREATE INDEX "PeopleSearchSuppression_profileKey_reason_idx" ON "PeopleSearchSuppression"("profileKey", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "PeopleSearchSuppression_userId_profileKey_key" ON "PeopleSearchSuppression"("userId", "profileKey");

