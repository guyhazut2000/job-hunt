import type { NotificationPreference } from "@prisma/client";
import { db } from "@/lib/db";
import { parseOverrides, type ChannelOverrides } from "./kinds";
import { DEFAULT_QUIET, type QuietPrefs } from "./quiet";

export interface EffectivePrefs extends QuietPrefs {
  followUpEnabled: boolean;
  followUpDays: number;
  maxPerHour: number;
  overrides: ChannelOverrides;
}

export const DEFAULT_PREFS: EffectivePrefs = {
  ...DEFAULT_QUIET,
  followUpEnabled: true,
  followUpDays: 7,
  maxPerHour: 6,
  overrides: {},
};

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
  };
}

export async function getPrefs(userId: string): Promise<EffectivePrefs> {
  return toEffective(await db.notificationPreference.findUnique({ where: { userId } }));
}
