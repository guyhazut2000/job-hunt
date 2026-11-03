-- CreateTable
CREATE TABLE "RankingPrefs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "include" JSONB NOT NULL DEFAULT '[]',
    "exclude" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weights" JSONB NOT NULL DEFAULT '{}',
    "defaultSort" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingPrefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankingPrefs_userId_key" ON "RankingPrefs"("userId");

-- AddForeignKey
ALTER TABLE "RankingPrefs" ADD CONSTRAINT "RankingPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

