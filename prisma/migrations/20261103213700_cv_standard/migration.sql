-- Mandatory CV standard: cache of the last check (additive).
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "cvStandard" JSONB;
