-- Hiring process v2 (additive only): failure diagnostics + pipeline version for re-checks.
ALTER TABLE "HiringProcess" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "HiringProcess" ADD COLUMN "pipelineVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "HiringProcess" ADD COLUMN "diagnostics" JSONB;
