-- CreateTable
CREATE TABLE "LinkedinProfileDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "experience" TEXT NOT NULL DEFAULT '',
    "featured" JSONB NOT NULL DEFAULT '[]',
    "skills" TEXT NOT NULL DEFAULT '',
    "recsHave" INTEGER NOT NULL DEFAULT 0,
    "recsGoal" INTEGER NOT NULL DEFAULT 3,
    "suggestions" JSONB,
    "aiSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinkedinProfileDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAnswer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "situation" TEXT NOT NULL DEFAULT '',
    "task" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "polished" TEXT,
    "polishedLang" TEXT,
    "polishedSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedinProfileDraft_userId_key" ON "LinkedinProfileDraft"("userId");

-- CreateIndex
CREATE INDEX "ManagerAnswer_userId_updatedAt_idx" ON "ManagerAnswer"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerAnswer_userId_questionId_key" ON "ManagerAnswer"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "LinkedinProfileDraft" ADD CONSTRAINT "LinkedinProfileDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAnswer" ADD CONSTRAINT "ManagerAnswer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

