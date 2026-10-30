import { followUpState, type FollowUpApp, type FollowUpState } from "./timing";

/** What the card/dashboard shows for an application's follow-up (serializable, for client components). */
export type FollowUpView =
  | { kind: "due"; round: 1 | 2; days: number; sent: number; lastSent: string | null; appliedOn: string; every: number }
  | { kind: "ghost"; days: number; sent: number; lastSent: string | null; appliedOn: string; every: number }
  | { kind: "snoozed"; until: string; sent: number; lastSent: string | null; appliedOn: string; every: number }
  | { kind: "waiting"; dueOn: string; sent: number; lastSent: string | null; appliedOn: string; every: number }
  | { kind: "off" | "noResponse" | "replied"; sent: number; lastSent: string | null; appliedOn: string; every: number };

export function followUpView(
  app: FollowUpApp,
  prefs: { followUpEnabled: boolean; followUpDays: number },
  now: Date,
  replied: boolean,
  fmtDate: (d: Date) => string,
): FollowUpView | null {
  if (app.status !== "APPLIED") return null;
  const s: FollowUpState = followUpState(app, prefs, now, { emailResponse: replied });
  const base = {
    sent: app.followUpCount ?? 0,
    lastSent: app.lastFollowUpAt ? fmtDate(app.lastFollowUpAt) : null,
    appliedOn: fmtDate(app.appliedAt ?? app.createdAt),
    every: Math.min(60, Math.max(1, Math.round(prefs.followUpDays))),
  };
  switch (s.kind) {
    case "due":
      return { kind: "due", round: s.round, days: s.days, ...base };
    case "ghost":
      return { kind: "ghost", days: s.days, ...base };
    case "snoozed":
      return { kind: "snoozed", until: fmtDate(s.until), ...base };
    case "waiting":
      return { kind: "waiting", dueOn: fmtDate(s.dueAt), ...base };
    case "stopped":
      if (s.reason === "off") return { kind: "off", ...base };
      if (s.reason === "no_response") return { kind: "noResponse", ...base };
      if (s.reason === "email_response") return { kind: "replied", ...base };
      return null; // disabled in settings
  }
}
