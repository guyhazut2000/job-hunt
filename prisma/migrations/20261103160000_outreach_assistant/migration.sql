-- #86 LinkedIn outreach assistant. Additive only (previews share the prod DB).

-- AlterEnum
ALTER TYPE "ContactStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "statusAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "followedUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contact_userId_sentAt_idx" ON "Contact"("userId", "sentAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "OutreachPrefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyGoal" INTEGER NOT NULL DEFAULT 3,
    "followUpDays" INTEGER NOT NULL DEFAULT 5,
    "queueSize" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachPrefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OutreachPrefs_userId_key" ON "OutreachPrefs"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OutreachPrefs" ADD CONSTRAINT "OutreachPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
