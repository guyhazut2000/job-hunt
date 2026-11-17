import "server-only";
/** Loads, caches and computes the profile's suggested skills (docs/skill-suggestions.md). */
import type { Prisma } from "@prisma/client";
import { aiEnabled, guardedLLM, type LLMProvider } from "@/lib/ai";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
import { categorizeSkill } from "@/lib/profile/schema";
import { hasScorableProfile, scoreMatch, toCandidate } from "@/lib/profile/score";
import {
  MIN_MATCH,
  TOP_JOBS,
  cacheUsable,
  canonicalSkill,
  heuristicJobSkills,
  israelDay,
  jobsKey,
  suggestSkills,
  type JobSkills,
  type SuggestCache,
  type SuggestionReport,
} from "./core";
import { extractJobSkills } from "./extract";

export type SuggestResult =
  | { state: "no-profile" }
  | { state: "no-jobs" }
  | (SuggestionReport & {
      state: "ok";
      source: "ai" | "rules";
      limited: string | null;
      computedAt: string;
      fromCache: boolean;
      /** Rules-based preview shown while the AI reading hasn't run today; the client then asks for it. */
      pendingAi: boolean;
    });

/** Forces the rules extractor for the instant page-render preview. */
const MOCK: LLMProvider = { name: "mock", complete: async () => "{}" };

/** The user's best-matching active jobs, scored exactly like the jobs page "best match" sort. */
async function topJobs(candidate: ReturnType<typeof toCandidate>) {
  const all = await db.job.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      techStack: true,
      roleCategory: true,
      seniority: true,
      location: true,
      workMode: true,
      postedAt: true,
      company: { select: { name: true } },
    },
  });
  return all
    .map((j) => ({ j, score: scoreMatch(candidate, j).score }))
    .filter((x) => x.score >= MIN_MATCH)
    .sort(
      (a, b) => b.score - a.score || b.j.postedAt.getTime() - a.j.postedAt.getTime() || a.j.id.localeCompare(b.j.id),
    )
    .slice(0, TOP_JOBS);
}

/**
 * `ai: false` (page render) never waits on the model: it uses today's cache or a rules preview
 * and flags `pendingAi`, so the client fetches the AI reading with an action. `force` skips the cache.
 */
export async function loadSkillSuggestions(
  userId: string,
  opts: { force?: boolean; ai?: boolean } = {},
): Promise<SuggestResult> {
  const allowAi = opts.ai ?? true;
  const [profile, state] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.skillSuggestState.findUnique({ where: { userId } }),
  ]);
  if (!profile || !hasScorableProfile(profile)) return { state: "no-profile" };
  const candidate = toCandidate(profile);
  const top = await topJobs(candidate);
  if (!top.length) return { state: "no-jobs" };

  const day = israelDay();
  const key = jobsKey(top.map((t) => t.j.id));
  const cached: SuggestCache | null = state
    ? {
        day: state.day,
        jobsKey: state.jobsKey,
        source: state.source === "ai" ? "ai" : "rules",
        limited: state.limited,
        jobs: state.jobs as unknown as JobSkills[],
      }
    : null;

  let extraction: SuggestCache;
  let computedAt: Date;
  let fromCache = false;
  let pendingAi = false;
  if (!opts.force && cacheUsable(cached, day, key)) {
    // Scores move when the profile changes; keep the cached skills but refresh the ordering inputs.
    const scoreOf = new Map(top.map((t) => [t.j.id, t.score]));
    extraction = { ...cached, jobs: cached.jobs.map((j) => ({ ...j, score: scoreOf.get(j.id) ?? j.score })) };
    computedAt = state!.computedAt;
    fromCache = true;
  } else {
    const descs = await db.job.findMany({
      where: { id: { in: top.map((t) => t.j.id) } },
      select: { id: true, description: true },
    });
    const descOf = new Map(descs.map((d) => [d.id, d.description ?? ""]));
    const inputs = top.map(({ j, score }) => ({
      id: j.id,
      title: j.title,
      company: j.company.name,
      score,
      techStack: j.techStack,
      description: descOf.get(j.id) ?? "",
    }));
    pendingAi = !allowAi && aiEnabled();
    const ex = await extractJobSkills(inputs, pendingAi ? MOCK : await guardedLLM("skill_suggest", userId));
    extraction = { day, jobsKey: key, ...ex };
    computedAt = new Date();
  }
  if (!fromCache && !pendingAi) {
    const data = {
      day,
      jobsKey: key,
      source: extraction.source,
      limited: extraction.limited,
      jobs: extraction.jobs as unknown as Prisma.InputJsonValue,
      computedAt,
    };
    await db.skillSuggestState.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  }

  const pro = readProfessional(profile);
  const report = suggestSkills({
    skills: candidate.skills.map((s) => s.name),
    cvTech: [...pro.experience.flatMap((e) => e.tech), ...pro.projects.flatMap((p) => p.tech)],
    jobs: extraction.jobs,
    dismissed: state?.dismissed ?? [],
  });
  return {
    state: "ok",
    ...report,
    source: extraction.source,
    limited: extraction.limited,
    computedAt: computedAt.toISOString(),
    fromCache,
    pendingAi,
  };
}

