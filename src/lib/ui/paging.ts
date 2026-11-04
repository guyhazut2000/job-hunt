/**
 * URL-state "load more" paging (`?show=N`), shared by every server-rendered long list
 * (docs/ui-data-density.md). The list renders the first N items; "טען עוד" links to N + size,
 * so the state survives reload, back/forward and sharing, and works without JavaScript.
 */

/**
 * `?show=N` → how many items to render. Always a whole number of batches, at least one batch and
 * never more than needed for `total` (junk, negatives and huge numbers are clamped).
 */
export function parseShow(raw: string | string[] | undefined, total: number, size: number): number {
  const v = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? "", 10);
  const wanted = Number.isFinite(v) && v > 0 ? Math.ceil(v / size) * size : size;
  const cap = Math.max(size, Math.ceil(total / size) * size);
  return Math.min(wanted, cap);
}

export interface Page<T> {
  items: T[];
  shown: number;
  total: number;
  /** `show` value for the next "load more" link, or null when everything is on the page. */
  nextShow: number | null;
}

/** First `show` items of `all` plus the numbers the "showing X of Y" footer needs. */
export function pageItems<T>(all: readonly T[], show: number, size: number): Page<T> {
  const total = all.length;
  const shown = Math.min(show, total);
  return { items: all.slice(0, shown), shown, total, nextShow: shown < total ? show + size : null };
}

/**
 * Same path and query with `key` set to `show` (dropped when it is the first batch, so the
 * canonical URL stays clean). Other params are kept as they are.
 */
export function showHref(
  path: string,
  params: Record<string, string | string[] | undefined>,
  show: number,
  size: number,
  opts: { key?: string; hash?: string } = {},
): string {
  const key = opts.key ?? "show";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === key || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) p.append(k, one);
  }
  if (show > size) p.set(key, String(show));
  const qs = p.toString();
  return `${path}${qs ? `?${qs}` : ""}${opts.hash ? `#${opts.hash}` : ""}`;
}
