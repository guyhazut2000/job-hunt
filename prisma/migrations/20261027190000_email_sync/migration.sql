-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "EmailProvider" AS ENUM ('GMAIL', 'OUTLOOK');

-- CreateEnum
CREATE TYPE "EmailScanFrequency" AS ENUM ('MANUAL', 'DAILY', 'EVERY_6H');

-- CreateEnum
CREATE TYPE "EmailConfidence" AS ENUM ('STRICT', 'BALANCED', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "EmailCandidateKind" AS ENUM ('APPLICATION', 'STATUS_UPDATE');

-- CreateEnum
CREATE TYPE "EmailCandidateStatus" AS ENUM ('PENDING', 'AUTO_ADDED', 'APPROVED', 'DISMISSED', 'DUPLICATE');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "emailMessageId" TEXT,
ADD COLUMN     "source" "ApplicationSource" NOT NULL DEFAULT 'APP';

-- CreateTable
CREATE TABLE "EmailSyncSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookbackDays" INTEGER NOT NULL DEFAULT 7,
    "frequency" "EmailScanFrequency" NOT NULL DEFAULT 'MANUAL',
    "confidence" "EmailConfidence" NOT NULL DEFAULT 'BALANCED',
    "detectStatusUpdates" BOOLEAN NOT NULL DEFAULT true,
    "lastScanAt" TIMESTAMP(3),
    "lastScanSummary" JSONB,
    "lastScanError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSyncSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCandidate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "EmailProvider" NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "kind" "EmailCandidateKind" NOT NULL,
    "detectedStatus" "ApplicationStatus",
    "company" TEXT,
    "title" TEXT,
    "matchedJobId" TEXT,
    "applicationId" TEXT,
    "confidence" INTEGER NOT NULL,
    "reasons" TEXT[],
    "status" "EmailCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSyncSettings_userId_key" ON "EmailSyncSettings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_userId_provider_key" ON "EmailAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "EmailCandidate_userId_status_idx" ON "EmailCandidate"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailCandidate_userId_provider_messageId_key" ON "EmailCandidate"("userId", "provider", "messageId");

-- AddForeignKey
ALTER TABLE "EmailSyncSettings" ADD CONSTRAINT "EmailSyncSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCandidate" ADD CONSTRAINT "EmailCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

