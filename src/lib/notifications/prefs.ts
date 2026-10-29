import type { NotificationPreference } from "@prisma/client";
import { db } from "@/lib/db";
import { parseOverrides, type ChannelOverrides } from "./kinds";
import { DEFAULT_QUIET, type QuietPrefs } from "./quiet";

export interface EffectivePrefs extends QuietPrefs {
  followUpEnabled: boolean;
  followUpDays: number;
  maxPerHour: number;
  overrides: ChannelOverrides;
  learningEnabled: boolean;
  learningHour: number;
  /** Israel weekdays, 0 = Sunday. */
  learningDays: number[];
  learningIdleDays: number;
  interviewEnabled: boolean;
  digestEnabled: boolean;
  digestHour: number;
}

export const DEFAULT_PREFS: EffectivePrefs = {
  ...DEFAULT_QUIET,
  followUpEnabled: true,
  followUpDays: 7,
  maxPerHour: 6,
  overrides: {},
  learningEnabled: true,
  learningHour: 19,
  learningDays: [0, 1, 2, 3, 4],
  learningIdleDays: 2,
  interviewEnabled: true,
  digestEnabled: true,
  digestHour: 8,
};

/** Valid, sorted, unique weekdays (0–6). */
export function cleanWeekdays(days: unknown): number[] {
  if (!Array.isArray(days)) return [];
  return [...new Set(days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
}

export function toEffective(p: NotificationPreference | null | undefined): EffectivePrefs {
  if (!p) return DEFAULT_PREFS;
  return {
    quietEnabled: p.quietEnabled,
    quietStart: p.quietStart,
    quietEnd: p.quietEnd,
    quietShabbat: p.quietShabbat,
    followUpEnabled: p.followUpEnabled,
    followUpDays: p.followUpDays,
    maxPerHour: p.maxPerHour,
    overrides: parseOverrides(p.channels),
    learningEnabled: p.learningEnabled ?? DEFAULT_PREFS.learningEnabled,
    learningHour: p.learningHour ?? DEFAULT_PREFS.learningHour,
    learningDays: p.learningDays ? cleanWeekdays(p.learningDays) : DEFAULT_PREFS.learningDays,
    learningIdleDays: p.learningIdleDays ?? DEFAULT_PREFS.learningIdleDays,
    interviewEnabled: p.interviewEnabled ?? DEFAULT_PREFS.interviewEnabled,
    digestEnabled: p.digestEnabled ?? DEFAULT_PREFS.digestEnabled,
    digestHour: p.digestHour ?? DEFAULT_PREFS.digestHour,
  };
}

export async function getPrefs(userId: string): Promise<EffectivePrefs> {
  return toEffective(await db.notificationPreference.findUnique({ where: { userId } }));
}
