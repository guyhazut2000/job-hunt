-- CreateTable
CREATE TABLE "TailoredCv" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "applicationId" TEXT,
    "baseResumeId" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "jobText" TEXT,
    "language" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "base" JSONB NOT NULL,
    "match" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TailoredCv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TailoredCv_userId_createdAt_idx" ON "TailoredCv"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TailoredCv_userId_jobId_idx" ON "TailoredCv"("userId", "jobId");

-- CreateIndex
CREATE INDEX "TailoredCv_userId_applicationId_idx" ON "TailoredCv"("userId", "applicationId");

-- AddForeignKey
ALTER TABLE "TailoredCv" ADD CONSTRAINT "TailoredCv_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredCv" ADD CONSTRAINT "TailoredCv_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailoredCv" ADD CONSTRAINT "TailoredCv_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

