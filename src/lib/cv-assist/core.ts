/**
 * CV builder AI assist — pure logic (docs/cv-ai-assist.md).
 *
 * Every suggestion is a proposal: the editor previews it with accept / edit / reject and only
 * changes the unsaved draft. Nothing here invents an employer, date, degree or number:
 *  - "import" copies items verbatim from the user's own uploaded CVs;
 *  - AI rewrites pass `acceptAssist` (no new number or technology vs. the user's own facts);
 *  - a missing number becomes an explicit placeholder like "[X%]" that the user must fill in
 *    (saving is blocked while a placeholder is left, see `draftPlaceholders`).
 */
import { introducesFacts } from "@/lib/cv-tailor/tailor";
import { toBullets } from "@/lib/cv-tailor/base";
import { LIMITS } from "@/lib/cv-standard/rules";
import { hasFirstPersonPronoun, hasMetric } from "@/lib/cv-standard/verbs";
import type { Draft, NewEducation, NewEntry } from "@/lib/cv-standard/draft";
import { PLACEHOLDER_RE } from "@/lib/cv-standard/draft";
import { categorizeSkill, type Professional, type SkillCategory } from "@/lib/profile/schema";
import { canonicalSkill } from "@/lib/skill-suggest/core";
import { extractTech } from "@/lib/taxonomy";

export type AssistStep = "contact" | "summary" | "experience" | "projects" | "education" | "skills";
export const ASSIST_STEPS: AssistStep[] = ["contact", "summary", "experience", "projects", "education", "skills"];
export type Origin = "import" | "improve" | "tailor";
export type FieldKey = "headline" | "summary" | "phone" | "location" | "linkedinUrl" | "githubUrl" | "portfolioUrl";
export type EntrySection = "experience" | "projects";

export type Suggestion =
  | { id: string; kind: "field"; origin: Origin; field: FieldKey; before: string; text: string; from?: string }
  | {
      id: string;
      kind: "bullet";
      origin: Origin;
      section: EntrySection;
      /** Entry index in the draft. */
      index: number;
      /** Bullet index to replace, or null to append a new bullet. */
      replace: number | null;
      before: string;
      text: string;
      /** Role / project label shown above the suggestion. */
      label: string;
      from?: string;
    }
  | {
      id: string;
      kind: "entry";
      origin: "import";
      section: EntrySection;
      entry: NewEntry;
      bullets: string[];
      from?: string;
    }
  | { id: string; kind: "education"; origin: "import"; item: NewEducation; from?: string }
  | { id: string; kind: "skill"; origin: "import"; name: string; category: SkillCategory; from?: string };

/** What the editor shows for an entry (profile entries + entries added in the draft). */
export interface EntryRef {
  title: string;
  org: string;
}

export interface UploadedCv {
  label: string;
  profile: Professional;
}

