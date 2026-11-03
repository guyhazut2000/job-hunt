import type { Locale } from "@/lib/i18n/dictionaries";
import { coachStrings } from "@/lib/i18n/coach";
import { fill } from "@/lib/i18n/notifications";
import type { CoachData, Recommendation } from "./build";

/** Template variables for a recommendation: stage / funnel-step keys become localized labels. */
export function recVars(locale: Locale, r: Recommendation): Record<string, string | number> {
  const s = coachStrings(locale);
  const out: Record<string, string | number> = { ...r.basis };
  if (typeof r.basis.stage === "string") out.stage = s.stage[r.basis.stage] ?? r.basis.stage;
  if (typeof r.basis.from === "string") out.from = s.step[r.basis.from] ?? r.basis.from;
  if (typeof r.basis.to === "string") out.to = s.step[r.basis.to] ?? r.basis.to;
  return out;
}

/** The rule-based wording of a recommendation. */
export function recText(locale: Locale, r: Recommendation): { title: string; detail: string } {
  const t = coachStrings(locale).rec[r.id];
  const v = recVars(locale, r);
  return { title: fill(t.title, v), detail: fill(t.detail, v) };
}

/** Notification title + body (body = the first recommendation). */
export function coachNotification(locale: Locale, d: CoachData): { title: string; body: string } {
  const s = coachStrings(locale);
  const first = d.recommendations[0];
  return {
    title: fill(s.notifTitle, { applied: d.activity.applied, responses: d.activity.responses }),
    body: first ? fill(s.notifBody, { first: recText(locale, first).title }) : "",
  };
}
