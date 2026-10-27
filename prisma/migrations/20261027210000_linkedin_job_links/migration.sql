-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "linkedinCheckedAt" TIMESTAMP(3),
ADD COLUMN     "linkedinUrl" TEXT;

-- CreateTable
CREATE TABLE "LinkedinJobLookup" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL,
    "trigger" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedinJobLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedinJobLookup_createdAt_idx" ON "LinkedinJobLookup"("createdAt");

