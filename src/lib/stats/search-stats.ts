/**
 * Job-search statistics (/stats): pure aggregation over a user's applications and their status
 * history (ApplicationStatusChange, including changes the email scan made automatically).
 * No I/O here; the page loads the rows and renders the result. See docs/stats.md.
 */

export type AppStatus = "SAVED" | "APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER" | "REJECTED";
export type ChangeSource = "EMAIL_AUTO" | "EMAIL_REVIEW" | "MANUAL";
export type ActiveStage = "APPLIED" | "SCREENING" | "INTERVIEW";

export interface StatsChange {
  fromStatus: AppStatus | null;
  toStatus: AppStatus;
  source: ChangeSource;
  /** When it happened: the email date for email-driven changes, else when it was logged. */
  at: Date;
  undone: boolean;
}

export interface StatsApp {
  id: string;
  title: string;
  company: string;
  status: AppStatus;
  createdAt: Date;
  appliedAt: Date | null;
  statusChangedAt: Date | null;
  /** How it got onto the board. */
  source: "APP" | "EMAIL";
  jobId: string | null;
  /** Job domain (תחום) when linked to a job. */
  domain: string | null;
  /** ATS the job came from when linked to a job. */
  provider: string | null;
  changes: StatsChange[];
}

/** Below this many applications, percentages are hidden (one reply out of two isn't "50%"). */
export const MIN_FOR_RATES = 5;
/** A breakdown row needs this many applications to show a rate. */
export const MIN_ROW_FOR_RATE = 3;
/** Days without movement after which an active application counts as stuck, per stage. */
export const STUCK_DAYS: Record<ActiveStage, number> = { APPLIED: 14, SCREENING: 10, INTERVIEW: 10 };
export const TREND_WEEKS = 12;

const DAY = 86_400_000;
const RANK: Record<AppStatus, number> = { SAVED: 0, APPLIED: 1, SCREENING: 2, INTERVIEW: 3, OFFER: 4, REJECTED: -1 };
const RESPONSE: AppStatus[] = ["SCREENING", "INTERVIEW", "OFFER", "REJECTED"];

export interface AppFacts {
  id: string;
  applied: boolean;
  responded: boolean;
  interviewed: boolean;
  offered: boolean;
  rejected: boolean;
  /** Furthest positive stage reached (APPLIED…OFFER), or SAVED. */
  reached: AppStatus;
  /** Stage the application was at when it was rejected. */
  rejectedAt: AppStatus | null;
  appliedDate: Date | null;
  responseDate: Date | null;
  interviewDate: Date | null;
  rejectedDate: Date | null;
  daysToResponse: number | null;
  /** The first response was detected from email (automatically or via review). */
  responseByEmail: boolean;
  lastMove: Date;
}

const byRank = (r: number): AppStatus => (["SAVED", "APPLIED", "SCREENING", "INTERVIEW", "OFFER"] as const)[r];
const maxDate = (ds: (Date | null | undefined)[]) =>
  ds.reduce<Date | null>((m, d) => (d && (!m || d > m) ? d : m), null);

export function appFacts(a: StatsApp): AppFacts {
  const live = a.changes.filter((c) => !c.undone).sort((x, y) => x.at.getTime() - y.at.getTime());
  let rank = Math.max(0, RANK[a.status]);
  for (const c of live) {
    rank = Math.max(rank, RANK[c.toStatus], c.fromStatus ? RANK[c.fromStatus] : 0);
  }
  const rejected = a.status === "REJECTED";
  if (a.appliedAt || rejected) rank = Math.max(rank, 1);
  // Status-change time stands in when there is no history row (rows from before history existed).
  const fallback = a.statusChangedAt ?? null;
  const firstTo = (statuses: AppStatus[]) => live.find((c) => statuses.includes(c.toStatus)) ?? null;

  const applied = rank >= 1;
  const appliedDate = applied
    ? (a.appliedAt ?? firstTo(["APPLIED"])?.at ?? (a.status === "APPLIED" ? fallback : null) ?? a.createdAt)
    : null;
  const respChange = firstTo(RESPONSE);
  const responded = rank >= 2 || rejected;
  const responseDate = responded ? (respChange?.at ?? (a.status !== "APPLIED" ? fallback : null)) : null;
  const interviewed = rank >= 3;
  const interviewDate = interviewed
    ? (firstTo(["INTERVIEW", "OFFER"])?.at ?? (["INTERVIEW", "OFFER"].includes(a.status) ? fallback : null))
    : null;
  const rejChange = rejected ? [...live].reverse().find((c) => c.toStatus === "REJECTED") : undefined;
  const rejectedAt: AppStatus | null = rejected
    ? rejChange?.fromStatus && rejChange.fromStatus !== "REJECTED" && rejChange.fromStatus !== "SAVED"
      ? rejChange.fromStatus
      : byRank(Math.max(1, rank))
    : null;
  const daysToResponse =
    appliedDate && responseDate && responseDate >= appliedDate
      ? (responseDate.getTime() - appliedDate.getTime()) / DAY
      : null;
  return {
    id: a.id,
    applied,
    responded,
    interviewed,
    offered: rank >= 4,
    rejected,
    reached: byRank(rank),
    rejectedAt,
    appliedDate,
    responseDate,
    interviewDate,
    rejectedDate: rejected ? (rejChange?.at ?? fallback) : null,
    daysToResponse,
    responseByEmail: !!respChange && respChange.source !== "MANUAL",
    lastMove: maxDate([a.createdAt, a.appliedAt, a.statusChangedAt, ...live.map((c) => c.at)]) ?? a.createdAt,
  };
}

