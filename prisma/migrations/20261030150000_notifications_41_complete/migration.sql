-- Additive (#41): saved-job change detection and per-kind instant/digest delivery.
ALTER TABLE "Job" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "Job" ADD COLUMN "contentChangedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "NotificationPreference" ADD COLUMN "modes" JSONB NOT NULL DEFAULT '{}';
