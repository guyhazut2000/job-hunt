-- CV sections on the profile (docs/cv-templates.md). Additive only.
ALTER TABLE "Profile" ADD COLUMN "phone" TEXT;
ALTER TABLE "Profile" ADD COLUMN "projects" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Profile" ADD COLUMN "volunteering" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Profile" ADD COLUMN "customSections" JSONB NOT NULL DEFAULT '[]';
