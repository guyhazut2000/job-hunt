/** Debounce delays for auto-applied filters (ms): choices apply quickly, typing waits for a pause. */
export const CHOICE_DELAY = 650;
export const TYPING_DELAY = 800;

/** Params that must not survive a filter change (the result set changes, so page 1 again). */
const RESET_ON_CHANGE = ["page"];

/**
 * The query string a filter form should navigate to: params the form doesn't own (view, commute
 * origin, …) are kept, the form's own fields are replaced by its current values, empty values are
 * dropped (`?role=` → nothing) and pagination resets. Returns "" or "?a=1&b=2".
 */
export function buildFilterQuery(
  current: URLSearchParams | string,
  owned: Iterable<string>,
  entries: Iterable<[string, string]>,
): string {
  const ownedSet = new Set(owned);
  const out = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(current)) {
    if (ownedSet.has(k) || RESET_ON_CHANGE.includes(k) || v === "") continue;
    out.append(k, v);
  }
  const seen = new Set<string>();
  for (const [k, v] of entries) {
    if (v === "") continue;
    const pair = `${k}=${v}`;
    if (seen.has(pair)) continue; // a value can be submitted twice (visible + hidden copy)
    seen.add(pair);
    out.append(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** Same filters, order-insensitive — used to tell our own navigation from an outside one (chip, link). */
export function sameQuery(a: string, b: string): boolean {
  const norm = (q: string) =>
    [...new URLSearchParams(q)]
      .filter(([k, v]) => v !== "" && !RESET_ON_CHANGE.includes(k))
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("&");
  return norm(a) === norm(b);
}

/** Debounce for one changed control: typing waits longer than a click. */
export function delayFor(el: { type?: string; tagName?: string }): number {
  const t = (el.type ?? "").toLowerCase();
  return el.tagName === "INPUT" && ["text", "search", "number", "email", "url", "tel"].includes(t)
    ? TYPING_DELAY
    : CHOICE_DELAY;
}
