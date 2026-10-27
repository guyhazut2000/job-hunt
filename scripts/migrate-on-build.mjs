#!/usr/bin/env node
// Runs `prisma migrate deploy` as part of the Vercel build, but ONLY for
// production deployments. Preview deployments share the production
// DATABASE_URL, so they must never migrate (an unmerged branch's migration
// would otherwise hit the prod DB).
//
// Migrations use DIRECT_URL (non-pooled Neon endpoint): migrate deploy takes a
// Postgres advisory lock, which does not work through the PgBouncer pooler.
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Decide what to do for a given environment.
 * @param {Record<string, string | undefined>} env
 * @returns {{ action: "migrate", urlVar: string, reason: string } | { action: "skip", reason: string } | { action: "fail", reason: string }}
 */
export function planMigration(env) {
  const vercelEnv = env.VERCEL_ENV;
  if (env.SKIP_BUILD_MIGRATIONS === "1") {
    return { action: "skip", reason: "SKIP_BUILD_MIGRATIONS=1" };
  }
  if (vercelEnv === "production") {
    if (!env.DIRECT_URL) {
      return {
        action: "fail",
        reason: "VERCEL_ENV=production but DIRECT_URL is not set. Refusing to deploy code without applying migrations.",
      };
    }
    return { action: "migrate", urlVar: "DIRECT_URL", reason: "production deployment" };
  }
  if (vercelEnv === "preview") {
    // Opt-in only, and only against a DB that is not the production one.
    const previewUrl = env.PREVIEW_DIRECT_URL;
    if (previewUrl && previewUrl !== env.DIRECT_URL && previewUrl !== env.DATABASE_URL) {
      return { action: "migrate", urlVar: "PREVIEW_DIRECT_URL", reason: "preview with separate PREVIEW_DIRECT_URL" };
    }
    return {
      action: "skip",
      reason: "preview deployment (shares prod DB; set PREVIEW_DIRECT_URL to a separate DB to enable)",
    };
  }
  return { action: "skip", reason: `not a Vercel production build (VERCEL_ENV=${vercelEnv ?? "unset"})` };
}

function main() {
  const plan = planMigration(process.env);
  if (plan.action === "skip") {
    console.log(`[migrate-on-build] Skipping prisma migrate deploy: ${plan.reason}`);
    return;
  }
  if (plan.action === "fail") {
    console.error(`[migrate-on-build] ERROR: ${plan.reason}`);
    process.exit(1);
  }
  console.log(`[migrate-on-build] Running prisma migrate deploy (${plan.reason}) using ${plan.urlVar}`);
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: process.env[plan.urlVar] },
  });
  if (res.status !== 0) {
    console.error("[migrate-on-build] prisma migrate deploy failed; aborting build.");
    process.exit(res.status ?? 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
