-- Problem-solving method: practice attempts and pasted-problem walkthroughs (docs/problem-solving.md). Additive only.
CREATE TABLE "PatternAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "problemId" TEXT,
    "problemText" TEXT,
    "answers" JSONB NOT NULL,
    "picked" TEXT[],
    "expected" TEXT[],
    "result" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL DEFAULT '',
    "feedback" JSONB,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatternAttempt_userId_createdAt_idx" ON "PatternAttempt"("userId", "createdAt");
CREATE INDEX "PatternAttempt_userId_problemId_createdAt_idx" ON "PatternAttempt"("userId", "problemId", "createdAt");

ALTER TABLE "PatternAttempt" ADD CONSTRAINT "PatternAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
