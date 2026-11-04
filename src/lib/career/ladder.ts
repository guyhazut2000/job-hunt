/**
 * Step-up jobs (#85): a small, hand-curated career ladder and role graph, plus a deterministic gap
 * analysis. Everything here is a rule of thumb (labelled as such in the UI), not a prediction.
 * Pure: no DB access, so it is unit-tested directly.
 */
import type { Seniority } from "@prisma/client";
import { inferRoleCategory, inferSeniority } from "../taxonomy";
import { inferSeniorityFromYears } from "../profile/score";
import { requiredYears } from "../cv-tailor/match";

/** Rungs, low → high. MANAGER sits above LEAD (tech lead → engineering manager is a step, too). */
export const LADDER: Seniority[] = ["INTERN", "JUNIOR", "MID", "SENIOR", "LEAD", "MANAGER"];
export const rung = (s: Seniority) => LADDER.indexOf(s);

/** Roles you can usually grow into from a role (broader scope), curated — not mined from data. */
export const ROLE_UP: Record<string, string[]> = {
  frontend: ["fullstack"],
  backend: ["fullstack", "devops"],
  mobile: ["fullstack"],
  fullstack: [],
  devops: [],
  qa: ["devops", "backend"],
  data: ["ml"],
  ml: [],
  security: [],
  design: ["product"],
  product: [],
  hardware: [],
  management: [],
  other: [],
};

/** Roles that count as the "same track" for a pure level step (a fullstack dev stepping up to a senior backend role). */
const SAME_TRACK: Record<string, string[]> = {
  frontend: ["frontend"],
  backend: ["backend"],
  fullstack: ["fullstack", "backend", "frontend"],
  mobile: ["mobile"],
  devops: ["devops"],
  qa: ["qa"],
  data: ["data"],
  ml: ["ml"],
  security: ["security"],
  design: ["design"],
  product: ["product"],
  hardware: ["hardware"],
  management: ["management"],
  other: ["other"],
};

/** Staff / principal / architect / platform — the technical (IC) branch above senior. */
const IC_TOP = /\b(staff|principal|architect|distinguished)\b|ארכיטקט/i;
const PLATFORM = /\bplatform\b|פלטפורמ/i;

/**
 * Title words for a DB pre-filter on the technical track (case-insensitive `contains`). The main
 * scan is capped and newest-first, so without a dedicated query older Staff/Architect postings were
 * cut off by the cap and the technical tab came out (nearly) empty (#95).
 */
export const TECH_TITLE_TERMS = ["staff", "principal", "architect", "distinguished", "platform", "ארכיטקט", "פלטפורמ"];

/** Extra roles that only count on the technical track (a platform/infra role from fullstack is a technical step). */
const TECH_EXTRA: Record<string, string[]> = { fullstack: ["devops"], backend: ["devops"] };

/** The technical branch opens at Mid: Mid → Senior platform/architecture, Senior+ → Staff / principal / architect. */
export const TECH_MIN_LEVEL: Seniority = "MID";

export type MoveKind = "level" | "broaden" | "technical";

export const MOVE_KINDS: MoveKind[] = ["level", "broaden", "technical"];

/** Where the user stands now, and how we know it. */
export interface Position {
  role: string;
  level: Seniority;
  /** How the level was found: explicit override, years of experience, profile level, or a default. */
  source: "override" | "years" | "profile" | "default";
  roleSource: "override" | "targets" | "experience" | "default";
  years?: number;
}

export interface PositionInput {
  targetRoles: string[];
  /** Profile.seniority (the user's own "current level" field in v1 profiles). */
  seniority?: Seniority | null;
  totalYears?: number;
  /** Titles from the experience section, newest first. */
  experienceTitles: string[];
}

const ROLES = Object.keys(ROLE_UP);