// ---------- text helpers ----------

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "") // niqqud
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(" ")
      .filter((w) => w.length > 1),
  );
}
/** Token Jaccard similarity (0..1). */
export function similarity(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size && !y.size) return 1;
  let inter = 0;
  for (const w of x) if (y.has(w)) inter++;
  return inter / (x.size + y.size - inter || 1);
}
const same = (a: string, b: string) => {
  const na = norm(a);
  const nb = norm(b);
  return !!na && !!nb && (na === nb || similarity(a, b) >= 0.7);
};
/** Same organization: equal, or one name contains the other ("Wix" vs "Wix.com Ltd"). */
export function sameOrg(a: string, b: string): boolean {
  const clean = (x: string) =>
    ` ${norm(x).replace(/\./g, " ")} `
      .replace(/ (ltd|inc|llc|group|com|co|io|בע"?מ) /g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = clean(a);
  const nb = clean(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [s, l] = na.length <= nb.length ? [na, nb] : [nb, na];
  return s.length >= 3 && ` ${l} `.includes(` ${s} `);
}
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};
const sid = (...parts: (string | number | null)[]) => hash(parts.join("|"));
const period = (start: string, end: string) => [start, end].filter(Boolean).join(" – ");

// ---------- import from uploaded CVs ----------

/** The draft's entries with their labels (profile entries first, then accepted imports). */
export function entryRefs(base: EntryRef[], draft: Draft["experience"]): EntryRef[] {
  return draft.map((d, i) => (d.add ? { title: d.add.title, org: d.add.org } : (base[i] ?? { title: "", org: "" })));
}

function findEntry(refs: EntryRef[], title: string, org: string, section: EntrySection): number {
  if (section === "experience") {
    const byOrg = refs.findIndex(
      (r) => sameOrg(r.org, org) && (!title || !r.title || similarity(r.title, title) >= 0.25),
    );
    if (byOrg >= 0) return byOrg;
    return refs.findIndex((r) => sameOrg(r.org, org));
  }
  return refs.findIndex((r) => same(r.title, title) || (!!r.title && sameOrg(r.title, title)));
}

const MAX_IMPORT_BULLETS = 8;

/**
 * Diff the user's uploaded CVs against the draft for one step. Items already in the draft (or a
 * close paraphrase of them) are skipped; everything is copied verbatim from the CV.
 */
export function importSuggestions(input: {
  step: AssistStep;
  cvs: UploadedCv[];
  draft: Draft;
  experience: EntryRef[];
  projects: EntryRef[];
  education: { institution: string; title: string }[];
}): Suggestion[] {
  const { step, cvs, draft } = input;
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  if (step === "contact" || step === "summary") {
    const fields: FieldKey[] =
      step === "contact" ? ["phone", "location", "linkedinUrl", "githubUrl", "portfolioUrl"] : ["headline", "summary"];
    for (const cv of cvs) {
      for (const f of fields) {
        const v = String((cv.profile as unknown as Record<string, unknown>)[f] ?? "").trim();
        if (!v) continue;
        const cur = String(draft[f] ?? "").trim();
        // Contact details only fill empty fields; headline/summary may replace a different text.
        if (step === "contact" ? !!cur : cur && (norm(cur) === norm(v) || similarity(cur, v) >= 0.85)) continue;
        push(
          { id: sid("f", f, v), kind: "field", origin: "import", field: f, before: cur, text: v, from: cv.label },
          `f:${f}:${norm(v)}`,
        );
      }
    }
    return out;
  }

  if (step === "experience" || step === "projects") {
    const sec = step;
    const refs = entryRefs(sec === "experience" ? input.experience : input.projects, draft[sec]);
    const max = sec === "experience" ? 30 : 20;
    for (const cv of cvs) {
      const items =
        sec === "experience"
          ? cv.profile.experience.map((e) => ({
              title: e.title,
              org: e.company,
              start: e.start,
              end: e.end,
              desc: e.description,
            }))
          : cv.profile.projects.map((p) => ({
              title: p.name,
              org: p.role,
              start: p.start,
              end: p.end,
              desc: p.description,
            }));
      for (const it of items) {
        if (!it.title && !it.org) continue;
        const bullets = toBullets(it.desc ?? "")
          .map((b) => b.replace(/\s+/g, " ").trim())
          .filter((b) => b.length > 3 && b.length <= LIMITS.bulletMaxChars);
        const at = findEntry(refs, it.title, it.org, sec);
        if (at >= 0) {
          const have = draft[sec][at]?.bullets ?? [];
          let n = 0;
          for (const b of bullets) {
            if (have.some((h) => same(h, b)) || n >= MAX_IMPORT_BULLETS) continue;
            n++;
            const r = refs[at];
            push(
              {
                id: sid("b", sec, at, b),
                kind: "bullet",
                origin: "import",
                section: sec,
                index: at,
                replace: null,
                before: "",
                text: b,
                label: [r.title, r.org].filter(Boolean).join(" · "),
                from: cv.label,
              },
              `b:${sec}:${at}:${norm(b)}`,
            );
          }
        } else if (draft[sec].length + out.filter((s) => s.kind === "entry").length < max) {
          const entry: NewEntry = {
            title: (it.title || it.org).slice(0, 120),
            org: (sec === "experience" ? it.org : it.org || "").slice(0, 120),
            start: it.start ?? "",
            end: it.end ?? "",
          };
          push(
            {
              id: sid("e", sec, entry.title, entry.org, entry.start),
              kind: "entry",
              origin: "import",
              section: sec,
              entry,
              bullets: bullets.slice(0, MAX_IMPORT_BULLETS),
              from: cv.label,
            },
            `e:${sec}:${norm(entry.title)}:${norm(entry.org)}`,
          );
        }
      }
    }
    return out;
  }

  if (step === "education") {
    const have = [
      ...input.education,
      ...(draft.education ?? []).map((e) => ({ institution: e.institution, title: e.title })),
    ];
    for (const cv of cvs) {
      for (const e of cv.profile.education) {
        if (!e.institution) continue;
        const dup = have.some(
          (h) =>
            (sameOrg(h.institution, e.institution) || same(h.institution, e.institution)) &&
            (!e.title || !h.title || same(h.title, e.title)),
        );
        if (dup) continue;
        const item: NewEducation = {
          kind: e.kind,
          institution: e.institution,
          title: e.title ?? "",
          start: e.start ?? "",
          end: e.end ?? "",
        };
        push(
          { id: sid("ed", item.institution, item.title), kind: "education", origin: "import", item, from: cv.label },
          `ed:${norm(item.institution)}:${norm(item.title)}`,
        );
      }
    }
    return out;
  }

  // skills
  const haveKeys = new Set(draft.skills.map((s) => canonicalSkill(s.name)?.key).filter(Boolean));
  for (const cv of cvs) {
    const names = [
      ...cv.profile.skillItems.map((s) => s.name),
      ...cv.profile.experience.flatMap((e) => e.tech),
      ...cv.profile.projects.flatMap((p) => p.tech),
    ];
    for (const raw of names) {
      const c = canonicalSkill(raw);
      if (!c || haveKeys.has(c.key)) continue;
      const name = (cv.profile.skillItems.find((s) => canonicalSkill(s.name)?.key === c.key)?.name ?? c.label).slice(
        0,
        40,
      );
      const category =
        cv.profile.skillItems.find((s) => canonicalSkill(s.name)?.key === c.key)?.category ?? categorizeSkill(name);
      push({ id: sid("s", c.key), kind: "skill", origin: "import", name, category, from: cv.label }, `s:${c.key}`);
    }
  }
  return out;
}

// ---------- applying a suggestion (client side, draft only) ----------

/** Apply one accepted suggestion (optionally edited by the user) to the draft. Never saves. */
export function applySuggestion(d: Draft, s: Suggestion, edited?: string): Draft {
  const text = (edited ?? ("text" in s ? s.text : "")).trim();
  switch (s.kind) {
    case "field":
      return { ...d, [s.field]: text };
    case "bullet": {
      const list = d[s.section];
      if (!list[s.index]) return d;
      const next = list.map((e, i) => {
        if (i !== s.index) return e;
        if (s.replace != null && s.replace < e.bullets.length)
          return { ...e, bullets: e.bullets.map((b, bi) => (bi === s.replace ? text : b)) };
        if (e.bullets.length >= 20) return e;
        // Fill an empty trailing bullet first.
        const empty = e.bullets.findIndex((b) => !b.trim());
        return empty >= 0
          ? { ...e, bullets: e.bullets.map((b, bi) => (bi === empty ? text : b)) }
          : { ...e, bullets: [...e.bullets, text] };
      });
      return { ...d, [s.section]: next };
    }
    case "entry": {
      const max = s.section === "experience" ? 30 : 20;
      if (d[s.section].length >= max) return d;
      return { ...d, [s.section]: [...d[s.section], { bullets: [...s.bullets], add: { ...s.entry } }] };
    }
    case "education":
      if ((d.education ?? []).length >= 20) return d;
      return { ...d, education: [...(d.education ?? []), { ...s.item }] };
    case "skill":
      if (d.skills.length >= 80 || d.skills.some((x) => canonicalSkill(x.name)?.key === canonicalSkill(s.name)?.key))
        return d;
      return { ...d, skills: [...d.skills, { name: (edited?.trim() || s.name).slice(0, 40), category: s.category }] };
  }
}

/** Remove an entry that was added from the import (profile entries are removed in the profile). */
export function removeAdded(d: Draft, section: EntrySection, index: number): Draft {
  if (!d[section][index]?.add) return d;
  return { ...d, [section]: d[section].filter((_, i) => i !== index) };
}

export function suggestionLabel(s: Suggestion): string {
  switch (s.kind) {
    case "entry":
      return [s.entry.title, s.entry.org, period(s.entry.start, s.entry.end)].filter(Boolean).join(" · ");
    case "education":
      return [s.item.title, s.item.institution, period(s.item.start, s.item.end)].filter(Boolean).join(" · ");
    case "skill":
      return s.name;
    default:
      return s.text;
  }
}

// ---------- target-job keywords ----------

export interface TargetJob {
  id: string;
  title: string;
  company: string;
  score: number;
  required: string[];
  preferred: string[];
}

/**
 * Keywords of the chosen target job(s), split into ones the user already has somewhere in their
 * CV (the rewrite may surface them) and ones they don't (shown as a gap, never written in).
 */
export function targetKeywords(jobs: TargetJob[], corpus: string): { have: string[]; missing: string[] } {
  const own = new Set(extractTech(corpus).map((t) => canonicalSkill(t)?.key ?? t));
  const n = norm(corpus);
  const count = new Map<string, { label: string; n: number }>();
  for (const j of jobs)
    for (const raw of [...j.required, ...j.preferred]) {
      const c = canonicalSkill(raw);
      if (!c) continue;
      const prev = count.get(c.key);
      count.set(c.key, { label: prev?.label ?? c.label, n: (prev?.n ?? 0) + 1 });
    }
  const ranked = [...count.entries()].sort((a, b) => b[1].n - a[1].n);
  const have: string[] = [];
  const missing: string[] = [];
  for (const [key, v] of ranked) {
    const inCv = own.has(key) || n.includes(norm(v.label));
    (inCv ? have : missing).push(v.label);
  }
  return { have: have.slice(0, 15), missing: missing.slice(0, 10) };
}

// ---------- validation of AI rewrites ----------

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const stripPlaceholders = (s: string) => s.replace(new RegExp(PLACEHOLDER_RE.source, "g"), " ");
export const hasPlaceholder = (s: string) => PLACEHOLDER_RE.test(s);

/**
 * Accept an AI rewrite only when it adds no fact: every number must already be in the original
 * text (placeholders like "[X%]" are fine — they are not facts), every technology must appear in
 * the user's own CV corpus (a job keyword the user doesn't have is never written in).
 */
export function acceptAssist(
  original: string,
  rewrite: string,
  corpus: string,
  opts: { maxChars: number; allowEmptyOriginal?: boolean } = { maxChars: LIMITS.bulletMaxChars },
): string | null {
  const r = rewrite
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.。]+$/, (m) => (opts.maxChars > 400 ? m : ""));
  if (!r || r.length > opts.maxChars) return null;
  if (!original.trim() && !opts.allowEmptyOriginal) return null;
  const allowedTech = new Set(extractTech(`${original}\n${corpus}`));
  const allowedNums = new Set((original.match(NUM_RE) ?? []).map((n) => n.replace(",", ".")));
  if (introducesFacts(stripPlaceholders(r), allowedTech, allowedNums)) return null;
  if (hasFirstPersonPronoun(r) && !hasFirstPersonPronoun(original)) return null;
  if (original.trim()) {
    const ratio = r.length / Math.max(1, original.length);
    if (ratio > 3.2 || ratio < 0.25) return null;
  }
  if (norm(r) === norm(original)) return null;
  return r;
}

/**
 * Rules fallback for "X-Y-Z" when the AI is off or over its limit: a bullet with no number gets the
 * result clause as explicit placeholders for the user to fill in — never a guessed number.
 */
export function placeholderXyz(bullet: string, lang: "he" | "en"): string | null {
  const b = bullet.trim().replace(/[.。]+$/, "");
  if (!b || hasMetric(b) || hasPlaceholder(b)) return null;
  const out = lang === "he" ? `${b}, מה ששיפר את [מדד] ב-[X%]` : `${b}, improving [metric] by [X%]`;
  return out.length <= LIMITS.bulletMaxChars ? out : null;
}

/** Rules headline for "tailor to target job": the user's own title + matching skills they have. */
export function ruleHeadline(current: string, roleTitle: string, have: string[]): string | null {
  const base = (current.split("|")[0] || roleTitle).trim();
  if (!base || !have.length) return null;
  const out = `${base} | ${have.slice(0, 3).join(", ")}`;
  return out.length <= 140 && norm(out) !== norm(current) ? out : null;
}
