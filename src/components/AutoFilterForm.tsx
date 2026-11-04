"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { buildFilterQuery, delayFor, sameQuery } from "@/lib/jobs/filter-query";

interface FilterApply {
  /** A debounced change is waiting or the new results are loading. */
  pending: boolean;
  /** Apply a waiting change right away (e.g. before closing the mobile sheet). */
  flush: () => void;
}
const Ctx = createContext<FilterApply>({ pending: false, flush: () => {} });
export const useFilterApply = () => useContext(Ctx);

/**
 * GET filter form that applies itself: every change re-navigates (router.replace, no reload, scroll
 * kept) after a short debounce. A newer change cancels the waiting timer, and Next drops a
 * superseded navigation, so only the last state is fetched. Without JS it's still a plain GET form.
 */
export function AutoFilterForm({ children, ...props }: React.ComponentProps<"form">) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.toString();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = useRef(current); // the query this form last navigated to
  const [waiting, setWaiting] = useState(false);
  const [loading, startTransition] = useTransition();
  const [gen, setGen] = useState(0);

  const apply = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setWaiting(false);
    const f = form.current;
    if (!f) return;
    const owned = new Set<string>();
    for (const el of Array.from(f.elements)) {
      const n = (el as HTMLInputElement).name;
      if (n) owned.add(n);
    }
    const entries = [...new FormData(f)].map(([k, v]) => [k, String(v)] as [string, string]);
    const q = buildFilterQuery(window.location.search, owned, entries);
    if (sameQuery(q, window.location.search)) return;
    mine.current = q.replace(/^\?/, "");
    startTransition(() => router.replace(`${pathname}${q}`, { scroll: false }));
  }, [pathname, router]);

  // A chip, "clear all" or the other copy of this form changed the URL: reset to the new defaults.
  useEffect(() => {
    if (timer.current || sameQuery(current, mine.current)) return;
    mine.current = current;
    setGen((g) => g + 1);
  }, [current]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-filter-pending", waiting || loading);
    return () => document.documentElement.removeAttribute("data-filter-pending");
  }, [waiting, loading]);

  const schedule = (e: React.FormEvent<HTMLFormElement>) => {
    const el = e.target as HTMLInputElement;
    if (!el.name) return; // list search boxes only narrow the visible options
    if (timer.current) clearTimeout(timer.current);
    setWaiting(true);
    timer.current = setTimeout(apply, delayFor(el));
  };

  return (
    <Ctx.Provider value={{ pending: waiting || loading, flush: apply }}>
      <form
        method="get"
        {...props}
        ref={form}
        aria-busy={waiting || loading}
        onChange={schedule}
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <FormBody key={gen}>{children}</FormBody>
      </form>
    </Ctx.Provider>
  );
}

function FormBody({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