export interface Counts {
  applied: number;
  responded: number;
  interviewed: number;
  offered: number;
  rejected: number;
}
export interface Rates {
  response: number | null;
  interview: number | null;
  offer: number | null;
  rejection: number | null;
}
export interface BreakdownRow extends Counts {
  key: string;
  /** Response rate, null when the row is too small. */
  responseRate: number | null;
}
export interface StuckItem {
  id: string;
  title: string;
  company: string;
  status: ActiveStage;
  jobId: string | null;
  days: number;
}
export interface StageWait {
  stage: ActiveStage;
  count: number;
  stuck: number;
  medianDays: number | null;
}
export interface FunnelStep {
  from: "applied" | "responded" | "interviewed";
  to: "responded" | "interviewed" | "offered";
  rate: number | null;
}
export interface TrendWeek extends Omit<Counts, "offered"> {
  /** Sunday, YYYY-MM-DD (Israel). */
  week: string;
}
export interface SearchStats {
  total: number;
  saved: number;
  active: number;
  counts: Counts;
  rates: Rates;
  smallData: boolean;
  timeToResponse: { medianDays: number | null; n: number; fastestDays: number | null; slowestDays: number | null };
  steps: FunnelStep[];
  /** The funnel step that loses the most (lowest conversion with enough data), if any. */
  bottleneck: FunnelStep | null;
  waits: StageWait[];
  stuck: StuckItem[];
  rejectedAt: Record<"APPLIED" | "SCREENING" | "INTERVIEW" | "OFFER", number>;
  byCompany: BreakdownRow[];
  byDomain: BreakdownRow[];
  bySource: BreakdownRow[];
  trend: TrendWeek[];
  email: { autoChanges: number; reviewChanges: number; undone: number; responsesFromEmail: number };
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const rate = (n: number, d: number, min: number) => (d >= min && d > 0 ? n / d : null);

/** Israel calendar day of a date, as YYYY-MM-DD. */
export function israelDay(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}
/** The Sunday (Israel week start) on or before `d`, as YYYY-MM-DD. */
export function weekStart(d: Date): string {
  const day = Date.parse(israelDay(d));
  const dow = new Date(day).getUTCDay();
  return new Date(day - dow * DAY).toISOString().slice(0, 10);
}

/** Where the application came from: the job's ATS, "EMAIL" (found in mail, no job), or "EXTERNAL". */
export function sourceKey(a: StatsApp): string {
  if (a.provider && a.provider !== "MANUAL") return a.provider;
  if (!a.jobId && a.source === "EMAIL") return "EMAIL";
  return a.jobId ? "MANUAL" : "EXTERNAL";
}

function breakdown(apps: StatsApp[], facts: Map<string, AppFacts>, keyOf: (a: StatsApp) => string, limit: number) {
  const rows = new Map<string, BreakdownRow>();
  for (const a of apps) {
    const f = facts.get(a.id)!;
    if (!f.applied) continue;
    const k = keyOf(a);
    const r = rows.get(k) ?? {
      key: k,
      applied: 0,
      responded: 0,
      interviewed: 0,
      offered: 0,
      rejected: 0,
      responseRate: null,
    };
    r.applied++;
    if (f.responded) r.responded++;
    if (f.interviewed) r.interviewed++;
    if (f.offered) r.offered++;
    if (f.rejected) r.rejected++;
    rows.set(k, r);
  }
  return [...rows.values()]
    .map((r) => ({ ...r, responseRate: rate(r.responded, r.applied, MIN_ROW_FOR_RATE) }))
    .sort((x, y) => y.applied - x.applied || y.responded - x.responded || x.key.localeCompare(y.key))
    .slice(0, limit);
}

export function computeStats(apps: StatsApp[], now: Date = new Date()): SearchStats {
  const facts = new Map(apps.map((a) => [a.id, appFacts(a)]));
  const fs = [...facts.values()];
  const counts: Counts = {
    applied: fs.filter((f) => f.applied).length,
    responded: fs.filter((f) => f.responded).length,
    interviewed: fs.filter((f) => f.interviewed).length,
    offered: fs.filter((f) => f.offered).length,
    rejected: fs.filter((f) => f.rejected).length,
  };
  const ratesOk = counts.applied >= MIN_FOR_RATES;
  const rates: Rates = {
    response: ratesOk ? counts.responded / counts.applied : null,
    interview: ratesOk ? counts.interviewed / counts.applied : null,
    offer: ratesOk ? counts.offered / counts.applied : null,
    rejection: ratesOk ? counts.rejected / counts.applied : null,
  };
  const ttr = fs.map((f) => f.daysToResponse).filter((d): d is number => d !== null);
  const steps: FunnelStep[] = [
    { from: "applied", to: "responded", rate: rate(counts.responded, counts.applied, MIN_ROW_FOR_RATE) },
    { from: "responded", to: "interviewed", rate: rate(counts.interviewed, counts.responded, MIN_ROW_FOR_RATE) },
    { from: "interviewed", to: "offered", rate: rate(counts.offered, counts.interviewed, MIN_ROW_FOR_RATE) },
  ];
  const scored = steps.filter((s) => s.rate !== null);
  const bottleneck = ratesOk && scored.length ? scored.reduce((m, s) => (s.rate! < m.rate! ? s : m)) : null;

  const activeApps = apps.filter((a): a is StatsApp & { status: ActiveStage } =>
    ["APPLIED", "SCREENING", "INTERVIEW"].includes(a.status),
  );
  const daysIdle = (a: StatsApp) =>
    Math.max(0, Math.floor((now.getTime() - facts.get(a.id)!.lastMove.getTime()) / DAY));
  const waits: StageWait[] = (["APPLIED", "SCREENING", "INTERVIEW"] as const).map((stage) => {
    const here = activeApps.filter((a) => a.status === stage);
    const days = here.map(daysIdle);
    return {
      stage,
      count: here.length,
      stuck: days.filter((d) => d >= STUCK_DAYS[stage]).length,
      medianDays: median(days),
    };
  });
  const stuck: StuckItem[] = activeApps
    .map((a) => ({ id: a.id, title: a.title, company: a.company, status: a.status, jobId: a.jobId, days: daysIdle(a) }))
    .filter((s) => s.days >= STUCK_DAYS[s.status])
    .sort((x, y) => y.days - x.days)
    .slice(0, 8);
  const rejectedAt = { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0 };
  for (const f of fs)
    if (f.rejectedAt && f.rejectedAt in rejectedAt) rejectedAt[f.rejectedAt as keyof typeof rejectedAt]++;

  // Weekly trend, oldest first, for the last TREND_WEEKS Israel weeks (Sunday start).
  const thisWeek = Date.parse(weekStart(now));
  const weeks = Array.from({ length: TREND_WEEKS }, (_, i) =>
    new Date(thisWeek - (TREND_WEEKS - 1 - i) * 7 * DAY).toISOString().slice(0, 10),
  );
  const trendMap = new Map<string, TrendWeek>(
    weeks.map((w) => [w, { week: w, applied: 0, responded: 0, interviewed: 0, rejected: 0 }]),
  );
  const bump = (d: Date | null, k: keyof Omit<TrendWeek, "week">) => {
    if (!d) return;
    const row = trendMap.get(weekStart(d));
    if (row) row[k]++;
  };
  for (const f of fs) {
    if (f.applied) bump(f.appliedDate, "applied");
    if (f.responded) bump(f.responseDate, "responded");
    if (f.interviewed) bump(f.interviewDate, "interviewed");
    if (f.rejected) bump(f.rejectedDate, "rejected");
  }

  const allChanges = apps.flatMap((a) => a.changes);
  return {
    total: apps.length,
    saved: apps.filter((a) => a.status === "SAVED").length,
    active: activeApps.length,
    counts,
    rates,
    smallData: counts.applied < MIN_FOR_RATES,
    timeToResponse: {
      medianDays: median(ttr),
      n: ttr.length,
      fastestDays: ttr.length ? Math.min(...ttr) : null,
      slowestDays: ttr.length ? Math.max(...ttr) : null,
    },
    steps,
    bottleneck,
    waits,
    stuck,
    rejectedAt,
    byCompany: breakdown(apps, facts, (a) => a.company.trim() || "—", 10),
    byDomain: breakdown(apps, facts, (a) => a.domain ?? "unknown", 12),
    bySource: breakdown(apps, facts, sourceKey, 12),
    trend: [...trendMap.values()],
    email: {
      autoChanges: allChanges.filter((c) => c.source === "EMAIL_AUTO" && !c.undone).length,
      reviewChanges: allChanges.filter((c) => c.source === "EMAIL_REVIEW" && !c.undone).length,
      undone: allChanges.filter((c) => c.source !== "MANUAL" && c.undone).length,
      responsesFromEmail: fs.filter((f) => f.responded && f.responseByEmail).length,
    },
  };
}
