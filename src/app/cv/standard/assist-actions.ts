"use server";
/**
 * CV builder AI assist actions (docs/cv-ai-assist.md). They only RETURN suggestions — the editor
 * previews them with accept / edit / reject and nothing reaches the profile until "Save".
 */
import { guardedLLM } from "@/lib/ai";
import { ASSIST_STEPS, entryRefs, importSuggestions, targetKeywords, type AssistStep } from "@/lib/cv-assist/core";
import { hebrewGender, rewriteBullets, rewriteField, type AssistResult, type Mode } from "@/lib/cv-assist/ai";
import { loadUploadedCvs, targetJobs } from "@/lib/cv-assist/server";
import { draftSchema, type Draft } from "@/lib/cv-standard/draft";
import { contentStrings } from "@/lib/cv-templates/content";
import { loadCvSource } from "@/lib/cv-templates/server";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
import { israelDayOf, roleKey } from "@/lib/journal/core";
import { journalBullets } from "@/lib/journal/server";
import { requireUser } from "@/lib/session";

const EMPTY: AssistResult = { status: "error", source: "import", suggestions: [], rejected: 0 };

function langOf(d: Draft): "he" | "en" {
  const all = [d.headline, d.summary, ...d.experience.flatMap((e) => e.bullets)].join(" ");
  if (/[\u0590-\u05ff]/.test(all)) return "he";
  return /[a-z]/i.test(all) ? "en" : "he";
}

/** "Import from my uploaded CV" for one step: items in the user's CVs that the draft lacks. */
export async function assistImportAction(step: AssistStep, rawDraft: Draft): Promise<AssistResult & { cvs: number }> {
  const user = await requireUser("/cv/standard");
  const parsed = draftSchema.safeParse(rawDraft);
  if (!parsed.success || !ASSIST_STEPS.includes(step)) return { ...EMPTY, cvs: 0 };
  const [{ cvs, readBy }, profile] = await Promise.all([
    loadUploadedCvs(user.id, { ai: true }),
    db.profile.findUnique({ where: { userId: user.id } }),
  ]);
  if (!cvs.length) return { status: "ok", source: "import", suggestions: [], rejected: 0, cvs: 0, readBy };
  const p = readProfessional(profile);
  const suggestions = importSuggestions({
    step,
    cvs,
    draft: parsed.data,
    experience: p.experience.map((e) => ({ title: e.title, org: e.company })),
    projects: p.projects.map((x) => ({ title: x.name, org: x.role })),
    education: p.education.map((e) => ({ institution: e.institution, title: e.title })),
  });
  return { status: "ok", source: "import", suggestions, rejected: 0, cvs: cvs.length, readBy };
}

/**
 * "Improve wording" / "Tailor to target job" (X-Y-Z for bullets). `jobId` picks one of the
 * top-matching jobs; null uses all of them.
 */
