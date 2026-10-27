-- CreateEnum
CREATE TYPE "JobLevel" AS ENUM ('INTERN', 'ENTRY', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERNSHIP');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
ADD COLUMN     "jobFunction" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN     "level" "JobLevel" NOT NULL DEFAULT 'MID',
ADD COLUMN     "sourceUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Job_isActive_jobFunction_idx" ON "Job"("isActive", "jobFunction");

-- CreateIndex
CREATE INDEX "Job_isActive_level_idx" ON "Job"("isActive", "level");

-- CreateIndex
CREATE INDEX "Job_isActive_sourceUpdatedAt_idx" ON "Job"("isActive", "sourceUpdatedAt");

-- CreateIndex
CREATE INDEX "Job_companyId_isActive_idx" ON "Job"("companyId", "isActive");

