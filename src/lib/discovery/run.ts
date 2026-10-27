import { Prisma, type StartupCandidate } from "@prisma/client";
import { db } from "../db";
import { ingestCompany } from "../ingestion/run";
import { slugify } from "../taxonomy";
import { domainOf, isPlausibleCareersPage } from "./domain";
import { detectAts, PoliteFetcher, type DetectionResult } from "./detect";
import {
  crunchbaseEnabled,
  fetchCrunchbase,
  fetchTechMap,
  fetchWikidata,
  fetchYc,
  type AtsHints,
  type DiscoveredStartup,
  type DiscoverySource,
} from "./sources";

/** Re-import the directories when the last successful import is older than this. */
export const IMPORT_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
/** Re-check a still-pending candidate (careers pages change; new ATS boards appear) after this. */
export const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_LANES = 6;

const FETCHERS: Record<DiscoverySource, () => Promise<DiscoveredStartup[]>> = {
  TECHMAP: fetchTechMap,
  YC: fetchYc,
  WIKIDATA: fetchWikidata,
  CRUNCHBASE: fetchCrunchbase,
};

export function enabledSources(): DiscoverySource[] {
  return ["TECHMAP", "YC", "WIKIDATA", ...(crunchbaseEnabled() ? (["CRUNCHBASE"] as const) : [])];
}

/** Sources that know the company is Israeli tech, so a careers page alone is enough to keep it. */
const TRUSTED: DiscoverySource[] = ["TECHMAP", "YC"];

/** Merge duplicates across sources by domain: highest priority wins, hints/careers URLs are combined. */
export function mergeByDomain(rows: DiscoveredStartup[]): DiscoveredStartup[] {
  const by = new Map<string, DiscoveredStartup>();
  for (const r of rows) {
    const prev = by.get(r.domain);
    if (!prev) {
      by.set(r.domain, r);
      continue;
    }
    const [keep, other] = r.priority > prev.priority ? [r, prev] : [prev, r];
    by.set(r.domain, {
      ...other,
      ...keep,
      careersUrl: keep.careersUrl ?? other.careersUrl,
      hints: keep.hints || other.hints ? { ...other.hints, ...keep.hints } : undefined,
      description: keep.description ?? other.description,
    });
  }
  return [...by.values()];
}

export interface ImportResult {
  fetched: Partial<Record<DiscoverySource, number>>;
  created: Partial<Record<DiscoverySource, number>>;
  errors: string[];
}

