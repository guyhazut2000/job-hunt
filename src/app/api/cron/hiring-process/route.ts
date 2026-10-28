import { NextResponse } from "next/server";
import { runHiringProcessBatch } from "@/lib/hiring/run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const clampInt = (v: string | null, def: number, max: number) => {
  const n = v === null ? def : Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : def;
};

/**
 * Hiring-process population (docs/hiring-process.md). Vercel Cron calls this daily with
 * `Authorization: Bearer $CRON_SECRET` (twice a day); each run checks a small, time-boxed batch of
 * companies that were never checked, not in 30 days, or by an older pipeline version, plus job descriptions
 * that describe their own process. Query: `limit` (companies, ≤60), `jobs` (job-level processes, ≤30),
 * `llm` (max Gemini calls, ≤28 — 28 × 8.5 s fits the 300 s box), `slugs` (comma-separated slugs, ≤40).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  const slugs = (q.get("slugs") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);
  const summary = await runHiringProcessBatch({
    limit: clampInt(q.get("limit"), 20, 60),
    jobLimit: clampInt(q.get("jobs"), 6, 30),
    maxLlmCalls: clampInt(q.get("llm"), 20, 28),
    timeBudgetMs: 270_000,
    slugs,
  });
  return NextResponse.json(summary);
}

export const GET = handle;
export const POST = handle;
