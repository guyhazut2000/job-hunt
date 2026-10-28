-- Free-text search on /jobs and /companies: trigram GIN indexes so ILIKE '%term%'
-- (Prisma `contains` + `mode: insensitive`) is index-backed for Hebrew and English.
-- Additive only.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Company_name_trgm_idx" ON "Company" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_title_trgm_idx" ON "Job" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_description_trgm_idx" ON "Job" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_location_trgm_idx" ON "Job" USING GIN ("location" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_department_trgm_idx" ON "Job" USING GIN ("department" gin_trgm_ops);
