"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { addConcept } from "@/app/learn/concepts/actions";
import type { ConceptKind } from "@/lib/concepts/core";
import { cn } from "@/lib/utils";

export interface ChipItem {
  name: string;
  kind?: ConceptKind;
  companyId?: string | null;
  parentId?: string | null;
  skill?: string | null;
  source?: string;
  category?: string | null;
  /** Already in the user's glossary → plain link. */
  existingId?: string | null;
  hint?: string;
}

/** Clickable concept chips: open an existing concept, or create it (idempotent) and open it. */
export function SuggestionChips({
  items,
  signedIn = true,
  className,
  testId,
}: {
  items: ChipItem[];
  signedIn?: boolean;
  className?: string;
  testId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  if (items.length === 0) return null;

  function open(it: ChipItem) {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setBusy(it.name);
    start(async () => {
      const r = await addConcept({
        name: it.name,
        kind: it.kind ?? "TECH",
        companyId: it.companyId ?? null,
        parentId: it.parentId ?? null,
        skill: it.skill ?? null,
        source: it.source ?? "suggested",
        category: it.category ?? null,
      });
      if (r.ok) router.push(`/learn/concepts/${r.id}`);
      else setBusy(null);
    });
  }

  const chip =
    "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors";
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} data-testid={testId}>
      {items.map((it) => (
        <li key={`${it.companyId ?? ""}:${it.name}`} className="max-w-full">
          {it.existingId ? (
            <Link
              href={`/learn/concepts/${it.existingId}`}
              title={it.hint}
              className={cn(chip, "bg-accent/60 text-accent-foreground hover:bg-accent border-transparent")}
            >
              <bdi dir="auto" className="truncate">
                {it.name}
              </bdi>
              <ArrowLeft className="size-3.5 shrink-0 ltr:rotate-180" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => open(it)}
              disabled={busy !== null}
              title={it.hint}
              className={cn(chip, "bg-background hover:bg-secondary disabled:opacity-60")}
            >
              {busy === it.name ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-3.5 shrink-0" aria-hidden />
              )}
              <bdi dir="auto" className="truncate">
                {it.name}
              </bdi>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
