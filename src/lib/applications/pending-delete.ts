/**
 * Delayed delete with undo for dashboard applications.
 *
 * Deleting only hides the card and starts a timer; the row is deleted when the timer runs out (or
 * right away when the page is left), so "בטל" restores everything untouched — status history,
 * notes, follow-up drafts, tailored CVs and interview sessions never leave the database.
 */
export const UNDO_DELETE_MS = 7000;

export interface PendingDeleteQueue {
  /** Hide now, delete after `delayMs` unless undone. */
  schedule(id: string): void;
  /** Cancel a pending delete. Returns false if it already ran (or never existed). */
  undo(id: string): boolean;
  /** Delete everything still pending now (page hidden / component unmounting). Returns those ids. */
  flush(): string[];
  pending(): string[];
}

export function createPendingDeleteQueue(opts: {
  commit: (ids: string[]) => void;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): PendingDeleteQueue {
  const delay = opts.delayMs ?? UNDO_DELETE_MS;
  const setT = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const timers = new Map<string, unknown>();
  return {
    schedule(id) {
      if (timers.has(id)) return;
      timers.set(
        id,
        setT(() => {
          if (!timers.delete(id)) return;
          opts.commit([id]);
        }, delay),
      );
    },
    undo(id) {
      const h = timers.get(id);
      if (h === undefined) return false;
      clearT(h);
      timers.delete(id);
      return true;
    },
    flush() {
      const ids = [...timers.keys()];
      for (const h of timers.values()) clearT(h);
      timers.clear();
      if (ids.length) opts.commit(ids);
      return ids;
    },
    pending: () => [...timers.keys()],
  };
}

/** Body of the keep-alive request sent when the page is left with deletes still pending. */
export function parseRemoveIds(body: unknown): string[] | null {
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50) return null;
  if (!ids.every((x) => typeof x === "string" && /^[a-z0-9]{10,40}$/i.test(x))) return null;
  return [...new Set(ids as string[])];
}
