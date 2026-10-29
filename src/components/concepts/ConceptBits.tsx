import type { ConceptStatus } from "@/lib/concepts/core";
import type { ConceptStrings } from "@/lib/i18n/concepts";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<ConceptStatus, string> = {
  NEW: "bg-secondary text-foreground/80",
  LEARNING: "bg-caution-soft text-caution",
  UNDERSTOOD: "bg-fit-soft text-fit",
};

export function StatusBadge({ status, t }: { status: ConceptStatus; t: ConceptStrings }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_CLS[status] ?? STATUS_CLS.NEW)}>
      {t.status[status] ?? status}
    </span>
  );
}

export function ConfidenceDots({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label} title={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i <= value ? "bg-primary" : "bg-border")} />
      ))}
    </span>
  );
}