/** Add one suggested skill to the profile's skills list (no-op when an equivalent is already there). */
export async function addSkillToProfile(userId: string, raw: string): Promise<"added" | "exists" | "invalid" | "full"> {
  const c = canonicalSkill(raw);
  if (!c) return "invalid";
  const profile = await db.profile.findUnique({ where: { userId } });
  const pro = readProfessional(profile);
  if (pro.skillItems.some((s) => canonicalSkill(s.name)?.key === c.key)) return "exists";
  if (pro.skillItems.length >= 80) return "full";
  const name = c.label.slice(0, 40);
  const skillItems = [
    ...pro.skillItems,
    { name, level: "GOOD" as const, years: null, category: categorizeSkill(name) },
  ];
  const data = {
    skillItems: skillItems as unknown as Prisma.InputJsonValue,
    skills: [...new Set(skillItems.map((s) => s.name))].slice(0, 80),
  };
  await db.profile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return "added";
}

export async function setDismissed(userId: string, key: string | null): Promise<void> {
  const state = await db.skillSuggestState.findUnique({ where: { userId }, select: { dismissed: true } });
  const dismissed = key === null ? [] : [...new Set([...(state?.dismissed ?? []), key])].slice(-200);
  await db.skillSuggestState.upsert({
    where: { userId },
    // Placeholder cache (never usable: empty day) so a dismissal can be stored before any cache.
    create: { userId, day: "", jobsKey: "", source: "rules", dismissed },
    update: { dismissed },
  });
}

/**
 * The user's top-matching jobs with their keywords, for CV tailoring (docs/cv-ai-assist.md).
 * Reuses today's skill-suggest extraction when it covers the same jobs; otherwise the rules reader
 * (no extra AI call — the tailoring call itself is the one that spends the budget).
 */
export async function loadTargetJobs(userId: string, limit = 5): Promise<JobSkills[]> {
  const [profile, state] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.skillSuggestState.findUnique({ where: { userId } }),
  ]);
  if (!profile || !hasScorableProfile(profile)) return [];
  const top = await topJobs(toCandidate(profile));
  if (!top.length) return [];
  const cached: SuggestCache | null = state
    ? {
        day: state.day,
        jobsKey: state.jobsKey,
        source: state.source === "ai" ? "ai" : "rules",
        limited: state.limited,
        jobs: state.jobs as unknown as JobSkills[],
      }
    : null;
  const picked = top.slice(0, limit);
  if (cacheUsable(cached, israelDay(), jobsKey(top.map((t) => t.j.id)))) {
    const byId = new Map(cached.jobs.map((j) => [j.id, j]));
    const all = picked.map((t) => byId.get(t.j.id)).filter((j): j is JobSkills => !!j);
    if (all.length === picked.length) return all.map((j, i) => ({ ...j, score: picked[i].score }));
  }
  const descs = await db.job.findMany({
    where: { id: { in: picked.map((t) => t.j.id) } },
    select: { id: true, description: true },
  });
  const descOf = new Map(descs.map((d) => [d.id, d.description ?? ""]));
  return picked.map(({ j, score }) => ({
    id: j.id,
    title: j.title,
    company: j.company.name,
    score,
    ...heuristicJobSkills({ techStack: j.techStack, description: descOf.get(j.id) ?? "" }),
  }));
}
