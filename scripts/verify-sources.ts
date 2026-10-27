/**
 * Check every curated source against its live public board (no database):
 * `npm run sources:verify`. Exits non-zero if any board fails or has no Israeli openings.
 */
import { sleep } from "../src/lib/ingestion/http";
import { getAdapter } from "../src/lib/ingestion/registry";
import { JOB_SOURCES } from "../src/lib/ingestion/sources";

async function main() {
  let bad = 0;
  let total = 0;
  for (const s of JOB_SOURCES) {
    const adapter = getAdapter(s.provider)!;
    try {
      const raws: unknown[] = await adapter.fetchRaw({ boardId: s.boardId });
      const il = raws
        .filter((r) => adapter.isInIsrael(r as never))
        .map((r) => adapter.normalize(r as never))
        .filter(Boolean);
      total += il.length;
      if (!il.length) bad++;
      console.log(
        `${il.length ? "ok  " : "NONE"} ${s.name.padEnd(20)} ${String(il.length).padStart(4)} IL / ${raws.length}  ${il[0]?.title ?? ""} — ${il[0]?.location ?? ""}`,
      );
    } catch (e) {
      bad++;
      console.log(`FAIL ${s.name.padEnd(20)} ${e instanceof Error ? e.message : e}`);
    }
    await sleep(300);
  }
  console.log(`\n${JOB_SOURCES.length - bad}/${JOB_SOURCES.length} sources OK, ${total} Israeli jobs`);
  process.exit(bad ? 1 : 0);
}

void main();
