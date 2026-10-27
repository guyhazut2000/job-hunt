#!/usr/bin/env node
// Fails if a migration added since BASE_REF contains destructive SQL.
// Build-time migrations run before the new code is live, so the old
// deployment keeps serving traffic against the migrated schema: migrations
// must be additive (new tables/columns/enum values/indexes). To ship an
// intentional destructive change, put `-- destructive-ok: <reason>` in the
// migration file and get it reviewed.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const DESTRUCTIVE = [
  /\bDROP\s+(TABLE|COLUMN|TYPE|SCHEMA|INDEX|CONSTRAINT)\b/i,
  /\bALTER\s+TABLE\b[^;]*\bDROP\b/i,
  /\bALTER\s+COLUMN\b[^;]*\b(TYPE|SET\s+NOT\s+NULL)\b/i,
  /\bRENAME\s+(TO|COLUMN)\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\b/i,
];

export function findDestructive(sql) {
  if (/--\s*destructive-ok/i.test(sql)) return [];
  const noComments = sql.replace(/--.*$/gm, "");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter((stmt) => stmt && DESTRUCTIVE.some((re) => re.test(stmt)));
}

function main() {
  const base = process.env.BASE_REF || "origin/master";
  let files;
  try {
    files = execSync(`git diff --name-only --diff-filter=A ${base}...HEAD -- prisma/migrations`, { encoding: "utf8" })
      .split("\n")
      .filter((f) => f.endsWith("migration.sql") && existsSync(f));
  } catch {
    console.log(`[check-migrations] could not diff against ${base}; skipping`);
    return;
  }
  let bad = 0;
  for (const f of files) {
    const hits = findDestructive(readFileSync(f, "utf8"));
    for (const h of hits) {
      bad++;
      console.error(
        `::error file=${f}::Destructive SQL in migration (add '-- destructive-ok: <reason>' if intended): ${h.split("\n")[0]}`,
      );
    }
  }
  console.log(`[check-migrations] ${files.length} new migration(s) checked, ${bad} destructive statement(s)`);
  if (bad) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
