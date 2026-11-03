-- Work stories for "have you used this at work?" (#83): additive only.
-- CreateTable
CREATE TABLE "WorkStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "situation" TEXT NOT NULL DEFAULT '',
    "built" TEXT NOT NULL DEFAULT '',
    "why" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "polished" TEXT,
    "polishedLang" TEXT,
    "polishedSource" TEXT,
    "polishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkStory_userId_updatedAt_idx" ON "WorkStory"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkStory_userId_kind_itemId_key" ON "WorkStory"("userId", "kind", "itemId");

-- AddForeignKey
ALTER TABLE "WorkStory" ADD CONSTRAINT "WorkStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

