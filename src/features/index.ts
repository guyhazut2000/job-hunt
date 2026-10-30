import { FEATURES } from "./registry";
import { CATEGORY_LABELS, FEATURE_CATEGORIES, type Feature, type FeatureCategory } from "./types";

export { FEATURES, CATEGORY_LABELS, FEATURE_CATEGORIES };
export type { Feature, FeatureCategory };

/** A feature counts as "new" for this many days after it was added. */
export const NEW_WINDOW_DAYS = 14;

/**
 * Page routes deliberately NOT listed on /features (not a capability of their own).
 * Adding a route here needs a reason; everything else must be covered by a registry entry.
 */
export const ROUTE_ALLOWLIST: Record<string, string> = {
  "/privacy": "legal page",
  "/terms": "legal page",
};

/** "src/app/(group)/jobs/[id]/page.tsx" → "/jobs/[id]". Route groups "(x)" are dropped; "@slot" segments too. */
export function routeFromPageFile(file: string): string {
  const rel = file
    .replace(/\\/g, "/")
    .replace(/^.*?src\/app\//, "")
    .replace(/(^|\/)page\.(tsx|ts|jsx|js|mdx)$/, "");
  const segs = rel.split("/").filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith("@"));
  return "/" + segs.join("/");
}

/** Path part of an href ("/jobs?view=map#x" → "/jobs"). */
export function hrefPath(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/** Does a concrete path ("/jobs/abc") match a route pattern ("/jobs/[id]")? */
export function matchesRoute(path: string, pattern: string): boolean {
  const a = path.split("/").filter(Boolean);
  const b = pattern.split("/").filter(Boolean);
  if (b.some((s) => s.startsWith("[..."))) {
    const i = b.findIndex((s) => s.startsWith("[..."));
    return a.length >= i + (b[i].startsWith("[[...") ? 0 : 1) && b.slice(0, i).every((s, k) => matchSeg(a[k], s));
  }
  return a.length === b.length && b.every((s, k) => matchSeg(a[k], s));
}
const matchSeg = (actual: string | undefined, pat: string) =>
  actual !== undefined && (pat.startsWith("[") || actual === pat);

/** Route patterns with no registry entry and not allowlisted. */
export function uncoveredRoutes(pageRoutes: string[], features: Feature[] = FEATURES): string[] {
  const covered = new Set(features.flatMap((f) => f.routes));
  return pageRoutes.filter((r) => !covered.has(r) && !(r in ROUTE_ALLOWLIST)).sort();
}

export function featureHref(f: Feature): string | null {
  if (f.status === "planned") return null;
  return f.href ?? f.routes[0] ?? null;
}

const DAY = 24 * 60 * 60 * 1000;
/** Days since a YYYY-MM-DD date (Israel calendar day vs `now`). */
export function daysSince(date: string, now: Date = new Date()): number {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return Math.round((Date.parse(today) - Date.parse(date)) / DAY);
}
export function isNew(f: Feature, now: Date = new Date()): boolean {
  if (f.status === "planned") return false;
  const d = daysSince(f.added, now);
  return d >= 0 && d <= NEW_WINDOW_DAYS;
}

export interface ChangelogEntry {
  date: string;
  featureId: string;
  featureName: string;
  text: string;
  kind: "added" | "updated" | "planned";
  pr?: number;
  issue?: number;
}

/** "מה חדש": every launch and every recorded update, newest first. */
export function changelog(features: Feature[] = FEATURES): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  for (const f of features) {
    out.push({
      date: f.added,
      featureId: f.id,
      featureName: f.name,
      text: f.status === "planned" ? "נוסף לתוכנית העבודה" : "עלה לאוויר",
      kind: f.status === "planned" ? "planned" : "added",
      pr: f.status === "planned" ? undefined : f.prs?.[0],
      issue: f.issue,
    });
    for (const u of f.updates ?? []) {
      out.push({ date: u.date, featureId: f.id, featureName: f.name, text: u.text, kind: "updated", pr: u.pr });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.featureName.localeCompare(b.featureName, "he"));
}

/** Normalised search text for one feature (client-side filter). */
export function searchText(f: Feature): string {
  return [f.name, f.description, f.howTo, CATEGORY_LABELS[f.category], ...(f.keywords ?? []), ...f.routes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function countsByCategory(features: Feature[] = FEATURES) {
  return FEATURE_CATEGORIES.map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c],
    live: features.filter((f) => f.category === c && f.status !== "planned").length,
    planned: features.filter((f) => f.category === c && f.status === "planned").length,
  }));
}
