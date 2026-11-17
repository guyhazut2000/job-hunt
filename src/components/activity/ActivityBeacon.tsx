"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { PAGE_VIEW_DEDUPE_MS } from "@/lib/activity/types";

const KEY = "jh_av";

/** Sends one tiny beacon per page view (signed-in users only; rendered by the root layout). */
export function ActivityBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin/activity")) return;
    try {
      const last = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as { p: string; t: number } | null;
      const now = Date.now();
      if (last && last.p === pathname && now - last.t < PAGE_VIEW_DEDUPE_MS) return;
      sessionStorage.setItem(KEY, JSON.stringify({ p: pathname, t: now }));
      const body = JSON.stringify({ path: pathname });
      if (!navigator.sendBeacon?.("/api/activity", body)) {
        void fetch("/api/activity", { method: "POST", body, keepalive: true }).catch(() => {});
      }
    } catch {
      // logging must never break the page
    }
  }, [pathname]);
  return null;
}
