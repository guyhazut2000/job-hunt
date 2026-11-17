-- CreateTable
CREATE TABLE "WorkJournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "insights" JSONB,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkJournalSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderOn" BOOLEAN NOT NULL DEFAULT false,
    "frequency" TEXT NOT NULL DEFAULT 'weekly',
    "weekday" INTEGER NOT NULL DEFAULT 4,
    "hour" INTEGER NOT NULL DEFAULT 17,
    "lastRemindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkJournalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkJournalEntry_userId_day_idx" ON "WorkJournalEntry"("userId", "day");

-- CreateIndex
CREATE INDEX "WorkJournalEntry_userId_roleKey_idx" ON "WorkJournalEntry"("userId", "roleKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkJournalSettings_userId_key" ON "WorkJournalSettings"("userId");

-- AddForeignKey
ALTER TABLE "WorkJournalEntry" ADD CONSTRAINT "WorkJournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkJournalSettings" ADD CONSTRAINT "WorkJournalSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
