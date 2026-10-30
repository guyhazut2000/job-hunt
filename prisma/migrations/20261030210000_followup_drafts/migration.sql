-- Follow-up reminders with a draft (additive): per-application follow-up state + a log of
-- follow-ups the user sent himself. Default reminder delay 7 → 10 days for new settings rows.
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "followUpCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "lastFollowUpAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "followUpSnoozedUntil" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "followUpOff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "noResponseAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "followUpTo" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "followUpDraft" JSONB;

ALTER TABLE "NotificationPreference" ALTER COLUMN "followUpDays" SET DEFAULT 10;

CREATE TABLE IF NOT EXISTS "ApplicationFollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "language" TEXT NOT NULL,
    "subject" TEXT,
    "source" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApplicationFollowUp_userId_sentAt_idx" ON "ApplicationFollowUp"("userId", "sentAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationFollowUp_applicationId_round_key" ON "ApplicationFollowUp"("applicationId", "round");

DO $$ BEGIN
  ALTER TABLE "ApplicationFollowUp" ADD CONSTRAINT "ApplicationFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationFollowUp" ADD CONSTRAINT "ApplicationFollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
