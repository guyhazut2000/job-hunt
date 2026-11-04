-- Job-seeker criteria for the personal ranking (#106). Additive only.
ALTER TABLE "RankingPrefs" ADD COLUMN "criteria" JSONB NOT NULL DEFAULT '{}';
