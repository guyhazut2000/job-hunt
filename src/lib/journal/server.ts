/** Work journal — DB + guarded AI glue (docs/work-journal.md). */
import type { Prisma } from "@prisma/client";
import { guardedLLM } from "@/lib/ai";
import { hebrewGender } from "@/lib/cv-assist/ai";
import { targetKeywords } from "@/lib/cv-assist/core";
import { loadUploadedCvs, targetJobs } from "@/lib/cv-assist/server";
import { toBullets } from "@/lib/cv-tailor/base";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
import { extractInsights, suggestJournalBullets, type JournalBulletsResult } from "./ai";
import {
  answersSchema,
  defaultRole,
  inPeriod,
  roleKey,
  roleLabel,
  type Answer,
  type Insights,
  type JournalEntryLite,
  type RoleRef,
} from "./core";

export const langOfText = (s: string): "he" | "en" =>
  /[\u0590-\u05ff]/.test(s) ? "he" : /[a-z]/i.test(s) ? "en" : "he";

export interface JournalRole extends RoleRef {
  key: string;
  label: string;
}

export async function journalRoles(userId: string): Promise<{ roles: JournalRole[]; current: string | null }> {
  const p = readProfessional(await db.profile.findUnique({ where: { userId } }));
  const roles = p.experience.map((e, index) => ({
    index,
    company: e.company,
    title: e.title,
    start: e.start ?? "",
    end: e.end ?? "",
    key: roleKey(e.company, e.title),
    label: roleLabel(e),
  }));
  return { roles, current: defaultRole(roles)?.key ?? null };
}

export interface JournalEntryView extends JournalEntryLite {
  roleKey: string;
  roleLabel: string;
}

const readInsights = (v: unknown): Insights | null =>
  v && typeof v === "object" && Array.isArray((v as Insights).achievements) ? (v as Insights) : null;
const readAnswers = (v: unknown): Answer[] => {
  const p = answersSchema.safeParse(v);
  return p.success ? p.data : [];
};

export function toView(e: {
  id: string;
  day: string;
  text: string;
  roleKey: string;
  roleLabel: string;
  insights: Prisma.JsonValue | null;
  answers: Prisma.JsonValue;
}): JournalEntryView {
  return {
    id: e.id,
    day: e.day,
    text: e.text,
    roleKey: e.roleKey,
    roleLabel: e.roleLabel,
    insights: readInsights(e.insights),
    answers: readAnswers(e.answers),
  };
}

export async function listEntries(
  userId: string,
  opts: { roleKey?: string; take?: number } = {},
): Promise<JournalEntryView[]> {
  const rows = await db.workJournalEntry.findMany({
    where: { userId, ...(opts.roleKey ? { roleKey: opts.roleKey } : {}) },
    orderBy: [{ day: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 200,
  });
  return rows.map(toView);
}

/** Read achievements + follow-up questions for one entry (guarded AI, rules fallback) and store them. */
export async function analyzeEntry(userId: string, id: string): Promise<JournalEntryView | null> {
  const e = await db.workJournalEntry.findFirst({ where: { id, userId } });
  if (!e) return null;
  const answers = readAnswers(e.answers);
  const insights = await extractInsights(await guardedLLM("journal_extract", userId), {
    text: e.text,
    role: e.roleLabel,
    lang: langOfText(e.text),
    answers,
  });
  const saved = await db.workJournalEntry.update({
    where: { id },
    data: { insights: insights as unknown as Prisma.InputJsonValue },
  });
  return toView(saved);
}

export interface BulletsRequest {
  roleKey: string;
  from?: string | null;
  to?: string | null;
  jobId?: string | null;
  lang?: "he" | "en";
  /** Bullets the role has right now (the CV builder draft); defaults to the profile's. */
  existing?: string[];
}

export async function journalBullets(
  userId: string,
  req: BulletsRequest,
): Promise<JournalBulletsResult & { entries: number; have: string[]; missing: string[]; role: JournalRole | null }> {
  const [{ roles }, rows, uploaded, jobs] = await Promise.all([
    journalRoles(userId),
    db.workJournalEntry.findMany({
      where: { userId, roleKey: req.roleKey },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
    loadUploadedCvs(userId),
    targetJobs(userId),
  ]);
  const role = roles.find((r) => r.key === req.roleKey) ?? null;
  const entries = rows.map(toView).filter((e) => inPeriod(e.day, req.from, req.to));
  const profile = readProfessional(await db.profile.findUnique({ where: { userId } }));
  const existing = req.existing ?? (role ? toBullets(profile.experience[role.index]?.description ?? "") : []);
  const corpus = [
    profile.headline,
    profile.summary,
    ...profile.experience.map((x) => x.description),
    ...profile.skillItems.map((s) => s.name),
    uploaded.text,
  ].join("\n");
  const chosen = req.jobId ? jobs.filter((j) => j.id === req.jobId) : jobs;
  const kw = targetKeywords(chosen, `${corpus}\n${entries.map((e) => e.text).join("\n")}`);
  const lang = req.lang ?? langOfText(entries.map((e) => e.text).join(" ") || corpus);
  const label = role?.label ?? rows[0]?.roleLabel ?? "";
  if (!entries.length) return { status: "ok", source: "ai", bullets: [], rejected: 0, entries: 0, ...kw, role };
  const res = await suggestJournalBullets(await guardedLLM("journal_bullets", userId), {
    role: label,
    lang,
    gender: hebrewGender([profile.headline, profile.summary, ...profile.experience.map((x) => x.title)]),
    entries,
    existing,
    have: kw.have,
    targetTitle: req.jobId && chosen[0] ? `${chosen[0].title} @ ${chosen[0].company}` : undefined,
    corpus,
  });
  return { ...res, entries: entries.length, ...kw, role };
}

/** Append an accepted bullet to that role's description in the profile (explicit user action). */
export async function addBulletToRole(
  userId: string,
  key: string,
  bullet: string,
): Promise<"added" | "exists" | "no-role"> {
  const profile = await db.profile.findUnique({ where: { userId } });
  const p = readProfessional(profile);
  const idx = p.experience.findIndex((e) => roleKey(e.company, e.title) === key);
  if (!profile || idx < 0) return "no-role";
  const text = bullet.replace(/\s+/g, " ").trim();
  const bullets = toBullets(p.experience[idx].description ?? "");
  if (bullets.some((b) => b.trim() === text)) return "exists";
  const experience = p.experience.map((e, i) => (i === idx ? { ...e, description: [...bullets, text].join("\n") } : e));
  await db.profile.update({ where: { userId }, data: { experience: experience as unknown as Prisma.InputJsonValue } });
  return "added";
}
