"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/commute/keys";
import type { TransitRoute } from "@/lib/commute/types";
import type { JobsMapStrings } from "@/lib/i18n/jobs-map";
import type { Locale } from "@/lib/i18n/dictionaries";
import { TransitRouteView } from "./TransitRoute";

type State = { status: "loading" } | { status: "done"; route: TransitRoute | null; unavailable: boolean };

const memo = new Map<string, State>();

/** Fetches and shows the public-transport leg breakdown for one destination (map panel). */
export function TransitRouteLazy({
  from,
  to,
  dep,
  s,
  locale,
}: {
  from: LatLng;
  to: LatLng;
  dep?: string;
  s: JobsMapStrings;
  locale: Locale;
}) {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}|${dep ?? ""}`;
  const [state, setState] = useState<State>(() => memo.get(key) ?? { status: "loading" });
  useEffect(() => {
    const cached = memo.get(key);
    if (cached) {
      setState(cached);
      return;
    }
    setState({ status: "loading" });
    const ctrl = new AbortController();
    const qs = new URLSearchParams({
      from: `${from.lat.toFixed(5)},${from.lng.toFixed(5)}`,
      to: `${to.lat.toFixed(5)},${to.lng.toFixed(5)}`,
      ...(dep ? { dep } : {}),
    });
    fetch(`/api/commute/route?${qs}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { route: TransitRoute | null; status: string }) => {
        const next: State = { status: "done", route: j.route, unavailable: j.status === "unavailable" };
        if (!next.unavailable) memo.set(key, next);
        setState(next);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setState({ status: "done", route: null, unavailable: true });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.status === "loading")
    return (
      <p className="text-muted-foreground text-xs" aria-live="polite" data-testid="transit-route-loading">
        {s.routeLoading}
      </p>
    );
  if (state.route) return <TransitRouteView route={state.route} s={s} locale={locale} size="sm" />;
  return (
    <p className="text-muted-foreground text-xs" data-testid="transit-route-none">
      {state.unavailable ? s.routeUnavailable : s.noItinerary}
    </p>
  );
}
