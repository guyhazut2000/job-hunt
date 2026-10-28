-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "currentStage" TEXT,
ADD COLUMN     "currentStageAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HiringProcess" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'official',
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'none',
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "estimatedDuration" TEXT,
    "notesHe" TEXT,
    "notesEn" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "checked" JSONB NOT NULL DEFAULT '[]',
    "method" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringStage" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detailHe" TEXT,
    "detailEn" TEXT,
    "duration" TEXT,
    "evidence" TEXT,
    "sourceUrl" TEXT,

    CONSTRAINT "HiringStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HiringProcess_companyId_kind_idx" ON "HiringProcess"("companyId", "kind");

-- CreateIndex
CREATE INDEX "HiringProcess_jobId_idx" ON "HiringProcess"("jobId");

-- CreateIndex
CREATE INDEX "HiringProcess_userId_companyId_idx" ON "HiringProcess"("userId", "companyId");

-- CreateIndex
CREATE INDEX "HiringStage_processId_order_idx" ON "HiringStage"("processId", "order");

-- AddForeignKey
ALTER TABLE "HiringProcess" ADD CONSTRAINT "HiringProcess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringProcess" ADD CONSTRAINT "HiringProcess_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringProcess" ADD CONSTRAINT "HiringProcess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringStage" ADD CONSTRAINT "HiringStage_processId_fkey" FOREIGN KEY ("processId") REFERENCES "HiringProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

