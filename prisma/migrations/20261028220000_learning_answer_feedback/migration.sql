-- Learning: feedback on the user's own answers (docs/learning.md). Additive only.
CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnswerFeedback_userId_skill_stage_itemId_key" ON "AnswerFeedback"("userId", "skill", "stage", "itemId");
CREATE INDEX "AnswerFeedback_userId_updatedAt_idx" ON "AnswerFeedback"("userId", "updatedAt");

ALTER TABLE "AnswerFeedback" ADD CONSTRAINT "AnswerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
