/**
 * In-memory "show N more" logic for client lists (Kanban columns, dashboard sections, outreach,
 * referrals). Pure so it can be unit-tested; see docs/ui-data-density.md.
 */

/** Next visible count after one "show more" click. */
export function revealMore(current: number, total: number, step: number): number {
  return Math.min(total, Math.max(current, 0) + Math.max(step, 1));
}

/** How many a "show more" click would add (the button label), 0 when nothing is hidden. */
export function nextBatch(current: number, total: number, step: number): number {
  return Math.max(0, revealMore(current, total, step) - Math.min(current, total));
}

/**
 * The first `limit` items plus any "pinned" item beyond it (a card a link points at, an open
 * draft), in their original order, so deep links never land on a hidden item.
 */
export function visibleWithPinned<T>(
  items: readonly T[],
  limit: number,
  isPinned: (item: T) => boolean,
): { visible: T[]; hidden: number } {
  const visible = items.filter((it, i) => i < limit || isPinned(it));
  return { visible, hidden: items.length - visible.length };
}

/** Smallest visible count (in whole steps from `initial`) that includes index `index`. */
export function countToInclude(index: number, initial: number, step: number): number {
  if (index < initial) return initial;
  return initial + Math.ceil((index + 1 - initial) / Math.max(step, 1)) * Math.max(step, 1);
}

/** Case-insensitive, whitespace-tolerant "every word appears" match for quick list filters. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack.toLowerCase();
  return words.every((w) => h.includes(w));
}
