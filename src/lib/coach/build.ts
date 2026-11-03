/**
 * Weekly coach (#97): a rule-based weekly summary built only from data the app already has (the /stats
 * aggregation over applications + outreach contacts). Pure, no I/O. Every recommendation carries the
 * numbers it is based on (`basis`), so the page can always show them, with or without AI phrasing.
 */
import {
  computeStats,
  MIN_FOR_RATES,
  weekStart,
  type ActiveStage,
  type FunnelStep,
  type StatsApp,
} from "@/lib/stats/search-stats";

const DAY = 86_400_000;
/** Applications per week below which we suggest applying more. */
export const WEEKLY_APPLY_TARGET = 5;
/** Outreach messages per week below which we suggest reaching out more. */
export const WEEKLY_OUTREACH_TARGET = 3;
/** Response rate (with enough data) below which we suggest a different approach. */
export const LOW_RESPONSE_RATE = 0.15;
/** Days after a sent outreach message with no reply and no follow-up before it counts as waiting. */
export const OUTREACH_WAIT_DAYS = 7;

export type ContactStatus = "NOT_CONTACTED" | "SENT" | "ACCEPTED" | "REPLIED" | "REFERRED";
export interface CoachContact {
  status: ContactStatus;
  sentAt: Date | null;
  statusAt: Date | null;
  followedUpAt: Date | null;
}

export type RecId =
  | "follow_up_stuck"
  | "complete_profile"
  | "apply_saved"
  | "apply_more"
  | "boost_response"
  | "interview_prep"
  | "outreach_follow_up"
  | "outreach_more"
  | "keep_pace"
  | "review_stats"
  | "practice_interview";

export interface Recommendation {
  id: RecId;
  href: string;
  /** The numbers (and stage keys) this recommendation is based on; also the template variables. */
  basis: Record<string, number | string>;
}

export interface CoachData {
  version: 1;
  /** Sunday of the summarized week (Israel), YYYY-MM-DD. */
  week: string;
  /** Saturday of that week. */
  weekEnd: string;
  /** True when the week is still in progress (live preview). */
  partial: boolean;
  activity: { applied: number; responses: number; interviews: number; rejections: number };
  prevWeek: { applied: number; responses: number };
  totals: { applied: number; responded: number; interviewed: number; offered: number; active: number; saved: number };
  /** Overall response rate, null below MIN_FOR_RATES applications. */
  responseRate: number | null;
  minForRates: number;
  bottleneck: FunnelStep | null;
  stuck: {
    total: number;
    byStage: Record<ActiveStage, number>;
    /** Stage with the most stuck applications. */
    topStage: ActiveStage | null;
    top: { title: string; company: string; status: ActiveStage; days: number; jobId: string | null }[];
  };
  outreach: { sent: number; prevSent: number; replies: number; followUps: number; waiting: number; total: number };
  hasProfile: boolean;
  recommendations: Recommendation[];
}

export const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY).toISOString().slice(0, 10);
/** The last completed Israel week (Sunday) before `now`. */
export const lastWeek = (now: Date) => addDays(weekStart(now), -7);
const inWeek = (d: Date | null | undefined, week: string) => !!d && weekStart(d) === week;
const pct = (x: number) => Math.round(x * 100);

export function buildCoachData(input: {
  apps: StatsApp[];
  contacts: CoachContact[];
  hasProfile: boolean;
  now: Date;
  /** Week to summarize (Sunday); default: the last completed week. */
  week?: string;
}): CoachData {
  const { apps, contacts, hasProfile, now } = input;
  const week = input.week ?? lastWeek(now);
  const prev = addDays(week, -7);
  const st = computeStats(apps, now);
  const row = (w: string) => st.trend.find((t) => t.week === w);
  // The trend covers the last 12 weeks; older weeks (never asked for in practice) count as 0.
  const cur = row(week);
  const before = row(prev);

  const byStage = Object.fromEntries(st.waits.map((w) => [w.stage, w.stuck])) as Record<ActiveStage, number>;
  const stuckTotal = st.waits.reduce((n, w) => n + w.stuck, 0);
  const topWait = [...st.waits].sort((a, b) => b.stuck - a.stuck)[0];

  const waitCutoff = now.getTime() - OUTREACH_WAIT_DAYS * DAY;
  const outreach = {
    sent: contacts.filter((c) => inWeek(c.sentAt, week)).length,
    prevSent: contacts.filter((c) => inWeek(c.sentAt, prev)).length,
    replies: contacts.filter((c) => ["ACCEPTED", "REPLIED", "REFERRED"].includes(c.status) && inWeek(c.statusAt, week))
      .length,
    followUps: contacts.filter((c) => inWeek(c.followedUpAt, week)).length,
    waiting: contacts.filter(
      (c) => c.status === "SENT" && c.sentAt && c.sentAt.getTime() <= waitCutoff && !c.followedUpAt,
    ).length,
    total: contacts.filter((c) => c.status !== "NOT_CONTACTED").length,
  };

  const data: Omit<CoachData, "recommendations"> = {
    version: 1,
    week,
    weekEnd: addDays(week, 6),
    partial: week === weekStart(now),
    activity: {
      applied: cur?.applied ?? 0,
      responses: cur?.responded ?? 0,
      interviews: cur?.interviewed ?? 0,
      rejections: cur?.rejected ?? 0,
    },
    prevWeek: { applied: before?.applied ?? 0, responses: before?.responded ?? 0 },
    totals: {
      applied: st.counts.applied,
      responded: st.counts.responded,
      interviewed: st.counts.interviewed,
      offered: st.counts.offered,
      active: st.active,
      saved: st.saved,
    },
    responseRate: st.rates.response,
    minForRates: MIN_FOR_RATES,
    bottleneck: st.bottleneck,
    stuck: {
      total: stuckTotal,
      byStage,
      topStage: topWait && topWait.stuck > 0 ? topWait.stage : null,
      top: st.stuck.slice(0, 3).map((s) => ({
        title: s.title,
        company: s.company,
        status: s.status,
        days: s.days,
        jobId: s.jobId,
      })),
    },
    outreach,
    hasProfile,
  };
  return { ...data, recommendations: recommend(data) };
}

