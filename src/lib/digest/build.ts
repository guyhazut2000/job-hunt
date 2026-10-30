/**
 * Daily digest: the data shape (stored as Digest.content), localized sections for the page and
 * Telegram, the summary line and the deterministic "streamline your process" suggestions.
 * Pure — the server side (collect.ts) gathers DigestData, run.ts stores and sends it.
 */
import type { Locale } from "@/lib/i18n/dictionaries";
import { fill } from "@/lib/i18n/notifications";
import { reminderStrings } from "@/lib/i18n/reminders";
import { STAGE_LABELS, isStageKind } from "@/lib/hiring/kinds";

export interface DigestJob {
  id: string;
  title: string;
  company: string;
  score?: number;
}

export interface DigestData {
  version: 1;
  /** Israel date YYYY-MM-DD this digest is for. */
  day: string;
  /** Window start (previous digest or 24h ago), ISO. */
  since: string;
  generatedAt: string;
  newJobs: {
    /** Jobs reported by saved-search alerts in the window. */
    fromSearches: number;
    searches: { id: string; name: string; count: number }[];
    /** New jobs in the window that match the profile well (score ≥ 70), best first. */
    matchCount: number;
    top: DigestJob[];
  };
  statusChanges: { id: string; title: string; company: string; status: string; stage: string | null }[];
  followUps: { id: string; title: string; company: string; days: number; jobId: string | null }[];
  interviews: { id: string; title: string; company: string; at: string; note: string | null; jobId?: string | null }[];
  /** Applications in INTERVIEW status with no upcoming date (reminders can't fire). */
  interviewsMissingDate: number;
  learning: {
    streak: number;
    minutesThisWeek: number;
    activeDaysThisWeek: number;
    goalHours: number;
    reviewsDue: number;
    next: { label: string; url: string } | null;
  } | null;
  scans: { runs: number; failed: number; companies: string[] };
  pipeline: {
    saved: number;
    applied: number;
    screening: number;
    interview: number;
    offer: number;
    rejected: number;
    /** SAVED for over 7 days without applying. */
    staleSaved: number;
    /** In SCREENING with no change for 14+ days. */
    stuckScreening: number;
  };
  savedSearches: number;
  /** Notifications of kinds set to "digest" (held from push/Telegram) in the window, newest first. */
  held?: { id: string; kind: string; title: string; url: string | null }[];
}

export interface DigestItem {
  text: string;
  url?: string;
}

export type SectionKey = "held" | "jobs" | "status" | "followups" | "interviews" | "learning" | "scans";

export interface DigestSection {
  key: SectionKey;
  title: string;
  icon: string;
  count: number;
  items: DigestItem[];
  /** Shown when there is nothing to report. */
  empty?: string;
}

export interface Suggestion {
  title: string;
  detail: string;
  url?: string;
}

export type SuggestionSource = "ai" | "offline" | "limited";

const ITEMS = 5;