/** The user's current role and level. Years of experience win over the stated level (targets are where you want to go). */
export function currentPosition(p: PositionInput, override: { role?: string; level?: Seniority } = {}): Position {
  let role = "fullstack";
  let roleSource: Position["roleSource"] = "default";
  if (override.role && ROLES.includes(override.role)) {
    role = override.role;
    roleSource = "override";
  } else if (p.targetRoles[0] && ROLES.includes(p.targetRoles[0])) {
    role = p.targetRoles[0];
    roleSource = "targets";
  } else if (p.experienceTitles[0]) {
    const r = inferRoleCategory(p.experienceTitles[0]);
    if (r !== "other") {
      role = r;
      roleSource = "experience";
    }
  }
  if (override.level && LADDER.includes(override.level) && override.level !== "INTERN")
    return { role, level: override.level, source: "override", roleSource, years: p.totalYears };
  if (p.totalYears != null) {
    // A senior/lead title in the newest role outranks a short tenure (titles are what recruiters read).
    const byYears = inferSeniorityFromYears(p.totalYears);
    const byTitle = p.experienceTitles[0] ? inferSeniority(p.experienceTitles[0]) : null;
    const level = byTitle && rung(byTitle) > rung(byYears) && byTitle !== "MANAGER" ? byTitle : byYears;
    return { role, level, source: "years", roleSource, years: p.totalYears };
  }
  if (p.seniority) return { role, level: p.seniority, source: "profile", roleSource };
  return { role, level: "MID", source: "default", roleSource };
}

/** Leadership asks in a posting (mentoring, leading people or projects). */
const LEADERSHIP =
  /\b(mentor\w*|lead(ing)? (a |the )?(team|group|squad|engineers|developers)|tech(nical)? lead(ership)?|people management|manage (a )?team)\b|הובלת צוות|הובלה טכנית|חניכה|ניהול צוות|ניהול עובדים/i;

export interface JobLevel {
  level: Seniority;
  /** "title" = from the job title; "requirements" = the title was neutral and the years asked moved it. */
  from: "title" | "requirements";
  years: number | null;
  leadership: boolean;
  icTop: boolean;
  platform: boolean;
}

/** Seniority of a posting: the title first, then the years asked when the title says nothing. */
export function detectJobLevel(job: { title: string; seniority: Seniority; description: string }): JobLevel {
  const years = requiredYears(job.description);
  const leadership = LEADERSHIP.test(job.description) || LEADERSHIP.test(job.title);
  const icTop = IC_TOP.test(job.title);
  const platform = PLATFORM.test(job.title);
  const titleLevel = job.seniority;
  const neutralTitle = titleLevel === "MID" && inferSeniority(job.title) === "MID";
  if (neutralTitle && years != null) {
    const level: Seniority = years >= 8 ? "LEAD" : years >= 5 ? "SENIOR" : years <= 1 ? "JUNIOR" : "MID";
    if (level !== "MID") return { level, from: "requirements", years, leadership, icTop, platform };
  }
  return { level: titleLevel, from: "title", years, leadership, icTop, platform };
}

export interface StepJob {
  title: string;
  roleCategory: string;
  seniority: Seniority;
  description: string;
}

export interface StepMove {
  kind: MoveKind;
  level: JobLevel;
}

/**
 * Is this job one step up from `pos`? One step = one rung up on the same track, a broader role
 * (frontend → fullstack) at the same rung or one up, or the technical branch above senior
 * (staff / principal / architect / platform). Two-rung jumps and step-downs are not step-ups.
 */
export function stepUpMove(pos: Position, job: StepJob): StepMove | null {
  const lv = detectJobLevel(job);
  const d = rung(lv.level) - rung(pos.level);
  const same = (SAME_TRACK[pos.role] ?? [pos.role]).includes(job.roleCategory);
  const broader = (ROLE_UP[pos.role] ?? []).includes(job.roleCategory);
  // People management is its own track: only a step for people already leading.
  if (lv.level === "MANAGER" && pos.level !== "LEAD") return null;
  const techTrack = same || broader || (TECH_EXTRA[pos.role] ?? []).includes(job.roleCategory);
  // Below Senior only a one-rung move counts (Mid → Senior platform); above, staying on the rung is fine too.
  const techD = rung(pos.level) >= rung("SENIOR") ? d >= 0 && d <= 1 : d === 1;
  if (rung(pos.level) >= rung(TECH_MIN_LEVEL) && techTrack && (lv.icTop || lv.platform) && techD)
    return { kind: "technical", level: lv };
  if (same && d === 1) return { kind: "level", level: lv };
  if (broader && (d === 0 || d === 1)) return { kind: "broaden", level: lv };
  return null;
}

