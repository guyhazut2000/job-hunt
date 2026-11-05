/**
 * Information architecture for the signed-in product.
 *
 * Five hubs own the primary bar. Sibling pages live in a secondary strip
 * (`hubStrip`). Everything else is a labeled section in More — never a flat
 * dump of the same links. Header, mobile bar and HubNav all read this module.
 *
 * Profile (`/profile`) already has its own profile/documents tabs, so the
 * documents strip is omitted there and shown on CV routes (and deeper profile
 * routes such as review) instead of stacking two tab rows.
 */

export type NavRole = "guest" | "user" | "admin";

/** `guest` is the opposite of signed-in: used for links that move into a hub once you have an account. */
export type Audience = "public" | "user" | "admin" | "guest";

export type MoreSurface = "desktop" | "mobile";

export type HubId = "jobs" | "companies" | "tracker" | "documents" | "prep";

export type MoreSectionId = "prep" | "progress" | "tools" | "admin";

export interface MatchRule {
  /** Path that matches exactly, or as a prefix when `exact` is not set. */
  path: string;
  exact?: boolean;
  /** Constrain a query param. `isNot` also matches when the param is absent. */
  query?: { key: string; value: string; mode: "is" | "isNot" };
}

export interface NavTarget {
  id: string;
  href: string;
  audience: Audience;
  rules: MatchRule[];
}

export interface PrimaryLink {
  id: string;
  href: string;
  audience: Audience;
  /** When set, the link is current for every path in that hub, not only its own href. */
  hub?: HubId;
  rules?: MatchRule[];
}

export interface HubDef {
  id: HubId;
  /** Primary destination. Also the i18n key for the hub name. */
  labelId: string;
  href: string;
  /** Primary link is current when the path equals one of these or sits under it. */
  activePrefixes: string[];
  /** Secondary strip. Narrower than `activePrefixes` (job detail stays out, for example). */
  show: (pathname: string) => boolean;
  tabs: NavTarget[];
}

export interface MoreSection {
  id: MoreSectionId;
  items: NavTarget[];
}

export function navRole(user: { role?: string | null } | null | undefined): NavRole {
  if (!user) return "guest";
  return user.role === "ADMIN" ? "admin" : "user";
}

export function canSee(audience: Audience, role: NavRole): boolean {
  switch (audience) {
    case "public":
      return true;
    case "guest":
      return role === "guest";
    case "user":
      return role !== "guest";
    case "admin":
      return role === "admin";
  }
}

export function toSearchParams(search: URLSearchParams | string): URLSearchParams {
  if (typeof search !== "string") return search;
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q);
}

export function ruleMatches(pathname: string, search: URLSearchParams | string, rule: MatchRule): boolean {
  const params = toSearchParams(search);
  const pathOk = rule.exact
    ? pathname === rule.path
    : pathname === rule.path || pathname.startsWith(rule.path.endsWith("/") ? rule.path : `${rule.path}/`);
  if (!pathOk) return false;
  if (!rule.query) return true;
  const actual = params.get(rule.query.key);
  return rule.query.mode === "is" ? actual === rule.query.value : actual !== rule.query.value;
}

/** Longest matching path wins, so a sibling (`/jobs/ranking`) does not light its parent (`/jobs`). */
export function activeTargetId(
  items: readonly NavTarget[],
  pathname: string,
  search: URLSearchParams | string = "",
): string | null {
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    let score = -1;
    for (const rule of item.rules) {
      if (!ruleMatches(pathname, search, rule)) continue;
      score = Math.max(score, rule.path.length);
    }
    if (score < 0) continue;
    if (!best || score >= best.score) best = { id: item.id, score };
  }
  return best?.id ?? null;
}

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const prefix = (path: string): MatchRule => ({ path });
const exact = (path: string, query?: MatchRule["query"]): MatchRule => ({ path, exact: true, query });