export function formatInterviewAt(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "Asia/Jerusalem",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(day: string, locale: Locale): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(locale === "he" ? "he-IL" : "en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const STATUS: Record<Locale, Record<string, string>> = {
  en: {
    SAVED: "Saved",
    APPLIED: "Applied",
    SCREENING: "Screening",
    INTERVIEW: "Interview",
    OFFER: "Offer",
    REJECTED: "Rejected",
  },
  he: {
    SAVED: "שמור",
    APPLIED: "הוגש",
    SCREENING: "סינון ראשוני",
    INTERVIEW: "ראיונות",
    OFFER: "הצעה",
    REJECTED: "נדחה",
  },
};

export function digestIsEmpty(d: DigestData): boolean {
  return (
    d.newJobs.fromSearches + d.newJobs.matchCount === 0 &&
    !d.statusChanges.length &&
    !d.followUps.length &&
    !d.interviews.length &&
    d.interviewsMissingDate === 0 &&
    d.scans.failed === 0 &&
    !d.held?.length &&
    !(d.learning && (d.learning.reviewsDue > 0 || d.learning.minutesThisWeek > 0 || d.learning.streak > 0))
  );
}

export function digestSections(d: DigestData, locale: Locale): DigestSection[] {
  const s = reminderStrings(locale);
  const st = STATUS[locale];
  const newJobs = Math.max(d.newJobs.fromSearches, d.newJobs.matchCount);
  const jobs: DigestItem[] = [
    ...d.newJobs.top.slice(0, ITEMS).map((j) => ({
      text: `${j.title} · ${j.company}${j.score !== undefined ? ` (${j.score}%)` : ""}`,
      url: `/jobs/${j.id}`,
    })),
    ...d.newJobs.searches.slice(0, 3).map((x) => ({
      text: fill(s.dgSearchLine, { name: x.name, n: x.count }),
      url: "/notifications",
    })),
  ];
  const status = d.statusChanges.slice(0, ITEMS + 3).map((a) => ({
    text: `${a.title} · ${a.company} → ${st[a.status] ?? a.status}${
      a.stage && isStageKind(a.stage) ? ` (${STAGE_LABELS[locale][a.stage]})` : ""
    }`,
    url: "/dashboard",
  }));
  const followups = d.followUps.slice(0, ITEMS).map((a) => ({
    text: fill(s.dgFollowLine, { title: a.title, company: a.company, days: a.days }),
    url: `/dashboard?followup=${a.id}#app-${a.id}`,
  }));
  const interviews: DigestItem[] = d.interviews.slice(0, ITEMS).map((i) => ({
    text: `${formatInterviewAt(i.at, locale)} — ${i.title} · ${i.company}`,
    url: "/dashboard",
  }));
  if (d.interviewsMissingDate)
    interviews.push({ text: fill(s.dgMissingDate, { n: d.interviewsMissingDate }), url: "/dashboard" });
  const learning: DigestItem[] = [];
  if (d.learning) {
    const l = d.learning;
    learning.push({
      text: fill(s.dgLearnWeek, {
        min: l.minutesThisWeek,
        goal: l.goalHours * 60,
        days: l.activeDaysThisWeek,
      }),
    });
    if (l.streak > 0) learning.push({ text: fill(s.dgLearnStreak, { n: l.streak }) });
    if (l.reviewsDue > 0) learning.push({ text: fill(s.dgLearnReviews, { n: l.reviewsDue }), url: "/learn/me" });
    if (l.next) learning.push({ text: fill(s.dgLearnNext, { topic: l.next.label }), url: l.next.url });
  }
  const scans: DigestItem[] = d.scans.failed
    ? [
        {
          text: fill(s.dgScanFailed, { failed: d.scans.failed, runs: d.scans.runs }),
        },
        ...(d.scans.companies.length ? [{ text: d.scans.companies.slice(0, ITEMS).join(", ") }] : []),
      ]
    : [];

  const held = d.held ?? [];
  const sections: DigestSection[] = [];
  if (held.length)
    sections.push({
      key: "held",
      icon: "🔔",
      title: s.dgHeld,
      count: held.length,
      items: held.slice(0, ITEMS + 3).map((h) => ({ text: h.title, url: h.url ?? "/notifications" })),
    });
  sections.push(
    { key: "jobs", icon: "🔎", title: s.dgJobs, count: newJobs, items: jobs, empty: s.dgJobsEmpty },
    { key: "status", icon: "🔄", title: s.dgStatus, count: d.statusChanges.length, items: status, empty: s.dgNone },
    { key: "followups", icon: "✉️", title: s.dgFollow, count: d.followUps.length, items: followups, empty: s.dgNone },
    {
      key: "interviews",
      icon: "🗓️",
      title: s.dgInterviews,
      count: d.interviews.length,
      items: interviews,
      empty: s.dgInterviewsEmpty,
    },
  );
  if (d.learning)
    sections.push({ key: "learning", icon: "📚", title: s.dgLearning, count: learning.length, items: learning });
  sections.push({
    key: "scans",
    icon: d.scans.failed ? "⚠️" : "✅",
    title: s.dgScans,
    count: d.scans.failed,
    items: scans,
    empty: d.scans.runs ? fill(s.dgScansOk, { runs: d.scans.runs }) : s.dgScansNone,
  });
  return sections;
}

/** One line: "3 new jobs · 2 updates · 1 follow-up · interview Thu 14:00". */
export function digestSummary(d: DigestData, locale: Locale): string {
  const s = reminderStrings(locale);
  const parts: string[] = [];
  const jobs = Math.max(d.newJobs.fromSearches, d.newJobs.matchCount);
  if (jobs) parts.push(fill(s.sumJobs, { n: jobs }));
  if (d.statusChanges.length) parts.push(fill(s.sumStatus, { n: d.statusChanges.length }));
  if (d.followUps.length) parts.push(fill(s.sumFollow, { n: d.followUps.length }));
  if (d.interviews.length) parts.push(fill(s.sumInterview, { when: formatInterviewAt(d.interviews[0].at, locale) }));
  if (d.learning?.reviewsDue) parts.push(fill(s.sumReviews, { n: d.learning.reviewsDue }));
  if (d.interviewsMissingDate) parts.push(fill(s.sumNoDate, { n: d.interviewsMissingDate }));
  if (d.scans.failed) parts.push(fill(s.sumScans, { n: d.scans.failed }));
  if (d.held?.length) parts.push(fill(s.sumHeld, { n: d.held.length }));
  if (!parts.length && d.learning?.streak) parts.push(fill(s.sumStreak, { n: d.learning.streak }));
  else if (!parts.length && d.learning?.minutesThisWeek)
    parts.push(fill(s.sumMinutes, { n: d.learning.minutesThisWeek }));
  return parts.length ? parts.join(" · ") : s.sumQuiet;
}

/** Rule-based "streamline your process" tips; also the fallback when the AI is off or limited. */
export function fallbackSuggestions(d: DigestData, locale: Locale, max = 4): Suggestion[] {
  const s = reminderStrings(locale);
  const out: Suggestion[] = [];
  if (d.interviews.length) {
    const i = d.interviews[0];
    out.push({
      title: fill(s.sgPrepTitle, { company: i.company }),
      detail: fill(s.sgPrepDetail, { when: formatInterviewAt(i.at, locale) }),
      url: i.jobId ? `/jobs/${i.jobId}` : "/dashboard",
    });
  }
  if (d.followUps.length)
    out.push({
      title: fill(s.sgFollowTitle, { n: d.followUps.length }),
      detail: s.sgFollowDetail,
      url: "/dashboard",
    });
  if (d.interviewsMissingDate)
    out.push({ title: s.sgDateTitle, detail: fill(s.sgDateDetail, { n: d.interviewsMissingDate }), url: "/dashboard" });
  if (d.pipeline.stuckScreening)
    out.push({
      title: fill(s.sgStuckTitle, { n: d.pipeline.stuckScreening }),
      detail: s.sgStuckDetail,
      url: "/dashboard",
    });
  if (d.pipeline.staleSaved >= 3)
    out.push({
      title: fill(s.sgStaleTitle, { n: d.pipeline.staleSaved }),
      detail: s.sgStaleDetail,
      url: "/dashboard",
    });
  if (d.newJobs.matchCount + d.newJobs.fromSearches > 0 && d.pipeline.applied + d.pipeline.screening < 5)
    out.push({ title: s.sgApplyTitle, detail: s.sgApplyDetail, url: "/jobs?sort=newest" });
  if (!d.savedSearches) out.push({ title: s.sgSearchTitle, detail: s.sgSearchDetail, url: "/jobs" });
  if (d.learning && d.learning.minutesThisWeek < (d.learning.goalHours * 60) / 2)
    out.push({
      title: s.sgLearnTitle,
      detail: d.learning.next ? fill(s.sgLearnDetailNext, { topic: d.learning.next.label }) : s.sgLearnDetail,
      url: d.learning.next?.url ?? "/learn/me",
    });
  if (!out.length) out.push({ title: s.sgKeepTitle, detail: s.sgKeepDetail, url: "/jobs" });
  return out.slice(0, max);
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram HTML message (≤ ~3900 chars, Telegram's limit is 4096). */
export function digestTelegramHtml(
  d: DigestData,
  suggestions: Suggestion[],
  locale: Locale,
  link: string,
  maxLen = 3900,
): string {
  const s = reminderStrings(locale);
  const head = [`<b>📰 ${esc(fill(s.dgTitle, { date: formatDay(d.day, locale) }))}</b>`, esc(digestSummary(d, locale))];
  const blocks: string[] = [];
  for (const sec of digestSections(d, locale)) {
    if (!sec.items.length) continue;
    blocks.push([`<b>${sec.icon} ${esc(sec.title)}</b>`, ...sec.items.map((i) => `• ${esc(i.text)}`)].join("\n"));
  }
  if (suggestions.length)
    blocks.push(
      [
        `<b>💡 ${esc(s.dgStreamline)}</b>`,
        ...suggestions.map((x) => `• <b>${esc(x.title)}</b> — ${esc(x.detail)}`),
      ].join("\n"),
    );
  const tail = `${esc(s.dgOpen)}: ${link}`;
  let text = [head.join("\n"), ...blocks, tail].join("\n\n");
  // Drop whole blocks from the middle (keep the tips) until it fits, then hard-cut as a last resort.
  while (text.length > maxLen && blocks.length > 1) {
    blocks.splice(blocks.length - 2, 1);
    text = [head.join("\n"), ...blocks, tail].join("\n\n");
  }
  if (text.length > maxLen) text = `${text.slice(0, maxLen - tail.length - 3)}…\n\n${tail}`;
  return text;
}

/** Validate stored content (tolerates old/missing fields). */
export function parseDigestData(raw: unknown): DigestData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<DigestData>;
  if (r.version !== 1 || typeof r.day !== "string") return null;
  const empty = emptyDigestData(r.day, new Date(r.since ?? Date.now()), new Date(r.generatedAt ?? Date.now()));
  return {
    ...empty,
    ...r,
    newJobs: { ...empty.newJobs, ...r.newJobs },
    scans: { ...empty.scans, ...r.scans },
    pipeline: { ...empty.pipeline, ...r.pipeline },
    held: Array.isArray(r.held) ? r.held : [],
  } as DigestData;
}

export function emptyDigestData(day: string, since: Date, now: Date): DigestData {
  return {
    version: 1,
    day,
    since: since.toISOString(),
    generatedAt: now.toISOString(),
    newJobs: { fromSearches: 0, searches: [], matchCount: 0, top: [] },
    statusChanges: [],
    followUps: [],
    interviews: [],
    interviewsMissingDate: 0,
    learning: null,
    scans: { runs: 0, failed: 0, companies: [] },
    pipeline: {
      saved: 0,
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 0,
      rejected: 0,
      staleSaved: 0,
      stuckScreening: 0,
    },
    savedSearches: 0,
    held: [],
  };
}

/** Digest window: since the previous digest (max 7 days back), else the last 24 hours. */
export function digestWindowStart(lastDigestAt: Date | null, now: Date): Date {
  const day = 86_400_000;
  if (!lastDigestAt) return new Date(now.getTime() - day);
  return new Date(Math.max(lastDigestAt.getTime(), now.getTime() - 7 * day));
}

/** Should the hourly run generate today's digest for this user? */
export function digestDue(
  p: { digestEnabled: boolean; digestHour: number },
  israelHour: number,
  hasToday: boolean,
): boolean {
  return p.digestEnabled && !hasToday && israelHour >= p.digestHour;
}

/** Stored suggestions (JSON) → a safe list. */
export function parseSuggestions(raw: unknown): Suggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => ({
      title: typeof x.title === "string" ? x.title : "",
      detail: typeof x.detail === "string" ? x.detail : "",
      ...(typeof x.url === "string" && x.url.startsWith("/") && !x.url.startsWith("//") ? { url: x.url } : {}),
    }))
    .filter((x) => x.title)
    .slice(0, 6);
}