/** Exactly three recommendations: the highest-priority rules that apply, then data-based fallbacks. */
export function recommend(d: Omit<CoachData, "recommendations">): Recommendation[] {
  const out: Recommendation[] = [];
  const add = (r: Recommendation) => {
    if (out.length < 3 && !out.some((x) => x.id === r.id)) out.push(r);
  };
  if (d.stuck.total > 0 && d.stuck.topStage) {
    add({
      id: "follow_up_stuck",
      href: "/dashboard",
      basis: {
        count: d.stuck.total,
        stage: d.stuck.topStage,
        stageCount: d.stuck.byStage[d.stuck.topStage],
        days: d.stuck.top[0]?.days ?? 0,
      },
    });
  }
  if (!d.hasProfile) add({ id: "complete_profile", href: "/profile", basis: {} });
  if (d.activity.applied < WEEKLY_APPLY_TARGET) {
    if (d.totals.saved > 0) {
      add({
        id: "apply_saved",
        href: "/dashboard",
        basis: { applied: d.activity.applied, target: WEEKLY_APPLY_TARGET, saved: d.totals.saved },
      });
    } else {
      add({
        id: "apply_more",
        href: "/jobs?sort=personal",
        basis: { applied: d.activity.applied, prev: d.prevWeek.applied, target: WEEKLY_APPLY_TARGET },
      });
    }
  }
  if (d.responseRate !== null && d.responseRate < LOW_RESPONSE_RATE) {
    add({
      id: "boost_response",
      href: "/outreach",
      basis: { rate: pct(d.responseRate), responded: d.totals.responded, applied: d.totals.applied },
    });
  }
  if (d.bottleneck && d.bottleneck.from !== "applied" && d.bottleneck.rate !== null) {
    add({
      id: "interview_prep",
      href: "/interview",
      basis: {
        rate: pct(d.bottleneck.rate),
        from: d.bottleneck.from,
        to: d.bottleneck.to,
        interviewed: d.totals.interviewed,
        responded: d.totals.responded,
      },
    });
  }
  if (d.outreach.waiting > 0) {
    add({ id: "outreach_follow_up", href: "/outreach", basis: { count: d.outreach.waiting, days: OUTREACH_WAIT_DAYS } });
  }
  if (d.outreach.sent < WEEKLY_OUTREACH_TARGET) {
    add({
      id: "outreach_more",
      href: "/outreach",
      basis: { sent: d.outreach.sent, target: WEEKLY_OUTREACH_TARGET, replies: d.outreach.replies },
    });
  }
  // Fallbacks (always applicable, still grounded in numbers).
  add({ id: "keep_pace", href: "/jobs?sort=personal", basis: { applied: d.activity.applied, prev: d.prevWeek.applied } });
  add({
    id: "review_stats",
    href: "/stats",
    basis: { applied: d.totals.applied, responded: d.totals.responded, interviewed: d.totals.interviewed },
  });
  add({ id: "practice_interview", href: "/interview", basis: { interviewed: d.totals.interviewed } });
  return out;
}

/** Nothing at all to summarize: no applications ever and no outreach. */
export const coachIsEmpty = (d: CoachData) =>
  d.totals.applied === 0 && d.totals.saved === 0 && d.outreach.total === 0;
