import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError, type AiLimitReason } from "@/lib/ai/errors";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
import { buildBaseCv, cvCorpus } from "./base";
import { detectLanguage, matchSummary } from "./match";
import {
  aiSuggestions,
  enforceFacts,
  heuristicSuggestions,
  heuristicTailor,
  type Suggestion,
  TAILOR_MAX_TOKENS,
  tailorPrompt,
  tailorSchema,
} from "./tailor";
import type { CvDoc, CvLanguage, MatchSummary, TailorSource, TailorTarget } from "./types";

export interface ResolvedTarget {
  target: TailorTarget;
  jobId: string | null;
  applicationId: string | null;
  /** Manual application without a job page: description must be pasted. */
  needsText: boolean;
}

/** Job or application the user owns → the posting to tailor for (null = not found / not theirs). */
export async function resolveTarget(
  userId: string,
  ref: { jobId?: string | null; applicationId?: string | null },
  jobText?: string | null,
): Promise<ResolvedTarget | null> {
  let applicationId: string | null = null;
  let jobId = ref.jobId ?? null;
  let manual: { title: string; company: string } | null = null;
  if (ref.applicationId) {
    const app = await db.application.findFirst({
      where: { id: ref.applicationId, userId },
      select: { id: true, jobId: true, title: true, company: true },
    });
    if (!app) return null;
    applicationId = app.id;
    jobId = app.jobId;
    if (!app.jobId) manual = { title: app.title ?? "", company: app.company ?? "" };
  } else if (jobId) {
    const app = await db.application.findFirst({ where: { userId, jobId }, select: { id: true } });
    applicationId = app?.id ?? null;
  }
  if (jobId) {
    const job = await db.job.findUnique({
      where: { id: jobId },
      select: { title: true, description: true, techStack: true, company: { select: { name: true } } },
    });
    if (!job) return null;
    return {
      jobId,
      applicationId,
      needsText: false,
      target: { title: job.title, company: job.company.name, description: job.description, techStack: job.techStack },
    };
  }
  if (!manual) return null;
  let text = jobText?.trim() ?? "";
  if (!text && applicationId) {
    const prev = await db.tailoredCv.findFirst({
      where: { userId, applicationId, jobText: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { jobText: true },
    });
    text = prev?.jobText ?? "";
  }
  return {
    jobId: null,
    applicationId,
    needsText: !text,
    target: { title: manual.title, company: manual.company, description: text.slice(0, 12_000), techStack: [] },
  };
}

/** The user's base CV (profile + primary resume) and the facts used for matching. */
export async function loadBaseCv(userId: string, locale: CvLanguage) {
  const [user, profile, resume] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
    db.profile.findUnique({ where: { userId } }),
    db.resume.findFirst({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { id: true, text: true, skills: true },
    }),
  ]);
  const professional = readProfessional(profile);
  const base = buildBaseCv({
    name: user?.name ?? null,
    email: user?.email ?? null,
    professional,
    profileSkills: profile?.skills ?? [],
    resumeText: resume?.text ?? null,
    resumeSkills: resume?.skills ?? [],
    locale,
  });
  return {
    base,
    resumeId: resume?.id ?? null,
    resumeText: resume?.text ?? null,
    hasDegree: professional.education.some((e) => e.kind === "DEGREE"),
  };
}

export interface TailorResult {
  doc: CvDoc;
  match: MatchSummary;
  suggestions: Suggestion[];
  source: TailorSource;
  reverted: number;
  reason?: AiLimitReason;
}

/** One Gemini call (guarded, cached) → validated merge; offline heuristic on mock, limits or bad output. */
export async function tailorCv(
  userId: string,
  base: CvDoc,
  target: TailorTarget,
  language: CvLanguage,
  facts: { resumeText: string | null; hasDegree: boolean },
): Promise<TailorResult> {
  const match = matchSummary(base, target, facts);
  const offline = heuristicTailor(base, target);
  const fallback = (source: TailorSource, reason?: AiLimitReason): TailorResult => ({
    doc: offline,
    match,
    suggestions: heuristicSuggestions(base, match),
    source,
    reverted: 0,
    reason,
  });
  const llm = await guardedLLM("cv_tailor", userId);
  if (llm.name === "mock") return fallback("offline");
  try {
    const raw = await llm.complete(tailorPrompt(base, target, language), {
      schema: tailorSchema,
      maxTokens: TAILOR_MAX_TOKENS,
    });
    const parsed = tailorSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback("offline");
    const { doc, reverted } = enforceFacts(base, offline, parsed.data, cvCorpus(base, facts.resumeText ?? ""));
    const extra = aiSuggestions(parsed.data);
    return {
      doc,
      match,
      suggestions: [...heuristicSuggestions(base, match), ...extra],
      source: "ai",
      reverted,
    };
  } catch (e) {
    if (e instanceof AiLimitError) return fallback("limited", e.reason);
    return fallback("offline");
  }
}

