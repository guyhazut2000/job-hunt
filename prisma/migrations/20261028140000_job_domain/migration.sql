-- Job domain (תחום) badge + filter. Additive only.
-- Values come from the deterministic classifier in src/lib/jobs/domain-classifier.ts; existing rows
-- start as 'other' and are backfilled by scripts/backfill-job-domain.ts (ingest sets it going forward).
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'other';

-- CreateIndex
CREATE INDEX "Job_isActive_domain_idx" ON "Job"("isActive", "domain");
