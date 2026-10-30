-- CreateEnum
CREATE TYPE "StatusChangeSource" AS ENUM ('EMAIL_AUTO', 'EMAIL_REVIEW', 'MANUAL');

-- AlterTable
ALTER TABLE "EmailSyncSettings" ADD COLUMN     "autoApplyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoApplyThreshold" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "ApplicationStatusChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "source" "StatusChangeSource" NOT NULL,
    "emailCandidateId" TEXT,
    "confidence" INTEGER,
    "emailDate" TIMESTAMP(3),
    "prevStatusChangedAt" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationStatusChange_emailCandidateId_key" ON "ApplicationStatusChange"("emailCandidateId");

-- CreateIndex
CREATE INDEX "ApplicationStatusChange_applicationId_createdAt_idx" ON "ApplicationStatusChange"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "ApplicationStatusChange_userId_createdAt_idx" ON "ApplicationStatusChange"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicationStatusChange" ADD CONSTRAINT "ApplicationStatusChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusChange" ADD CONSTRAINT "ApplicationStatusChange_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

