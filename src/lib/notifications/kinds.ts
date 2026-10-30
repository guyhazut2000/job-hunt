/** Notification kinds and external channels (plain strings in the DB; validated here). */
export const NOTIFICATION_KINDS = [
  "JOB_MATCH",
  "COMPANY_JOBS",
  "SAVED_JOB_CLOSED",
  "SAVED_JOB_UPDATED",
  "STAGE_CHANGE",
  "FOLLOW_UP",
  "INTERVIEW",
  "LEARNING",
  "DIGEST",
  "SCAN_FAILED",
  "EMAIL_UPDATE",
  "WHATS_NEW",
  "SYSTEM",
] as const;
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

/**
 * Defaults: everything on, except SYSTEM and WHATS_NEW (in-site only unless turned on), and the daily
 * digest, scan-problem and hiring-stage messages on push (a long read / not urgent — Telegram and
 * in-site only; push can be turned on).
 */
const DEFAULT_ON: Record<NotificationKind, Record<ExternalChannel, boolean>> = {
  JOB_MATCH: { push: true, telegram: true },
  COMPANY_JOBS: { push: true, telegram: true },
  SAVED_JOB_CLOSED: { push: true, telegram: true },
  SAVED_JOB_UPDATED: { push: true, telegram: true },
  STAGE_CHANGE: { push: false, telegram: true },
  FOLLOW_UP: { push: true, telegram: true },
  INTERVIEW: { push: true, telegram: true },
  LEARNING: { push: true, telegram: true },
  DIGEST: { push: false, telegram: true },
  SCAN_FAILED: { push: false, telegram: true },
  EMAIL_UPDATE: { push: true, telegram: true },
  WHATS_NEW: { push: false, telegram: false },
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

/** Kinds whose push/Telegram messages are not dropped by the per-hour cap (scheduled and time-critical). */
export const CAP_EXEMPT: readonly NotificationKind[] = ["INTERVIEW", "DIGEST"];

export function channelEnabled(overrides: ChannelOverrides, kind: NotificationKind, ch: ExternalChannel): boolean {
  return overrides[kind]?.[ch] ?? DEFAULT_ON[kind][ch];
}

/**
 * Per kind: send push/Telegram right away ("instant") or hold it for the daily digest ("digest").
 * Held notifications still appear in-site immediately. Stored in NotificationPreference.modes.
 */
export const DELIVERY_MODES = ["instant", "digest"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];
export type ModeOverrides = Partial<Record<NotificationKind, DeliveryMode>>;

/** Always instant: the digest itself, and interview reminders (time-critical). */
export const INSTANT_ONLY: readonly NotificationKind[] = ["DIGEST", "INTERVIEW"];

export function parseModes(raw: unknown): ModeOverrides {
  const out: ModeOverrides = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isKind(k) && !INSTANT_ONLY.includes(k) && (v === "instant" || v === "digest")) out[k] = v;
  }
  return out;
}

export function deliveryMode(modes: ModeOverrides, kind: NotificationKind): DeliveryMode {
  return INSTANT_ONLY.includes(kind) ? "instant" : (modes[kind] ?? "instant");
}
