-- Concepts glossary (docs/concepts.md). Additive only.
-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TECH',
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "confidence" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skill" TEXT,
    "source" TEXT,
    "parentId" TEXT,
    "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptMessage" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'chat',
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptOverview" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "model" TEXT,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptOverview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Concept_userId_updatedAt_idx" ON "Concept"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Concept_companyId_idx" ON "Concept"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Concept_userId_slug_key" ON "Concept"("userId", "slug");

-- CreateIndex
CREATE INDEX "ConceptMessage_conceptId_createdAt_idx" ON "ConceptMessage"("conceptId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptOverview_key_locale_key" ON "ConceptOverview"("key", "locale");

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptMessage" ADD CONSTRAINT "ConceptMessage_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

