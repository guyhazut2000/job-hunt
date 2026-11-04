"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** While a suggestion is being checked, refresh the server list every few seconds (max ~3 min). */
export function SuggestionsRefresher({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const id = setInterval(() => {
      if (++n > 36) return clearInterval(id);
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
