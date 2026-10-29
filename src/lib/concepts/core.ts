/**
 * Concepts glossary — pure helpers shared by server and client (docs/concepts.md).
 * No DB / AI imports here so this stays unit-testable and client-safe.
 */
import { z } from "zod";

export const CONCEPT_KINDS = ["TECH", "COMPANY"] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export const CONCEPT_STATUSES = ["NEW", "LEARNING", "UNDERSTOOD"] as const;
export type ConceptStatus = (typeof CONCEPT_STATUSES)[number];

export const CONCEPT_CATEGORIES = [
  "devops",
  "networking",
  "architecture",
  "cli-os",
  "backend",
  "frontend",
  "data",
  "security",
  "practices",
  "company",
] as const;
export type ConceptCategory = (typeof CONCEPT_CATEGORIES)[number];

export const DRILL_ACTIONS = ["deeper", "simpler", "example", "mistakes", "compare"] as const;
export type DrillAction = (typeof DRILL_ACTIONS)[number];
export type ConceptAction = DrillAction | "chat";

export const NAME_MAX = 80;
export const NOTES_MAX = 4000;
export const CHAT_MAX = 1000;
export const TAG_MAX = 24;
export const TAGS_MAX = 8;

/** Common spellings → canonical slug, so "brew" and "Homebrew" share one concept and one cached overview. */
const ALIASES: Record<string, string> = {
  brew: "homebrew",
  osi: "osi-model",
  "osi-layers": "osi-model",
  "osi-7-layers": "osi-model",
  "the-osi-model": "osi-model",
  cicd: "ci-cd",
  "ci-cd-pipeline": "ci-cd",
  k8s: "kubernetes",
  "docker-layers": "docker-image-layers",
  "image-layers": "docker-image-layers",
  "layers-in-docker": "docker-image-layers",
  star: "star-method",
  "star-technique": "star-method",
  "feature-based-folders": "feature-based-structure",
  "feature-folders": "feature-based-structure",
  "features-structure": "feature-based-structure",
  "dns-resolution": "dns",
  "domain-name-system": "dns",
  "super-user-do": "sudo",
};

/** Latin-ish slug; Hebrew letters are kept so a Hebrew-only name still gets a stable slug. */
export function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\+\+/g, "pp")
    .replace(/#/g, "sharp")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function conceptSlug(name: string): string {
  const s = slugifyName(name);
  return ALIASES[s] ?? s;
}

/** Company concepts are namespaced by the company slug: "amazon~star-method". */
export function companyConceptSlug(companySlug: string, name: string): string {
  let base = conceptSlug(name);
  // "Amazon leadership principles" under Amazon → "amazon~leadership-principles".
  if (base.startsWith(`${companySlug}-`) && base.length > companySlug.length + 1)
    base = base.slice(companySlug.length + 1);
  return `${companySlug}~${base}`;
}

export function splitConceptSlug(slug: string): { company: string | null; base: string } {
  const i = slug.indexOf("~");
  return i < 0 ? { company: null, base: slug } : { company: slug.slice(0, i), base: slug.slice(i + 1) };
}

export function cleanName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
}

export function cleanTags(raw: string[] | string): string[] {
  const arr = Array.isArray(raw) ? raw : raw.split(/[,\n]/);
  const out: string[] = [];
  for (const t of arr) {
    const v = t.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, TAG_MAX);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= TAGS_MAX) break;
  }
  return out;
}

export function clampConfidence(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 1;
}

export function isStatus(v: unknown): v is ConceptStatus {
  return typeof v === "string" && (CONCEPT_STATUSES as readonly string[]).includes(v);
}
export function isCategory(v: unknown): v is ConceptCategory {
  return typeof v === "string" && (CONCEPT_CATEGORIES as readonly string[]).includes(v);
}
export function isDrillAction(v: unknown): v is DrillAction {
  return typeof v === "string" && (DRILL_ACTIONS as readonly string[]).includes(v);
}

/* ---------- Overview (AI or curated) ---------- */

const str = (max: number) => z.string().trim().max(max);

export const conceptOverviewSchema = z.object({
  /** One or two sentences: what it is. */
  summary: str(600).min(3),
  /** Why it exists / the problem it solves. */
  why: str(700),
  /** How it is used day to day. */
  how: str(700),
  /** A short command / snippet / concrete example (may be empty). */
  example: z.object({ code: str(600), caption: str(200) }),
  keyPoints: z.array(str(240).min(2)).max(5),
  related: z.array(z.object({ name: str(NAME_MAX).min(1), why: str(160) })).max(6),
  category: z.enum(CONCEPT_CATEGORIES),
});
export type ConceptOverview = z.infer<typeof conceptOverviewSchema>;
export type OverviewSource = "curated" | "ai" | "fallback";

/** Lenient normalisation of LLM / stored JSON: trims, caps lengths, drops bad entries, returns null when unusable. */
export function normalizeOverview(raw: unknown): ConceptOverview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const ex = (r.example && typeof r.example === "object" ? r.example : {}) as Record<string, unknown>;
  const related = Array.isArray(r.related)
    ? r.related
        .map((x) =>
          typeof x === "string"
            ? { name: cleanName(x), why: "" }
            : x && typeof x === "object"
              ? {
                  name: cleanName(s((x as Record<string, unknown>).name, NAME_MAX)),
                  why: s((x as Record<string, unknown>).why, 160),
                }
              : null,
        )
        .filter((x): x is { name: string; why: string } => !!x && x.name.length > 0)
    : [];
  const seen = new Set<string>();
  const dedup = related.filter((x) => {
    const k = conceptSlug(x.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const out = {
    summary: s(r.summary, 600),
    why: s(r.why, 700),
    how: s(r.how, 700),
    example: { code: s(ex.code, 600), caption: s(ex.caption, 200) },
    keyPoints: (Array.isArray(r.keyPoints) ? r.keyPoints : [])
      .map((k) => s(k, 240))
      .filter((k) => k.length >= 2)
      .slice(0, 5),
    related: dedup.slice(0, 6),
    category: isCategory(r.category) ? r.category : "practices",
  };
  const p = conceptOverviewSchema.safeParse(out);
  return p.success ? p.data : null;
}

/* ---------- Client-side list filtering ---------- */

export interface ConceptListItem {
  id: string;
  name: string;
  slug: string;
  kind: ConceptKind;
  status: ConceptStatus;
  confidence: number;
  category: string | null;
  tags: string[];
  companyName: string | null;
  summary: string | null;
  messages: number;
  updatedAt: string;
}

export interface ConceptFilter {
  q?: string;
  status?: ConceptStatus | "";
  category?: string;
  kind?: ConceptKind | "";
  tag?: string;
}

export function filterConcepts<T extends ConceptListItem>(items: T[], f: ConceptFilter): T[] {
  const q = (f.q ?? "").trim().toLowerCase();
  return items.filter((c) => {
    if (f.status && c.status !== f.status) return false;
    if (f.kind && c.kind !== f.kind) return false;
    if (f.category && c.category !== f.category) return false;
    if (f.tag && !c.tags.includes(f.tag)) return false;
    if (!q) return true;
    return [c.name, c.slug, c.companyName ?? "", c.summary ?? "", ...c.tags].some((v) => v.toLowerCase().includes(q));
  });
}

export function allTags(items: { tags: string[] }[]): string[] {
  const counts = new Map<string, number>();
  for (const c of items) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
