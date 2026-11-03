-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "askedSalaryMonthly" INTEGER,
ADD COLUMN     "salaryNote" TEXT;

-- CreateTable
CREATE TABLE "JobOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "label" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryDataPoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "city" TEXT,
    "company" TEXT,
    "monthlyGrossIls" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryDataPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobOffer_userId_idx" ON "JobOffer"("userId");

-- CreateIndex
CREATE INDEX "SalaryDataPoint_userId_family_idx" ON "SalaryDataPoint"("userId", "family");

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOffer" ADD CONSTRAINT "JobOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryDataPoint" ADD CONSTRAINT "SalaryDataPoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