export const HUBS: readonly HubDef[] = [
  {
    id: "jobs",
    labelId: "jobs",
    href: "/jobs",
    activePrefixes: ["/jobs"],
    show: (pathname) => pathname === "/jobs" || under(pathname, "/jobs/ranking") || under(pathname, "/jobs/step-up"),
    tabs: [
      {
        id: "jobs-search",
        href: "/jobs",
        audience: "public",
        rules: [exact("/jobs", { key: "view", value: "map", mode: "isNot" })],
      },
      {
        id: "jobs-map",
        href: "/jobs?view=map",
        audience: "public",
        rules: [exact("/jobs", { key: "view", value: "map", mode: "is" })],
      },
      { id: "jobs-ranking", href: "/jobs/ranking", audience: "user", rules: [prefix("/jobs/ranking")] },
      { id: "jobs-step-up", href: "/jobs/step-up", audience: "user", rules: [prefix("/jobs/step-up")] },
    ],
  },
  {
    id: "companies",
    labelId: "companies",
    href: "/companies",
    activePrefixes: ["/companies", "/outreach", "/referrals"],
    show: (pathname) => under(pathname, "/companies") || under(pathname, "/outreach") || under(pathname, "/referrals"),
    tabs: [
      { id: "companies-list", href: "/companies", audience: "public", rules: [prefix("/companies")] },
      { id: "companies-outreach", href: "/outreach", audience: "user", rules: [prefix("/outreach")] },
      { id: "companies-referrals", href: "/referrals", audience: "user", rules: [prefix("/referrals")] },
    ],
  },
  {
    id: "tracker",
    labelId: "tracker",
    href: "/dashboard",
    activePrefixes: ["/dashboard", "/closing", "/salary", "/apply"],
    show: (pathname) =>
      under(pathname, "/dashboard") ||
      under(pathname, "/closing") ||
      under(pathname, "/salary") ||
      under(pathname, "/apply"),
    tabs: [
      { id: "tracker-board", href: "/dashboard", audience: "user", rules: [prefix("/dashboard")] },
      { id: "tracker-apply", href: "/apply", audience: "user", rules: [prefix("/apply")] },
      { id: "tracker-closing", href: "/closing", audience: "user", rules: [prefix("/closing")] },
      { id: "tracker-salary", href: "/salary", audience: "public", rules: [prefix("/salary")] },
    ],
  },
  {
    id: "documents",
    labelId: "documents",
    href: "/profile",
    activePrefixes: ["/profile", "/cv", "/documents"],
    show: (pathname) => {
      if (pathname.endsWith("/print")) return false;
      // `/profile` keeps its own profile/documents tabs. CV tools and deeper profile routes get this strip.
      if (pathname === "/cv" || pathname.startsWith("/cv/")) return true;
      if (pathname.startsWith("/profile/")) return true;
      return false;
    },
    tabs: [
      { id: "documents-profile", href: "/profile", audience: "user", rules: [prefix("/profile")] },
      { id: "documents-standard", href: "/cv/standard", audience: "user", rules: [prefix("/cv/standard")] },
      {
        id: "documents-templates",
        href: "/cv",
        audience: "user",
        rules: [exact("/cv"), prefix("/cv/templates")],
      },
      { id: "documents-tailor", href: "/cv/tailor", audience: "user", rules: [prefix("/cv/tailor")] },
      { id: "documents-ats", href: "/cv/ats", audience: "user", rules: [prefix("/cv/ats")] },
      { id: "documents-linkedin", href: "/cv/linkedin", audience: "user", rules: [prefix("/cv/linkedin")] },
    ],
  },
  {
    id: "prep",
    labelId: "prep",
    href: "/learn",
    activePrefixes: ["/learn", "/prep", "/interview"],
    show: (pathname) => under(pathname, "/learn") || under(pathname, "/prep") || under(pathname, "/interview"),
    tabs: [
      { id: "prep-learn", href: "/learn", audience: "public", rules: [prefix("/learn")] },
      { id: "prep-me", href: "/learn/me", audience: "user", rules: [prefix("/learn/me")] },
      { id: "prep-gaps", href: "/learn/gaps", audience: "user", rules: [prefix("/learn/gaps")] },
      {
        id: "prep-system-design",
        href: "/learn/system-design",
        audience: "public",
        rules: [prefix("/learn/system-design")],
      },
      {
        id: "prep-problem-solving",
        href: "/learn/problem-solving",
        audience: "public",
        rules: [prefix("/learn/problem-solving")],
      },
      { id: "prep-concepts", href: "/learn/concepts", audience: "user", rules: [prefix("/learn/concepts")] },
      { id: "prep-manager", href: "/prep/manager", audience: "user", rules: [prefix("/prep/manager")] },
      { id: "prep-interview", href: "/interview", audience: "user", rules: [prefix("/interview")] },
    ],
  },
];

const HUB_BY_ID: Record<HubId, HubDef> = Object.fromEntries(HUBS.map((h) => [h.id, h])) as Record<HubId, HubDef>;

export function hubById(id: HubId): HubDef {
  return HUB_BY_ID[id];
}

/**
 * Desktop primary bar, in order. Guests see Jobs, Companies, Prep and Features.
 * Signed-in users see the five hubs. Five destinations; More is separate.
 */
export const PRIMARY: readonly PrimaryLink[] = [
  { id: "jobs", href: "/jobs", audience: "public", hub: "jobs" },
  { id: "companies", href: "/companies", audience: "public", hub: "companies" },
  { id: "tracker", href: "/dashboard", audience: "user", hub: "tracker" },
  { id: "documents", href: "/profile", audience: "user", hub: "documents" },
  { id: "prep", href: "/learn", audience: "public", hub: "prep" },
  { id: "features", href: "/features", audience: "guest", rules: [exact("/features")] },
];

/**
 * Mobile bottom bar, before the More button (and Login for guests).
 * Prep is on the bar for guests. Signed-in users get Tracker + Documents;
 * Prep moves into the More sheet so the bar stays at five slots including More.
 */
