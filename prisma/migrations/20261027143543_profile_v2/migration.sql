-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BASIC', 'GOOD', 'EXPERT');

-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('ACTIVE', 'OPEN', 'NOT_LOOKING');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "availability" "Availability",
ADD COLUMN     "avoidTech" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "companyTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "education" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "experience" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "githubUrl" TEXT,
ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "skillItems" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "targetSeniorities" "Seniority"[] DEFAULT ARRAY[]::"Seniority"[],
ADD COLUMN     "wantedTech" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "workModes" "WorkMode"[] DEFAULT ARRAY[]::"WorkMode"[];

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "extracted" JSONB,
ADD COLUMN     "label" TEXT;

-- CreateTable
CREATE TABLE "ResumeFile" (
    "id" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeFile_resumeId_key" ON "ResumeFile"("resumeId");

-- AddForeignKey
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
