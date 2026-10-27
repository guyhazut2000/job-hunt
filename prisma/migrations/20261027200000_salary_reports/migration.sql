-- CreateTable
CREATE TABLE "SalaryReport" (
    "id" TEXT NOT NULL,
    "reporterKey" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "seniority" "Seniority" NOT NULL,
    "yearsExperience" INTEGER,
    "monthlyGrossIls" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryReport_companyId_family_seniority_idx" ON "SalaryReport"("companyId", "family", "seniority");

-- CreateIndex
CREATE INDEX "SalaryReport_family_seniority_idx" ON "SalaryReport"("family", "seniority");

-- CreateIndex
CREATE INDEX "SalaryReport_reporterKey_updatedAt_idx" ON "SalaryReport"("reporterKey", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryReport_reporterKey_companyId_family_key" ON "SalaryReport"("reporterKey", "companyId", "family");

-- AddForeignKey
ALTER TABLE "SalaryReport" ADD CONSTRAINT "SalaryReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

