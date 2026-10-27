import type { PeopleGroup, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BraveError, braveWebSearch, createPacer } from "./brave";
import { peopleSearchConfig } from "./config";
import { fixtureResults } from "./fixtures";
import { buildPeopleQuery } from "./groups";
import { DAY, MINUTE, MONTH, checkLimits, expiryFrom, isFresh, queryHash, type LimitStatus } from "./limits";
import { CONFIDENCE_LOW, CONFIDENCE_SHOW } from "./match";
import { parseResults, type PersonCard } from "./parse";

export type PeopleSearchStatus = "ok" | "disabled" | "not_found" | "error" | LimitStatus;

export type PeopleSearchResponse =
  | {
      status: "ok";
      people: PersonCard[];
      /** Plausible but uncertain matches (labelled in the UI). */
      uncertain: PersonCard[];
      page: number;
      hasMore: boolean;
      cached: boolean;
      fetchedAt: string;
    }
  | { status: Exclude<PeopleSearchStatus, "ok"> };

const globalPacer = globalThis as unknown as { __bravePace?: () => Promise<void> };

function pacer(minIntervalMs: number) {
  globalPacer.__bravePace ??= createPacer(minIntervalMs);
  return globalPacer.__bravePace;
}

async function counts(userId: string, now: Date) {
  const at = (ms: number) => new Date(now.getTime() - ms);
  const [lastMinute, lastDayUncached, lastMonthPeople, lastMonthJobLinks] = await Promise.all([
    db.peopleSearchUsage.count({ where: { userId, createdAt: { gt: at(MINUTE) } } }),
    db.peopleSearchUsage.count({ where: { userId, cached: false, createdAt: { gt: at(DAY) } } }),
    db.peopleSearchUsage.count({ where: { cached: false, createdAt: { gt: at(MONTH) } } }),
    // LinkedIn job-link lookups share the same Brave monthly budget.
    db.linkedinJobLookup.count({ where: { createdAt: { gt: at(MONTH) } } }),
  ]);
  return { lastMinute, lastDayUncached, lastMonthUncached: lastMonthPeople + lastMonthJobLinks };
}

async function visible(people: PersonCard[], userId: string) {
  if (people.length === 0) return people;
  const blocked = await db.peopleSearchSuppression.findMany({
    where: { profileKey: { in: people.map((p) => p.key) }, OR: [{ userId }, { reason: "REPORTED" }] },
    select: { profileKey: true },
  });
  const set = new Set(blocked.map((b) => b.profileKey));
  return people.filter((p) => !set.has(p.key));
}

export async function searchPeople(input: {
  userId: string;
  companyId: string;
  group: PeopleGroup;
  jobId?: string | null;
  page: number;
}): Promise<PeopleSearchResponse> {
  const cfg = peopleSearchConfig();
  if (!cfg.enabled) return { status: "disabled" };

  const [company, job] = await Promise.all([
    db.company.findUnique({ where: { id: input.companyId }, select: { id: true, name: true } }),
    input.jobId
      ? db.job.findUnique({ where: { id: input.jobId }, select: { companyId: true, roleCategory: true } })
      : null,
  ]);
  if (!company || (input.jobId && (!job || job.companyId !== company.id))) return { status: "not_found" };

  const query = buildPeopleQuery(company.name, input.group, job?.roleCategory);
  const hash = queryHash(query, input.page);
  const now = new Date();
  const key = { companyId: company.id, group: input.group, queryHash: hash };
  const hit = await db.peopleSearchCache.findUnique({ where: { companyId_group_queryHash: key } });
  const fresh = isFresh(hit, now);

  const limit = checkLimits(await counts(input.userId, now), cfg, !fresh);
  if (limit) return { status: limit };

  let people: PersonCard[];
  let hasMore: boolean;
  let fetchedAt: Date;
  if (fresh && hit) {
    people = hit.results as unknown as PersonCard[];
    hasMore = hit.hasMore;
    fetchedAt = hit.fetchedAt;
  } else {
    try {
      const page = cfg.mock
        ? fixtureResults(company.name, input.group, input.page)
        : await braveWebSearch(query, { apiKey: cfg.apiKey!, page: input.page, pace: pacer(cfg.minIntervalMs) });
      people = parseResults(page.results, company.name, input.group).filter((p) => p.confidence >= CONFIDENCE_LOW);
      hasMore = page.hasMore && input.page < 9;
    } catch (e) {
      if (e instanceof BraveError && (e.kind === "quota" || e.kind === "rate")) return { status: "quota" };
      if (e instanceof BraveError && e.kind === "auth") return { status: "disabled" };
      console.error("[people-search] provider error", e instanceof Error ? e.message : "unknown");
      return { status: "error" };
    }
    fetchedAt = now;
    const data = {
      query,
      page: input.page,
      results: people as unknown as Prisma.InputJsonValue,
      hasMore,
      fetchedAt: now,
      expiresAt: expiryFrom(now, cfg.cacheTtlHours),
    };
    await db.peopleSearchCache.upsert({
      where: { companyId_group_queryHash: key },
      create: { ...key, ...data },
      update: data,
    });
    // Retention: drop expired cache rows and old usage rows opportunistically.
    void db.peopleSearchCache.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});
    void db.peopleSearchUsage
      .deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - MONTH - DAY) } } })
      .catch(() => {});
  }
  await db.peopleSearchUsage.create({
    data: { userId: input.userId, companyId: company.id, group: input.group, cached: fresh },
  });

  const shown = await visible(people, input.userId);
  return {
    status: "ok",
    people: shown.filter((p) => p.confidence >= CONFIDENCE_SHOW),
    uncertain: shown.filter((p) => p.confidence < CONFIDENCE_SHOW),
    page: input.page,
    hasMore,
    cached: fresh,
    fetchedAt: fetchedAt.toISOString(),
  };
}
