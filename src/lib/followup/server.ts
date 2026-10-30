import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { guardedLLM } from "@/lib/ai";
import { AiLimitError } from "@/lib/ai/errors";
import { detectLanguage } from "@/lib/cv-tailor/match";
import { readProfessional } from "@/lib/profile/load";
import {
  draftPrompt,
  draftSchema,
  recruiterFrom,
  templateDraft,
  validateAiDraft,
  type DraftLang,
  type FollowUpDraft,
  type FollowUpFacts,
} from "./draft";
import { FOLLOW_UP_MAX, RESPONSE_CANDIDATE_STATUSES } from "./timing";

const firstSentence = (s: string | null | undefined, max = 200): string | null => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const cut = t.split(/(?<=[.!?])\s/)[0] ?? t;
  return cut.length > max ? null : cut;
};

/** Recruiter address from the newest non-system sender on this application's Gmail-scan emails. */
export async function recruiterForApplication(userId: string, applicationId: string) {
  const rows = await db.emailCandidate.findMany({
    where: { userId, applicationId, status: { not: "DISMISSED" } },
    orderBy: { receivedAt: "desc" },
    select: { fromAddress: true },
    take: 10,
  });
  for (const r of rows) {
    const hit = recruiterFrom(r.fromAddress);
    if (hit) return hit;
  }
  return null;
}

/** Applications (of these ids) that got a reply/status-update email after the user applied. */
export async function emailResponses(
  apps: Array<{ id: string; appliedAt: Date | null; createdAt: Date }>,
): Promise<Set<string>> {
  if (!apps.length) return new Set();
  const rows = await db.emailCandidate.findMany({
    where: {
      applicationId: { in: apps.map((a) => a.id) },
      kind: "STATUS_UPDATE",
      status: { in: [...RESPONSE_CANDIDATE_STATUSES] },
    },
    select: { applicationId: true, receivedAt: true },
    take: 5000,
  });
  const applied = new Map(apps.map((a) => [a.id, (a.appliedAt ?? a.createdAt).getTime()]));
  const out = new Set<string>();
  for (const r of rows) {
    const t = r.applicationId ? applied.get(r.applicationId) : undefined;
    if (t != null && r.receivedAt.getTime() >= t) out.add(r.applicationId!);
  }
  return out;
}

type AppForDraft = Prisma.ApplicationGetPayload<{
  include: { job: { select: { title: true; description: true; techStack: true } } };
}>;

/** Facts for the draft — only things we know to be true. */
export async function draftFacts(userId: string, app: AppForDraft, lang: DraftLang, recipientName: string | null) {
  const [profile, user, cv] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
    db.tailoredCv.findFirst({
      where: { userId, OR: [{ applicationId: app.id }, ...(app.jobId ? [{ jobId: app.jobId }] : [])] },
      orderBy: { createdAt: "desc" },
      select: { language: true, content: true },
    }),
  ]);
  const pro = readProfessional(profile);
  const wanted = new Set((app.job?.techStack ?? []).map((s) => s.toLowerCase()));
  const skills = pro.skillItems.map((s) => s.name).filter((n) => wanted.has(n.toLowerCase()));
  let highlight: string | null = null;
  const doc = cv?.content as { summary?: string; headline?: string } | null;
  if (doc && cv?.language === lang) highlight = firstSentence(doc.summary) ?? firstSentence(doc.headline);
  if (!highlight) {
    const s = firstSentence(pro.summary) ?? firstSentence(pro.headline);
    if (s && detectLanguage(s) === lang) highlight = s;
  }
  const facts: FollowUpFacts = {
    title: app.title,
    company: app.company,
    appliedAt: app.appliedAt ?? app.createdAt,
    round: (Math.min(FOLLOW_UP_MAX, (app.followUpCount ?? 0) + 1) as 1 | 2),
    highlight,
    skills: skills.slice(0, 3),
    name: user?.name || null,
    recipientName,
  };
  return facts;
}

/** Default draft language: the posting's language (or the company/title text when there's no posting). */
export function defaultLang(app: AppForDraft): DraftLang {
  const text = app.job ? `${app.job.title}\n${app.job.description ?? ""}` : `${app.title} ${app.company}`;
  return detectLanguage(text);
}

/** One guarded AI call (cached on identical facts); template on mock/limit/error/invalid output. */
export async function generateDraft(
  userId: string,
  facts: FollowUpFacts,
  lang: DraftLang,
  to: string | null,
): Promise<FollowUpDraft> {
  const template = templateDraft(facts, lang, to);
  const llm = await guardedLLM("follow_up", userId);
  if (llm.name === "mock") return template;
  try {
    const raw = await llm.complete(draftPrompt(facts, lang), { schema: draftSchema, maxTokens: 600 });
    const ok = validateAiDraft(JSON.parse(raw), facts);
    if (!ok) return template;
    return { round: facts.round, lang, subject: ok.subject, body: ok.body, source: "ai", to };
  } catch (e) {
    if (e instanceof AiLimitError) return { ...template, source: "limited" };
    return template;
  }
}
