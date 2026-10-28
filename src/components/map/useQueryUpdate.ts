"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/** Patch the current URL query (null deletes a key). Always resets pagination. */
export function useQueryUpdate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const update = useCallback(
    (changes: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      sp.delete("page");
      for (const [k, v] of Object.entries(changes)) {
        if (v == null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      const q = sp.toString();
      startTransition(() => router.push(q ? `${pathname}?${q}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );
  return { update, pending };
}
