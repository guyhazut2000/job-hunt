-- Instant high-match job alert settings (#96). Additive only.
ALTER TABLE "NotificationPreference" ADD COLUMN "highMatchEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "highMatchThreshold" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "NotificationPreference" ADD COLUMN "highMatchDailyCap" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "NotificationPreference" ADD COLUMN "highMatchCheckedAt" TIMESTAMP(3);
