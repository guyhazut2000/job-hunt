-- Auto-apply preparation (#30). Additive only: new enums, tables, and nullable application columns.

DO $$ BEGIN
  CREATE TYPE "ApplyDelivery" AS ENUM ('HANDOFF', 'API', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApplyDraftStatus" AS ENUM ('DRAFT', 'NEEDS_INPUT', 'READY', 'HANDED_OFF', 'SUBMITTED', 'FAILED', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "sentSnapshot" JSONB,
ADD COLUMN IF NOT EXISTS "applyDelivery" "ApplyDelivery",
ADD COLUMN IF NOT EXISTS "applyRecordedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ApplySettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minMatchScore" INTEGER NOT NULL DEFAULT 70,
    "dailyCap" INTEGER NOT NULL DEFAULT 5,
    "fullyAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "blockedCompanyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplySettings_userId_key" ON "ApplySettings"("userId");

DO $$ BEGIN
  ALTER TABLE "ApplySettings" ADD CONSTRAINT "ApplySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ApplyDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "ApplyDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "delivery" "ApplyDelivery" NOT NULL,
    "platform" TEXT NOT NULL,
    "formMode" TEXT NOT NULL DEFAULT 'packet',
    "reason" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "answerSource" TEXT,
    "error" TEXT,
    "externalId" TEXT,
    "ruleOverride" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplyDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApplyDraft_userId_jobId_key" ON "ApplyDraft"("userId", "jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "ApplyDraft_applicationId_key" ON "ApplyDraft"("applicationId");
CREATE INDEX IF NOT EXISTS "ApplyDraft_userId_status_idx" ON "ApplyDraft"("userId", "status");
CREATE INDEX IF NOT EXISTS "ApplyDraft_userId_submittedAt_idx" ON "ApplyDraft"("userId", "submittedAt");

DO $$ BEGIN
  ALTER TABLE "ApplyDraft" ADD CONSTRAINT "ApplyDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ApplyDraft" ADD CONSTRAINT "ApplyDraft_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ApplyDraft" ADD CONSTRAINT "ApplyDraft_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
