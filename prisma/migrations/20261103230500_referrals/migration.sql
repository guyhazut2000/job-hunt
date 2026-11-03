-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('ASKED', 'AGREED', 'SUBMITTED', 'ANSWERED', 'DECLINED');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "insider" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "relationship" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "applicationId" TEXT,
    "jobId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'ASKED',
    "outcome" TEXT,
    "note" TEXT,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_userId_idx" ON "Referral"("userId");

-- CreateIndex
CREATE INDEX "Referral_status_statusAt_idx" ON "Referral"("status", "statusAt");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

