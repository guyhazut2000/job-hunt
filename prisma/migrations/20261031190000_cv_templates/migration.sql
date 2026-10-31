-- CV templates (#78): additive only.
ALTER TABLE "Profile" ADD COLUMN "cvTemplate" TEXT;

CREATE TABLE "CvLayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CvLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CvLayout_userId_template_key" ON "CvLayout"("userId", "template");

ALTER TABLE "CvLayout" ADD CONSTRAINT "CvLayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
