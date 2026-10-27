import { describe, expect, it } from "vitest";
import { planMigration } from "../scripts/migrate-on-build.mjs";
import { findDestructive } from "../scripts/check-migrations-additive.mjs";

describe("planMigration", () => {
  it("migrates production builds with DIRECT_URL", () => {
    expect(
      planMigration({ VERCEL_ENV: "production", DIRECT_URL: "postgres://d", DATABASE_URL: "postgres://p" }),
    ).toMatchObject({
      action: "migrate",
      urlVar: "DIRECT_URL",
    });
  });
  it("fails production builds without DIRECT_URL", () => {
    expect(planMigration({ VERCEL_ENV: "production", DATABASE_URL: "postgres://p" }).action).toBe("fail");
  });
  it("skips previews (they share the prod DB)", () => {
    expect(planMigration({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://p" }).action).toBe("skip");
  });
  it("skips previews whose PREVIEW_DIRECT_URL equals the prod URL", () => {
    expect(
      planMigration({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://p", PREVIEW_DIRECT_URL: "postgres://p" }).action,
    ).toBe("skip");
  });
  it("migrates previews only with a separate PREVIEW_DIRECT_URL", () => {
    expect(
      planMigration({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://p", PREVIEW_DIRECT_URL: "postgres://other" }),
    ).toMatchObject({
      action: "migrate",
      urlVar: "PREVIEW_DIRECT_URL",
    });
  });
  it("skips local / CI builds", () => {
    expect(planMigration({ DATABASE_URL: "postgres://local" }).action).toBe("skip");
    expect(planMigration({ VERCEL_ENV: "development" }).action).toBe("skip");
  });
  it("honours SKIP_BUILD_MIGRATIONS", () => {
    expect(planMigration({ VERCEL_ENV: "production", DIRECT_URL: "x", SKIP_BUILD_MIGRATIONS: "1" }).action).toBe(
      "skip",
    );
  });
});

describe("findDestructive", () => {
  it("allows additive SQL", () => {
    const sql = `CREATE TYPE "X" AS ENUM ('A');\nCREATE TABLE "T" ("id" TEXT NOT NULL);\nALTER TABLE "Job" ADD COLUMN "level" TEXT;\nCREATE INDEX "i" ON "T"("id");\nALTER TABLE "T" ADD CONSTRAINT "fk" FOREIGN KEY ("id") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;`;
    expect(findDestructive(sql)).toEqual([]);
  });
  it("flags drops, renames and type changes", () => {
    expect(findDestructive(`ALTER TABLE "Job" DROP COLUMN "x";`)).toHaveLength(1);
    expect(findDestructive(`DROP TABLE "Old";`)).toHaveLength(1);
    expect(findDestructive(`ALTER TABLE "Job" RENAME COLUMN "a" TO "b";`)).toHaveLength(1);
    expect(findDestructive(`ALTER TABLE "Job" ALTER COLUMN "a" SET DATA TYPE INTEGER;`)).toHaveLength(1);
    expect(findDestructive(`ALTER TABLE "Job" ALTER COLUMN "a" SET NOT NULL;`)).toHaveLength(1);
  });
  it("respects the destructive-ok marker", () => {
    expect(findDestructive(`-- destructive-ok: column unused since v2\nALTER TABLE "Job" DROP COLUMN "x";`)).toEqual(
      [],
    );
  });
});
