/**
 * Optional per-employer application keys. Empty in every normal setup: a person applying to
 * jobs does not hold the company's Greenhouse Job Board key or Ashby API key.
 * Shape: {"GREENHOUSE":{"boardToken":"..."},"ASHBY":{"orgSlug":"..."}}
 * Values are never logged. A bad payload is treated as "no keys".
 */

export interface BoardKeys {
  greenhouse: Record<string, string>;
  ashby: Record<string, string>;
}

const EMPTY: BoardKeys = { greenhouse: {}, ashby: {} };

function bucket(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    const id = key.trim();
    const secret = value.trim();
    if (!id || id.length > 120 || !secret || secret.length > 500) continue;
    out[id] = secret;
  }
  return out;
}

export function parseBoardKeys(raw: string | undefined | null): BoardKeys {
  if (!raw?.trim()) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return EMPTY;
    const body = parsed as Record<string, unknown>;
    return {
      greenhouse: bucket(body.GREENHOUSE ?? body.greenhouse),
      ashby: bucket(body.ASHBY ?? body.ashby),
    };
  } catch {
    return EMPTY;
  }
}

export function boardKeysFromEnv(env: NodeJS.ProcessEnv = process.env): BoardKeys {
  return parseBoardKeys(env.APPLY_BOARD_KEYS);
}