/** Pull every enabled directory and insert new candidates (existing companies → DUPLICATE). */
export async function importCandidates(sources = enabledSources()): Promise<ImportResult> {
  const result: ImportResult = { fetched: {}, created: {}, errors: [] };
  const settled = await Promise.allSettled(sources.map((s) => FETCHERS[s]()));
  const rows: DiscoveredStartup[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      result.fetched[sources[i]] = r.value.length;
      rows.push(...r.value);
    } else {
      result.errors.push(`${sources[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  });
  const merged = mergeByDomain(rows);
  const companies = await db.company.findMany({ select: { id: true, website: true, careersUrl: true } });
  const companyByDomain = new Map<string, string>();
  for (const c of companies) {
    for (const d of [domainOf(c.website), domainOf(c.careersUrl)]) if (d) companyByDomain.set(d, c.id);
  }
  const data: Prisma.StartupCandidateCreateManyInput[] = merged.map((s) => {
    const companyId = companyByDomain.get(s.domain);
    return {
      domain: s.domain,
      name: s.name.slice(0, 200),
      website: s.website,
      source: s.source,
      sourceUrl: s.sourceUrl,
      description: s.description,
      location: s.location,
      industry: s.industry,
      size: s.size,
      foundedYear: s.foundedYear,
      careersUrl: s.careersUrl,
      priority: s.priority,
      hints: (s.hints ?? undefined) as Prisma.InputJsonValue | undefined,
      status: companyId ? "DUPLICATE" : "PENDING",
      companyId,
    };
  });
  for (let i = 0; i < data.length; i += 500) {
    const chunk = data.slice(i, i + 500);
    const existing = new Set(
      (
        await db.startupCandidate.findMany({
          where: { domain: { in: chunk.map((d) => d.domain) } },
          select: { domain: true },
        })
      ).map((c) => c.domain),
    );
    const fresh = chunk.filter((d) => !existing.has(d.domain));
    await db.startupCandidate.createMany({ data: fresh, skipDuplicates: true });
    for (const d of fresh) {
      const s = d.source as DiscoverySource;
      result.created[s] = (result.created[s] ?? 0) + 1;
    }
  }
  return result;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "company";
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    if (!(await db.company.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
}

const DISCOVERY_NOTE_HE = "נמצאה בגילוי סטארט-אפים: לא נמצא פיד משרות ציבורי — בודקים ידנית באתר המשרות.";
const DISCOVERY_NOTE_EN =
  "Found by startup discovery: no public job feed was detected — check the careers site directly.";

/** Create a MANUAL company for a candidate (admin approval, or a trusted source with a careers page). */
export async function addCandidateAsManual(candidate: StartupCandidate, via = "discovery") {
  const company = await db.company.create({
    data: {
      slug: await uniqueSlug(candidate.name),
      name: candidate.name,
      website: candidate.website,
      careersUrl: candidate.careersUrl ?? candidate.website,
      description: candidate.description,
      industry: candidate.industry,
      hqLocation: candidate.location,
      atsProvider: "MANUAL",
      syncMode: "MANUAL",
      notesHe: DISCOVERY_NOTE_HE,
      notesEn: DISCOVERY_NOTE_EN,
      addedVia: `${via}:${candidate.source}`,
    },
  });
  await db.startupCandidate.update({
    where: { id: candidate.id },
    data: { status: "ADDED", companyId: company.id },
  });
  return company;
}

export type CheckOutcome = "AUTO" | "MANUAL" | "PENDING" | "DUPLICATE";

/** What to do with a checked candidate. Pure, so the policy is unit-tested. */
export function decide(
  source: string,
  detection: Pick<DetectionResult, "board" | "israelJobs" | "pageLoaded" | "careersUrl">,
  website: string,
): CheckOutcome {
  const trusted = (TRUSTED as string[]).includes(source);
  if (detection.board && (detection.israelJobs > 0 || trusted)) return "AUTO";
  if (
    !detection.board &&
    trusted &&
    detection.pageLoaded &&
    detection.careersUrl &&
    isPlausibleCareersPage(detection.careersUrl, website)
  )
    return "MANUAL";
  return "PENDING";
}

/** Detect the ATS of one candidate and act on it (see `decide`). */
export async function checkCandidate(
  candidate: StartupCandidate,
  fetcher = new PoliteFetcher(),
): Promise<CheckOutcome> {
  let detection: DetectionResult;
  try {
    detection = await detectAts(
      { website: candidate.website, careersUrl: candidate.careersUrl, hints: candidate.hints as AtsHints | null },
      { fetcher },
    );
  } catch (e) {
    await db.startupCandidate.update({
      where: { id: candidate.id },
      data: { checkedAt: new Date(), checkError: (e instanceof Error ? e.message : String(e)).slice(0, 300) },
    });
    return "PENDING";
  }
  const base = {
    checkedAt: new Date(),
    careersUrl: detection.careersUrl ?? candidate.careersUrl,
    detectedProvider: detection.board?.provider ?? null,
    detectedBoardId: detection.board?.boardId ?? null,
    israelJobs: detection.board ? detection.israelJobs : null,
    checkError: detection.board ? null : detection.rejected.length ? `no jobs: ${detection.rejected.join(", ")}` : null,
  };
  if (detection.board) {
    const dup = await db.company.findFirst({
      where: {
        atsProvider: detection.board.provider,
        atsBoardId: { equals: detection.board.boardId, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (dup) {
      await db.startupCandidate.update({
        where: { id: candidate.id },
        data: { ...base, status: "DUPLICATE", companyId: dup.id },
      });
      return "DUPLICATE";
    }
  }
  const outcome = decide(candidate.source, detection, candidate.website);
  const updated = await db.startupCandidate.update({ where: { id: candidate.id }, data: base });
  if (outcome === "AUTO" && detection.board) {
    const company = await db.company.create({
      data: {
        slug: await uniqueSlug(candidate.name),
        name: candidate.name,
        website: candidate.website,
        careersUrl: detection.careersUrl,
        description: candidate.description,
        industry: candidate.industry,
        hqLocation: candidate.location,
        atsProvider: detection.board.provider,
        atsBoardId: detection.board.boardId,
        syncMode: "AUTO",
        addedVia: `discovery:${candidate.source}`,
      },
    });
    await db.startupCandidate.update({
      where: { id: candidate.id },
      data: { status: "ADDED", companyId: company.id },
    });
    return "AUTO";
  }
  if (outcome === "MANUAL") {
    await addCandidateAsManual(updated);
    return "MANUAL";
  }
  return "PENDING";
}

export interface CheckBatchResult {
  checked: number;
  auto: number;
  manual: number;
  pending: number;
  duplicate: number;
}

/** Check pending candidates (never checked first, by priority) until the deadline. */
export async function checkCandidates(options: { deadline: number; limit?: number }): Promise<CheckBatchResult> {
  const recheckBefore = new Date(Date.now() - RECHECK_AFTER_MS);
  const queue = await db.startupCandidate.findMany({
    where: { status: "PENDING", OR: [{ checkedAt: null }, { checkedAt: { lt: recheckBefore } }] },
    orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }, { priority: "desc" }, { createdAt: "asc" }],
    take: options.limit ?? 400,
  });
  const result: CheckBatchResult = { checked: 0, auto: 0, manual: 0, pending: 0, duplicate: 0 };
  const fetcher = new PoliteFetcher();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CHECK_LANES, queue.length) }, async () => {
      while (next < queue.length && Date.now() < options.deadline) {
        const c = queue[next++];
        const outcome = await checkCandidate(c, fetcher);
        result.checked++;
        if (outcome === "AUTO") result.auto++;
        else if (outcome === "MANUAL") result.manual++;
        else if (outcome === "DUPLICATE") result.duplicate++;
        else result.pending++;
      }
    }),
  );
  return result;
}

export interface DiscoveryOptions {
  trigger: string;
  timeBudgetMs: number;
  /** "auto" = only when the last import is older than IMPORT_EVERY_MS. */
  import?: "auto" | "always" | "never";
}

/** One discovery run: (weekly) import from the directories, then check a batch of candidates. */
export async function runDiscovery(options: DiscoveryOptions) {
  const started = Date.now();
  const deadline = started + options.timeBudgetMs;
  const run = await db.discoveryRun.create({ data: { trigger: options.trigger } });
  const errors: string[] = [];
  let imported: ImportResult | null = null;
  try {
    const mode = options.import ?? "auto";
    const last = await db.discoveryRun.findFirst({
      where: { imported: { not: Prisma.AnyNull }, error: null, id: { not: run.id } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    });
    if (mode === "always" || (mode === "auto" && (!last || started - last.startedAt.getTime() > IMPORT_EVERY_MS))) {
      imported = await importCandidates();
      errors.push(...imported.errors);
    }
    // Leave headroom for in-flight checks (each is bounded by per-request timeouts).
    const check = await checkCandidates({ deadline: deadline - 60_000 });
    const pending = await db.startupCandidate.count({ where: { status: "PENDING", checkedAt: { not: null } } });
    const finished = await db.discoveryRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        imported: imported ? (imported.created as Prisma.InputJsonValue) : undefined,
        checked: check.checked,
        addedAuto: check.auto,
        pending,
        error: errors.length ? errors.join("; ").slice(0, 1000) : null,
      },
    });
    return { run: finished, imported, check };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.discoveryRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), error: message.slice(0, 1000) },
    });
    throw e;
  }
}

/** Ingest jobs for companies discovery just added (best effort, within the remaining time). */
export async function ingestDiscovered(deadline: number, limit = 10) {
  const companies = await db.company.findMany({
    where: { syncMode: "AUTO", lastSyncedAt: null, addedVia: { startsWith: "discovery:" } },
    select: { id: true },
    take: limit,
  });
  let jobs = 0;
  for (const c of companies) {
    if (Date.now() > deadline) break;
    jobs += (await ingestCompany(c.id, { deadline })).created;
  }
  return jobs;
}
