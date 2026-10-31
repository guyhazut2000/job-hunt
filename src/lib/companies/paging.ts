import type { LetterGroup } from "@/lib/alpha";

/** Cards per "טען עוד" batch. 48 divides evenly into the 1/2/3-column grid. */
export const COMPANIES_PAGE_SIZE = 48;

/**
 * `?show=N` → how many cards to render. Always a whole number of batches, at least one batch and
 * never more than needed for `total` (junk, negatives and huge numbers are clamped).
 */
export function parseShow(raw: string | string[] | undefined, total: number, size = COMPANIES_PAGE_SIZE): number {
  const v = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? "", 10);
  const wanted = Number.isFinite(v) && v > 0 ? Math.ceil(v / size) * size : size;
  const cap = Math.max(size, Math.ceil(total / size) * size);
  return Math.min(wanted, cap);
}

export interface PagedGroups<T> {
  /** The letter sections to render, cut off after `shown` cards (a section may be partial). */
  groups: LetterGroup<T>[];
  shown: number;
  total: number;
  /** Next `show` value for the "load more" link, or null when everything is on the page. */
  nextShow: number | null;
  /** Per letter: the smallest `show` that renders that whole section (for the A–Z jump bar). */
  showFor: Map<string, number>;
}

/** Slice letter groups (already in display order) to the first `show` cards. */
export function pageGroups<T>(all: LetterGroup<T>[], show: number, size = COMPANIES_PAGE_SIZE): PagedGroups<T> {
  const total = all.reduce((n, g) => n + g.items.length, 0);
  const groups: LetterGroup<T>[] = [];
  const showFor = new Map<string, number>();
  let seen = 0;
  for (const g of all) {
    const start = seen;
    seen += g.items.length;
    showFor.set(g.letter, Math.max(size, Math.ceil(seen / size) * size));
    if (start < show) groups.push(start + g.items.length <= show ? g : { ...g, items: g.items.slice(0, show - start) });
  }
  const shown = Math.min(show, total);
  return { groups, shown, total, nextShow: shown < total ? show + size : null, showFor };
}

/** `/companies` URL keeping the current filter and search; `show` omitted when it is the first batch. */
export function companiesHref(
  opts: { sync?: string; q?: string; show?: number; hash?: string },
  size = COMPANIES_PAGE_SIZE,
): string {
  const p = new URLSearchParams();
  if (opts.sync && opts.sync !== "all") p.set("sync", opts.sync);
  if (opts.q) p.set("q", opts.q);
  if (opts.show && opts.show > size) p.set("show", String(opts.show));
  const qs = p.toString();
  return `/companies${qs ? `?${qs}` : ""}${opts.hash ? `#${opts.hash}` : ""}`;
}
