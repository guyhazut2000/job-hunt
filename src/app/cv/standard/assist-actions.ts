"use server";
/**
 * CV builder AI assist actions (docs/cv-ai-assist.md). They only RETURN suggestions — the editor
 * previews them with accept / edit / reject and nothing reaches the profile until "Save".
 */
import { guardedLLM } from "@/lib/ai";
import { ASSIST_STEPS, entryRefs, importSuggestions, targetKeywords, type AssistStep } from "@/lib/cv-assist/core";
import { rewriteBullets, rewriteField, type AssistResult, type Mode } from "@/lib/cv-assist/ai";
import { loadUploadedCvs, targetJobs } from "@/lib/cv-assist/server";
import { draftSchema, type Draft } from "@/lib/cv-standard/draft";
import { contentStrings } from "@/lib/cv-templates/content";
import { loadCvSource } from "@/lib/cv-templates/server";
import { db } from "@/lib/db";
import { readProfessional } from "@/lib/profile/load";
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
  const [{ cvs }, profile] = await Promise.all([
    loadUploadedCvs(user.id),
    db.profile.findUnique({ where: { userId: user.id } }),
  ]);
  if (!cvs.length) return { status: "ok", source: "import", suggestions: [], rejected: 0, cvs: 0 };
  const p = readProfessional(profile);
  const suggestions = importSuggestions({
    step,
    cvs,
    draft: parsed.data,
    experience: p.experience.map((e) => ({ title: e.title, org: e.company })),
    projects: p.projects.map((x) => ({ title: x.name, org: x.role })),
    education: p.education.map((e) => ({ institution: e.institution, title: e.title })),
  });
  return { status: "ok", source: "import", suggestions, rejected: 0, cvs: cvs.length };
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
  const lang = langOf(d);
  const p = readProfessional(profile);
  const llm = await guardedLLM("cv_assist", user.id);

  let res: AssistResult;
  if (input.step === "summary") {
    const field = input.field === "headline" ? "headline" : "summary";
    res = await rewriteField(llm, {
      field,
      mode,
      lang,
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
      entries: d[sec].map((e, index) => ({ index, ...refs[index], bullets: e.bullets })),
      have: kw.have,
      targetTitle,
      corpus,
    });
  } else return EMPTY;
  return mode === "tailor" ? { ...res, have: kw.have, missing: kw.missing } : res;
}
