"use client";

import { Check, MailCheck, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { undoEmailAutoChange } from "@/app/email-actions";
import { Button } from "@/components/ui/button";
import type { RecentAuto, TimelineEntry } from "@/lib/email/history";
import { cn } from "@/lib/utils";

export type AutoLabels = {
  badge: string;
  undo: string;
  undone: string;
  undoConflict: string;
  undoAria: string;
  timeline: string;
  created: string;
  autoCreated: string;
  autoMoved: string;
  source: Record<string, string>;
  /** "Follow-up #{n} sent" — timeline label for follow-ups the user marked as sent. */
  followUpSent?: string;
};

/** One-click undo for an automatic email change. */
export function AutoUndoButton({
  changeId,
  company,
  labels,
  className,
}: {
  changeId: string;
  company: string;
  labels: AutoLabels;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  if (result === "restore" || result === "delete" || result === "noop")
    return (
      <span role="status" className="text-muted-foreground inline-flex items-center gap-1 text-xs font-semibold">
        <Check className="size-3.5" aria-hidden /> {labels.undone}
      </span>
    );
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={labels.undoAria.replace("{company}", company)}
        onClick={() =>
          start(async () => {
            const r = await undoEmailAutoChange(changeId);
            setResult(r.result);
            router.refresh();
          })
        }
      >
        <Undo2 aria-hidden /> {labels.undo}
      </Button>
      {result === "conflict" && (
        <span role="alert" className="text-caution text-xs">
          {labels.undoConflict}
        </span>
      )}
    </span>
  );
}

export function AutoBadge({ label }: { label: string }) {
  return (
    <span
      data-auto-badge
      className="bg-primary/10 text-primary inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
    >
      <MailCheck className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function describeChange(
  e: { from: string | null; to: string; followUp?: number },
  labels: AutoLabels,
  statusLabels: Record<string, string>,
) {
  if (e.followUp && labels.followUpSent) return labels.followUpSent.replace("{n}", String(e.followUp));
  return e.from
    ? labels.autoMoved.replace("{from}", statusLabels[e.from] ?? e.from).replace("{to}", statusLabels[e.to] ?? e.to)
    : labels.autoCreated.replace("{status}", statusLabels[e.to] ?? e.to);
}

/** Collapsible per-application status history. */
export function StatusTimeline({
  entries,
  labels,
  statusLabels,
}: {
  entries: TimelineEntry[];
  labels: AutoLabels;
  statusLabels: Record<string, string>;
}) {
  return (
    <details className="group text-xs">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer py-1 font-semibold">
        {labels.timeline} ({entries.length})
      </summary>
      <ol className="border-border mt-1 flex flex-col gap-1.5 border-s-2 ps-3">
        {[...entries].reverse().map((e) => (
          <li key={e.id} className={cn("flex flex-col", e.undone && "line-through opacity-60")}>
            <span className="text-foreground font-semibold">{describeChange(e, labels, statusLabels)}</span>
            <span className="text-muted-foreground">
              {labels.source[e.source] ?? e.source}
              {e.confidence != null && e.source !== "MANUAL" && e.source !== "FOLLOW_UP" ? ` · ${e.confidence}%` : ""} · {e.at}
              {e.undone ? ` · ${labels.undone}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Dashboard panel: what the email scan changed by itself recently, each with undo. */
export function AutoChangesPanel({
  items,
  labels,
  statusLabels,
  title,
  lead,
  confidenceLabel,
}: {
  items: RecentAuto[];
  labels: AutoLabels;
  statusLabels: Record<string, string>;
  title: string;
  lead: string;
  confidenceLabel: string;
}) {
  return (
    <section aria-labelledby="email-auto-h" className="flex flex-col gap-3" data-auto-panel>
      <div>
        <h2 id="email-auto-h" className="font-heading flex items-center gap-2 text-xl font-bold">
          <MailCheck className="text-primary size-5" aria-hidden />
          {title} <span className="text-muted-foreground font-mono text-base">({items.length})</span>
        </h2>
        <p className="text-muted-foreground text-sm">{lead}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((i) => (
          <li
            key={i.changeId}
            className="bg-card flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-4 py-3"
          >
            <div className="flex min-w-0 flex-col">
              <span className="font-semibold" dir="auto">
                {i.company} · {i.title}
              </span>
              <span className="text-muted-foreground text-sm">
                {describeChange(i, labels, statusLabels)}
                {i.confidence != null ? ` · ${confidenceLabel} ${i.confidence}%` : ""} · {i.at}
              </span>
            </div>
            {i.canUndo && <AutoUndoButton changeId={i.changeId} company={i.company} labels={labels} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