export const MOBILE_BAR: readonly PrimaryLink[] = [
  { id: "jobs", href: "/jobs", audience: "public", hub: "jobs" },
  { id: "companies", href: "/companies", audience: "public", hub: "companies" },
  { id: "prep", href: "/learn", audience: "guest", hub: "prep" },
  { id: "tracker", href: "/dashboard", audience: "user", hub: "tracker" },
  { id: "documents", href: "/profile", audience: "user", hub: "documents" },
];

const PROGRESS: readonly NavTarget[] = [
  { id: "stats", href: "/stats", audience: "user", rules: [prefix("/stats")] },
  { id: "coach", href: "/coach", audience: "user", rules: [prefix("/coach")] },
  { id: "digest", href: "/digest", audience: "user", rules: [prefix("/digest")] },
];

const TOOLS: readonly NavTarget[] = [
  { id: "chat", href: "/chat", audience: "user", rules: [prefix("/chat")] },
  { id: "features", href: "/features", audience: "public", rules: [prefix("/features")] },
  // Salary lives in the tracker hub once you are signed in. Guests have no tracker tab, so it stays here.
  { id: "salary", href: "/salary", audience: "guest", rules: [prefix("/salary")] },
];

const ADMIN_ITEMS: readonly NavTarget[] = [
  { id: "admin", href: "/admin", audience: "admin", rules: [prefix("/admin")] },
];

export function primaryLinks(role: NavRole): PrimaryLink[] {
  return PRIMARY.filter((link) => canSee(link.audience, role));
}

export function mobileBarLinks(role: NavRole): PrimaryLink[] {
  return MOBILE_BAR.filter((link) => canSee(link.audience, role));
}

export function isPrimaryActive(link: PrimaryLink, pathname: string, search: URLSearchParams | string = ""): boolean {
  if (link.hub) {
    return hubById(link.hub).activePrefixes.some((prefixPath) => under(pathname, prefixPath));
  }
  return (link.rules ?? []).some((rule) => ruleMatches(pathname, search, rule));
}

export function activePrimaryId(role: NavRole, pathname: string, search: URLSearchParams | string = ""): string | null {
  return primaryLinks(role).find((link) => isPrimaryActive(link, pathname, search))?.id ?? null;
}

export interface HubStrip {
  hubId: HubId;
  labelId: string;
  tabs: NavTarget[];
  activeId: string | null;
}

export function hubStrip(pathname: string, search: URLSearchParams | string, role: NavRole): HubStrip | null {
  const hub = HUBS.find((candidate) => candidate.show(pathname));
  if (!hub) return null;
  const tabs = hub.tabs.filter((tab) => canSee(tab.audience, role));
  if (tabs.length < 2) return null;
  return { hubId: hub.id, labelId: hub.labelId, tabs, activeId: activeTargetId(tabs, pathname, search) };
}

export function moreSections(role: NavRole, surface: MoreSurface): MoreSection[] {
  const sections: MoreSection[] = [];
  const prepOnBar = mobileBarLinks(role).some((link) => link.id === "prep");
  if (surface === "mobile" && !prepOnBar) {
    const tabs = hubById("prep").tabs.filter((tab) => canSee(tab.audience, role));
    if (tabs.length) sections.push({ id: "prep", items: tabs });
  }
  const progress = PROGRESS.filter((item) => canSee(item.audience, role));
  if (progress.length) sections.push({ id: "progress", items: [...progress] });
  const featuresOnPrimary = primaryLinks(role).some((link) => link.id === "features");
  const tools = TOOLS.filter((item) => {
    if (!canSee(item.audience, role)) return false;
    if (item.id === "features" && surface === "desktop" && featuresOnPrimary) return false;
    return true;
  });
  if (tools.length) sections.push({ id: "tools", items: [...tools] });
  const admin = ADMIN_ITEMS.filter((item) => canSee(item.audience, role));
  if (admin.length) sections.push({ id: "admin", items: [...admin] });
  return sections;
}

/** Bottom-bar id, or `"more"` when the current page lives in the sheet. */
export function activeMobileId(role: NavRole, pathname: string, search: URLSearchParams | string = ""): string | null {
  const onBar = mobileBarLinks(role).find((link) => isPrimaryActive(link, pathname, search));
  if (onBar) return onBar.id;
  const inMore = moreSections(role, "mobile").some((section) => activeTargetId(section.items, pathname, search));
  return inMore ? "more" : null;
}

/** Every destination id that needs a translated label. */
export function navItemIds(): string[] {
  const ids = new Set<string>();
  for (const link of PRIMARY) ids.add(link.id);
  for (const link of MOBILE_BAR) ids.add(link.id);
  for (const hub of HUBS) for (const tab of hub.tabs) ids.add(tab.id);
  for (const item of [...PROGRESS, ...TOOLS, ...ADMIN_ITEMS]) ids.add(item.id);
  return [...ids];
}

export const MORE_SECTION_IDS = ["prep", "progress", "tools", "admin"] as const satisfies readonly MoreSectionId[];