export async function assistRewriteAction(input: {
  step: AssistStep;
  draft: Draft;
  mode: Mode;
  field?: "headline" | "summary";
  jobId?: string | null;
  /** Language of the CV being built (the page check's language). */
  lang?: "he" | "en";
}): Promise<AssistResult> {
  const user = await requireUser("/cv/standard");
  const parsed = draftSchema.safeParse(input.draft);
  if (!parsed.success) return EMPTY;
  const d = parsed.data;
  const mode: Mode = input.mode === "tailor" ? "tailor" : "improve";
  const [source, uploaded, jobs, profile] = await Promise.all([
    loadCvSource(user.id),
    loadUploadedCvs(user.id),
    mode === "tailor" ? targetJobs(user.id) : Promise.resolve([]),
    db.profile.findUnique({ where: { userId: user.id } }),
  ]);
  const corpus = [
    ...contentStrings(source.content),
    d.headline,
    d.summary,
    ...d.skills.map((s) => s.name),
    uploaded.text,
  ].join("\n");
  const chosen = input.jobId ? jobs.filter((j) => j.id === input.jobId) : jobs;
  const kw = mode === "tailor" ? targetKeywords(chosen, corpus) : { have: [], missing: [] };
  const targetTitle = input.jobId && chosen[0] ? `${chosen[0].title} @ ${chosen[0].company}` : undefined;
  const lang = input.lang === "en" || input.lang === "he" ? input.lang : langOf(d);
  const p = readProfessional(profile);
  const gender = hebrewGender([d.headline, d.summary, ...p.experience.map((e) => e.title)]);
  const llm = await guardedLLM("cv_assist", user.id);

  let res: AssistResult;
  if (input.step === "summary") {
    const field = input.field === "headline" ? "headline" : "summary";
    res = await rewriteField(llm, {
      field,
      mode,
      lang,
      gender,
      text: d[field],
      have: kw.have,
      targetTitle,
      roleTitle: p.experience[0]?.title ?? "",
      corpus,
    });
  } else if (input.step === "experience" || input.step === "projects") {
    const sec = input.step;
    const refs = entryRefs(
      sec === "experience"
        ? p.experience.map((e) => ({ title: e.title, org: e.company }))
        : p.projects.map((x) => ({ title: x.name, org: x.role })),
      d[sec],
    );
    res = await rewriteBullets(llm, {
      section: sec,
      mode,
      lang,
      gender,
      entries: d[sec].map((e, index) => ({ index, ...refs[index], bullets: e.bullets })),
      have: kw.have,
      targetTitle,
      corpus,
    });
  } else return EMPTY;
  return mode === "tailor" ? { ...res, have: kw.have, missing: kw.missing } : res;
}

const JOURNAL_DAYS = 180;
const MAX_JOURNAL_ROLES = 3;

/**
 * "Suggestions from your work journal" (docs/work-journal.md): X-Y-Z bullets from the last
 * 6 months of journal entries of each draft role. Draft-only, like every other assist result.
 */
export async function assistJournalAction(rawDraft: Draft, lang?: "he" | "en"): Promise<AssistResult> {
  const user = await requireUser("/cv/standard");
  const parsed = draftSchema.safeParse(rawDraft);
  if (!parsed.success) return { ...EMPTY, source: "rules" };
  const d = parsed.data;
  const [profile, counts] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.workJournalEntry.groupBy({
      by: ["roleKey"],
      where: { userId: user.id, day: { gte: israelDayOf(new Date(Date.now() - JOURNAL_DAYS * 86_400_000)) } },
      _count: true,
    }),
  ]);
  const p = readProfessional(profile);
  const refs = entryRefs(
    p.experience.map((e) => ({ title: e.title, org: e.company })),
    d.experience,
  );
  const withEntries = new Set(counts.map((c) => c.roleKey));
  const targets = refs
    .map((r, index) => ({ index, ref: r, key: roleKey(r.org, r.title) }))
    .filter((t) => withEntries.has(t.key))
    .slice(0, MAX_JOURNAL_ROLES);
  const out: AssistResult = { status: "ok", source: "ai", suggestions: [], rejected: 0, journalEntries: 0 };
  if (!targets.length) return out;
  const from = israelDayOf(new Date(Date.now() - JOURNAL_DAYS * 86_400_000));
  const useLang = lang === "en" || lang === "he" ? lang : langOf(d);
  let anyRules = false;
  for (const t of targets) {
    const r = await journalBullets(user.id, {
      roleKey: t.key,
      from,
      lang: useLang,
      existing: d.experience[t.index]?.bullets ?? [],
    });
    out.journalEntries! += r.entries;
    out.rejected += r.rejected;
    if (r.source === "rules") anyRules = true;
    if (r.status !== "ok") out.status = r.status;
    r.bullets.forEach((b, j) =>
      out.suggestions.push({
        id: `j-${t.index}-${j}`,
        kind: "bullet",
        origin: "journal",
        section: "experience",
        index: t.index,
        replace: null,
        before: "",
        text: b.text,
        label: [t.ref.title, t.ref.org].filter(Boolean).join(" · "),
        from: b.days.length ? b.days.join(", ") : undefined,
      }),
    );
  }
  if (anyRules) out.source = "rules";
  return out;
}
