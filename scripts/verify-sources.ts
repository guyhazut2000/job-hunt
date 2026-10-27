/**
 * Check every curated source against its live public board (no database):
 * `npm run sources:verify [-- PROVIDER,PROVIDER] [-- --new]`.
 * Exits non-zero if any board fails or has no Israeli openings.
 * For detail-based sources (Workday, SmartRecruiters) only the first Israeli posting's detail is fetched.
 */
import { sleep } from "../src/lib/ingestion/http";
import { getAdapter } from "../src/lib/ingestion/registry";
import { JOB_SOURCES } from "../src/lib/ingestion/sources";

async function main() {
  const filter = process.argv
    .slice(2)
    .find((a) => !a.startsWith("--"))
    ?.split(",")
    .map((p) => p.trim().toUpperCase());
  const sources = JOB_SOURCES.filter((s) => !filter || filter.includes(s.provider));
  let bad = 0;
  let total = 0;
  for (const s of sources) {
    const adapter = getAdapter(s.provider)!;
    const ctx = { boardId: s.boardId };
    try {
      const raws: unknown[] = await adapter.fetchRaw(ctx);
      const il = raws.filter((r) => adapter.isInIsrael(r as never));
      total += il.length;
      if (!il.length) bad++;
      let sample = il[0] as never;
      if (sample && adapter.detail) sample = (await adapter.detail.fetch(sample, ctx)) as never;
      const job = sample ? adapter.normalize(sample) : null;
      console.log(
        `${il.length ? "ok  " : "NONE"} ${s.provider.padEnd(15)} ${s.name.padEnd(26)} ${String(il.length).padStart(4)} IL / ${String(raws.length).padEnd(5)} ${job?.title ?? ""} — ${job?.location ?? ""}`,
      );
    } catch (e) {
      bad++;
      console.log(`FAIL ${s.provider.padEnd(15)} ${s.name.padEnd(26)} ${e instanceof Error ? e.message : e}`);
    }
    await sleep(300);
  }
  console.log(`\n${sources.length - bad}/${sources.length} sources OK, ${total} Israeli jobs`);
  process.exit(bad ? 1 : 0);
}

void main();
