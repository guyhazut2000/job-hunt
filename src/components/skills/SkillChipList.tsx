"use client";

import { CircleCheck, CircleDashed } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";
import { LIST_VISIBLE, collapse } from "@/lib/profile/skills-view";

export type SkillTone = "neutral" | "have" | "missing" | "highlight";

export interface SkillChipItem {
  label: string;
  tone?: SkillTone;
  title?: string;
}

const TONE: Record<SkillTone, string> = {
  neutral: "",
  highlight: "border-primary/40 bg-primary/10",
  have: "bg-fit-soft text-fit",
  missing: "bg-caution-soft text-caution border-caution/30 border-dashed",
};

/**
 * Read-only, wrapping list of skill chips that collapses to "+N more" past `visible`.
 * Follows the page direction (RTL in Hebrew) and isolates each name with <bdi>, so mixed
 * Hebrew/English names never reorder their neighbours.
 */
export function SkillChipList({
  items,
  label,
  more,
  less,
  visible = LIST_VISIBLE,
  testId,
  className,
}: {
  items: SkillChipItem[];
  /** accessible name of the list */
  label: string;
  /** "+{n} more" template */
  more: string;
  less: string;
  visible?: number;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (items.length === 0) return null;
  const { shown, hidden } = collapse(items, visible, open);
  const canToggle = items.length > visible + 1;
  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <ul id={listId} className="flex max-w-full flex-wrap gap-1.5" aria-label={label} data-testid={testId}>
        {shown.map((it) => (
          <li
            key={it.label}
            title={it.title}
            className={cn("chip max-w-full min-w-0 gap-1 py-1 text-[0.75rem]", TONE[it.tone ?? "neutral"])}
          >
            {it.tone === "have" && <CircleCheck className="size-3 shrink-0" aria-hidden />}
            {it.tone === "missing" && <CircleDashed className="size-3 shrink-0" aria-hidden />}
            <bdi className="truncate">{it.label}</bdi>
          </li>
        ))}
      </ul>
      {canToggle && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-primary/40 -my-1 inline-flex min-h-11 items-center rounded-md px-1 text-xs font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-3"
          data-testid={testId ? `${testId}-toggle` : undefined}
        >
          {open ? less : more.replace("{n}", String(hidden))}
        </button>
      )}
    </div>
  );
}
