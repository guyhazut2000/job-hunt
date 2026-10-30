/**
 * Types for the feature registry (`registry.ts`) that powers `/features` ("מה המערכת יודעת לעשות").
 * See docs/features.md for how to add or update an entry.
 */

export const FEATURE_CATEGORIES = [
  "jobs",
  "companies",
  "applications",
  "profile",
  "email",
  "ai",
  "learning",
  "notifications",
  "settings",
  "ui",
  "admin",
] as const;
export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  jobs: "חיפוש משרות",
  companies: "חברות",
  applications: "מועמדויות",
  profile: "מסמכים ופרופיל",
  email: "מייל",
  ai: "AI",
  learning: "למידה",
  notifications: "התראות",
  settings: "הגדרות וחשבון",
  ui: "ממשק ונגישות",
  admin: "ניהול",
};

/** live = in production; beta = in production but still being tuned; planned = not built yet (needs an issue or a note). */
export type FeatureStatus = "live" | "beta" | "planned";

/** Who can use it: everyone, signed-in users, or admins only. */
export type FeatureAudience = "public" | "user" | "admin";

export interface FeatureUpdate {
  /** YYYY-MM-DD (Israel time). */
  date: string;
  /** One line in Hebrew: what changed. */
  text: string;
  pr?: number;
}

export interface Feature {
  /** Stable kebab-case id (also the anchor on /features). */
  id: string;
  /** Hebrew name. */
  name: string;
  /** What it does — one or two Hebrew sentences. */
  description: string;
  /** How to use it — one Hebrew sentence (optional for planned items). */
  howTo?: string;
  category: FeatureCategory;
  status: FeatureStatus;
  audience: FeatureAudience;
  /**
   * App route patterns (as folders under src/app, e.g. "/jobs/[id]") this feature lives on.
   * Every page route must be covered by at least one entry — enforced by tests/features-registry.test.ts.
   */
  routes: string[];
  /** Where the "open" link goes (a path, may include ?query or #hash). Defaults to routes[0]. */
  href?: string;
  /** YYYY-MM-DD the feature first went live (or was planned). */
  added: string;
  prs?: number[];
  issue?: number;
  /** Later notable changes — shown in the "מה חדש" changelog. */
  updates?: FeatureUpdate[];
  /** Extra search words (English names, synonyms). */
  keywords?: string[];
}
