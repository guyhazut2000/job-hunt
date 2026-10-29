-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "interviewNote" TEXT,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestHour" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "interviewEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "learningDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4]::INTEGER[],
ADD COLUMN     "learningEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "learningHour" INTEGER NOT NULL DEFAULT 19,
ADD COLUMN     "learningIdleDays" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "Digest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "aiSource" TEXT NOT NULL DEFAULT 'offline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Digest_userId_createdAt_idx" ON "Digest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Digest_userId_day_key" ON "Digest"("userId", "day");

-- CreateIndex
CREATE INDEX "Application_interviewAt_idx" ON "Application"("interviewAt");

-- AddForeignKey
ALTER TABLE "Digest" ADD CONSTRAINT "Digest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

