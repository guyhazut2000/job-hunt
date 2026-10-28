-- Combined public-transport itineraries (leg breakdown) cached alongside matrix times.
ALTER TABLE "CommuteCache" ADD COLUMN "route" JSONB;