function targetWhere(userId: string, jobId: string | null, applicationId: string | null) {
  return jobId ? { userId, jobId } : { userId, applicationId };
}

export async function nextVersion(userId: string, jobId: string | null, applicationId: string | null) {
  const last = await db.tailoredCv.findFirst({
    where: targetWhere(userId, jobId, applicationId),
    orderBy: { version: "desc" },
    select: { version: true },
  });
  return (last?.version ?? 0) + 1;
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Generate and save a new tailored version; returns its id and the limit reason (if any). */
export async function generateTailoredCv(
  userId: string,
  resolved: ResolvedTarget,
  opts: { language?: CvLanguage | null; jobText?: string | null; uiLocale: CvLanguage },
) {
  const { target, jobId, applicationId } = resolved;
  const language = opts.language ?? detectLanguage(`${target.title}\n${target.description}`);
  const { base, resumeId, resumeText, hasDegree } = await loadBaseCv(userId, language);
  const result = await tailorCv(userId, base, target, language, { resumeText, hasDegree });
  const row = await db.tailoredCv.create({
    data: {
      userId,
      jobId,
      applicationId,
      baseResumeId: resumeId,
      title: target.title.slice(0, 200),
      company: target.company.slice(0, 200),
      jobText: jobId ? null : (opts.jobText?.trim().slice(0, 12_000) ?? target.description) || null,
      language,
      version: await nextVersion(userId, jobId, applicationId),
      content: json(result.doc),
      base: json(base),
      match: json(result.match),
      suggestions: json(result.suggestions),
      source: result.source,
    },
    select: { id: true },
  });
  return { id: row.id, source: result.source, reason: result.reason, reverted: result.reverted };
}

/**
 * Save the user's edits as a new version. Company, title and dates are re-taken from the stored
 * base CV (the editor cannot change them); text the user writes is theirs.
 */
export async function saveEditedVersion(userId: string, id: string, edited: CvDoc) {
  const prev = await db.tailoredCv.findFirst({ where: { id, userId } });
  if (!prev) return null;
  const base = prev.base as unknown as CvDoc;
  const doc: CvDoc = {
    ...edited,
    experience: base.experience.map((role) => {
      const e = edited.experience.find((x) => x.id === role.id);
      if (!e) return role;
      const kept = e.bullets.map((b, i) => ({ b: b.trim(), o: e.origin?.[i] ?? -1 })).filter((x) => x.b);
      return {
        ...role,
        bullets: kept.map((x) => x.b),
        origin: kept.map((x) => (Number.isInteger(x.o) && x.o >= -1 && x.o < role.bullets.length ? x.o : -1)),
      };
    }),
    education: base.education,
  };
  const row = await db.tailoredCv.create({
    data: {
      userId,
      jobId: prev.jobId,
      applicationId: prev.applicationId,
      baseResumeId: prev.baseResumeId,
      title: prev.title,
      company: prev.company,
      jobText: prev.jobText,
      language: prev.language,
      version: await nextVersion(userId, prev.jobId, prev.applicationId),
      content: json(doc),
      base: json(base),
      match: json(prev.match),
      suggestions: json(prev.suggestions),
      source: "edited",
    },
    select: { id: true },
  });
  return row.id;
}

export async function versionsFor(userId: string, jobId: string | null, applicationId: string | null) {
  return db.tailoredCv.findMany({
    where: targetWhere(userId, jobId, applicationId),
    orderBy: { version: "desc" },
    select: { id: true, version: true, source: true, language: true, createdAt: true },
    take: 30,
  });
}
