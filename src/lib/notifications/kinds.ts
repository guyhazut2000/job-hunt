/** Notification kinds and external channels (plain strings in the DB; validated here). */
export const NOTIFICATION_KINDS = ["JOB_MATCH", "SAVED_JOB_CLOSED", "FOLLOW_UP", "SYSTEM"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** External channels. In-site is always on and not listed here. */
export const EXTERNAL_CHANNELS = ["push", "telegram"] as const;
export type ExternalChannel = (typeof EXTERNAL_CHANNELS)[number];

export const CHANNEL_TYPES = { push: "WEB_PUSH", telegram: "TELEGRAM" } as const;
export type ChannelType = (typeof CHANNEL_TYPES)[ExternalChannel];

export function channelOfType(type: string): ExternalChannel | null {
  if (type === CHANNEL_TYPES.push) return "push";
  if (type === CHANNEL_TYPES.telegram) return "telegram";
  return null;
}

export const isKind = (k: unknown): k is NotificationKind =>
  typeof k === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(k);

/** Per-kind channel overrides as stored in NotificationPreference.channels. */
export type ChannelOverrides = Partial<Record<NotificationKind, Partial<Record<ExternalChannel, boolean>>>>;

/** Defaults: everything on, except SYSTEM which stays in-site only unless turned on. */
const DEFAULT_ON: Record<NotificationKind, Record<ExternalChannel, boolean>> = {
  JOB_MATCH: { push: true, telegram: true },
  SAVED_JOB_CLOSED: { push: true, telegram: true },
  FOLLOW_UP: { push: true, telegram: true },
  SYSTEM: { push: false, telegram: false },
};

export function parseOverrides(raw: unknown): ChannelOverrides {
  const out: ChannelOverrides = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isKind(k) || !v || typeof v !== "object") continue;
    const entry: Partial<Record<ExternalChannel, boolean>> = {};
    for (const ch of EXTERNAL_CHANNELS) {
      const b = (v as Record<string, unknown>)[ch];
      if (typeof b === "boolean") entry[ch] = b;
    }
    out[k] = entry;
  }
  return out;
}

export function channelEnabled(overrides: ChannelOverrides, kind: NotificationKind, ch: ExternalChannel): boolean {
  return overrides[kind]?.[ch] ?? DEFAULT_ON[kind][ch];
}
