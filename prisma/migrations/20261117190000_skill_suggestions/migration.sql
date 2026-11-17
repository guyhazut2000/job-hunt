-- CreateTable
CREATE TABLE "SkillSuggestState" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "jobsKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "limited" TEXT,
    "jobs" JSONB NOT NULL DEFAULT '[]',
    "dismissed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillSuggestState_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "SkillSuggestState" ADD CONSTRAINT "SkillSuggestState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
