import { Banknote } from "lucide-react";
import { formatBandK, type SalaryEstimate } from "@/lib/salary/estimate";
import type { SalaryStrings } from "@/lib/i18n/salary";
import { cn } from "@/lib/utils";

/** Compact "₪32–42K · הערכה" chip for job cards. */
export function SalaryChip({
  estimate,
  s,
  className,
}: {
  estimate: SalaryEstimate;
  s: SalaryStrings;
  className?: string;
}) {
  const posted = estimate.basis === "posted";
  const band = formatBandK(estimate);
  const tag = posted ? s.chipPosted : s.chipEstimate;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[0.8rem] leading-5",
        posted ? "border-fit/40 bg-fit-soft text-foreground" : "border-border bg-card text-foreground/85",
        className,
      )}
      aria-label={`${s.chipAria}: ${band} (${tag}, ${s.confidence[estimate.confidence]})`}
      title={`${s.confidence[estimate.confidence]} · ${s.monthlyGross}`}
    >
      <Banknote className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
      <bdi className="font-mono font-semibold tabular-nums" dir="ltr">
        {band}
      </bdi>
      <span aria-hidden className="text-border">
        ·
      </span>
      <span className={cn("text-[0.74rem]", posted ? "text-fit font-semibold" : "text-muted-foreground")}>{tag}</span>
    </span>
  );
}
