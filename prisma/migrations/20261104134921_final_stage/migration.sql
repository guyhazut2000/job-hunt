-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "archiveBatch" TEXT,
ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobOffer" ADD COLUMN     "acceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HomeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "link" TEXT,
    "receivedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "estimatedHours" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "submittedLink" TEXT,
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "fitsRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consent" TEXT NOT NULL DEFAULT 'NOT_ASKED',
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefereeLink" (
    "id" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "expectedCallAt" TIMESTAMP(3),
    "briefedAt" TIMESTAMP(3),
    "calledAt" TIMESTAMP(3),
    "thankedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefereeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferClosing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "analysis" JSONB,
    "transition" JSONB NOT NULL DEFAULT '{}',
    "acceptance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeAssignment_userId_dueAt_idx" ON "HomeAssignment"("userId", "dueAt");

-- CreateIndex
CREATE INDEX "HomeAssignment_applicationId_idx" ON "HomeAssignment"("applicationId");

-- CreateIndex
CREATE INDEX "Referee_userId_idx" ON "Referee"("userId");

-- CreateIndex
CREATE INDEX "RefereeLink_applicationId_idx" ON "RefereeLink"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "RefereeLink_refereeId_applicationId_key" ON "RefereeLink"("refereeId", "applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "OfferClosing_offerId_key" ON "OfferClosing"("offerId");

-- CreateIndex
CREATE INDEX "OfferClosing_userId_idx" ON "OfferClosing"("userId");

-- AddForeignKey
ALTER TABLE "HomeAssignment" ADD CONSTRAINT "HomeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeAssignment" ADD CONSTRAINT "HomeAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referee" ADD CONSTRAINT "Referee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeLink" ADD CONSTRAINT "RefereeLink_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "Referee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefereeLink" ADD CONSTRAINT "RefereeLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferClosing" ADD CONSTRAINT "OfferClosing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferClosing" ADD CONSTRAINT "OfferClosing_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "JobOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