export type Verdict = "apply" | "stretch" | "far";

export interface Gap {
  missingSkills: string[];
  yearsGap: number;
  leadershipGap: boolean;
  /** 0 = nothing missing that we can see. */
  points: number;
  verdict: Verdict;
}

/** Leadership seen in the user's own history (a lead/manager title, or mentoring in a description). */
export function hasLeadership(titles: string[], descriptions: string[]): boolean {
  return (
    titles.some((t) => ["LEAD", "MANAGER"].includes(inferSeniority(t))) || descriptions.some((d) => LEADERSHIP.test(d))
  );
}

/**
 * Gap analysis: tech the posting lists that the profile doesn't, years short of what it asks, and
 * leadership it asks for that the profile doesn't show. Rule of thumb for the verdict: postings are
 * wish lists, so 0–2 small gaps on a one-step move is worth applying.
 */
export function gapFor(move: StepMove, ctx: { missingSkills: string[]; years?: number; leadership: boolean }): Gap {
  const yearsGap =
    move.level.years != null && ctx.years != null ? Math.max(0, Math.ceil(move.level.years - ctx.years)) : 0;
  const leadershipGap = move.level.leadership && !ctx.leadership;
  const skillPts = Math.min(ctx.missingSkills.length, 4);
  const points = skillPts + (yearsGap >= 2 ? 2 : yearsGap) + (leadershipGap ? 1 : 0);
  const verdict: Verdict = points <= 2 ? "apply" : points <= 4 ? "stretch" : "far";
  return { missingSkills: ctx.missingSkills, yearsGap, leadershipGap, points, verdict };
}

const VERDICT_ORDER: Record<Verdict, number> = { apply: 0, stretch: 1, far: 2 };

/** Smallest gap first, then the better profile match, then the newest. */
export function compareStepUps(
  a: { gap: Gap; score: number; postedAt: Date; id: string },
  b: { gap: Gap; score: number; postedAt: Date; id: string },
): number {
  return (
    VERDICT_ORDER[a.gap.verdict] - VERDICT_ORDER[b.gap.verdict] ||
    b.score - a.score ||
    a.gap.points - b.gap.points ||
    b.postedAt.getTime() - a.postedAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}

/** Which (role, level) pairs to fetch from the DB for a position — a superset; `stepUpMove` decides. */
export function stepTargets(pos: Position): { roles: string[]; levels: Seniority[]; techRoles: string[] } {
  const roles = [...new Set([...(SAME_TRACK[pos.role] ?? [pos.role]), ...(ROLE_UP[pos.role] ?? [])])];
  const r = rung(pos.level);
  // MID is always included: a neutral title can still be senior by the years it asks.
  const levels = [...new Set<Seniority>(["MID", LADDER[r], LADDER[Math.min(r + 1, LADDER.length - 1)]])];
  const techRoles = [...new Set([...roles, ...(TECH_EXTRA[pos.role] ?? [])])];
  return { roles, levels, techRoles };
}

/** Is the technical track open at this level at all? (Used for an honest empty state instead of a bare 0.) */
export const technicalTrackOpen = (level: Seniority) => rung(level) >= rung(TECH_MIN_LEVEL) && level !== "MANAGER";

/** The next rung, for the header ("Mid → Senior"). */
export const nextRung = (s: Seniority): Seniority => LADDER[Math.min(rung(s) + 1, LADDER.length - 1)];
