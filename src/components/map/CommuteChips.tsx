import { Car, TramFront } from "lucide-react";
import { MODES, type CommuteMode } from "@/lib/commute/keys";
import type { CommuteResult, CommuteValue } from "@/lib/commute/types";
import { fillN, formatDuration, type JobsMapStrings } from "@/lib/i18n/jobs-map";
import { cn } from "@/lib/utils";

const ICONS = { car: Car, transit: TramFront } as const;

/** "25–40 min" for car (free-flow – typical traffic), "45 min" otherwise; "≈" marks an estimate. */
export function commuteText(mode: CommuteMode, v: CommuteValue | undefined, s: JobsMapStrings): string {
  if (!v || v.seconds == null) return s.noRoute;
  const text = rangeText(mode, v as CommuteValue & { seconds: number }, s);
  return v.source === "estimate" ? `≈ ${text}` : text;
}

function rangeText(mode: CommuteMode, v: CommuteValue & { seconds: number }, s: JobsMapStrings): string {
  const base = formatDuration(v.seconds, s);
  if (mode === "car" && v.peakSeconds && v.peakSeconds - v.seconds >= 120) {
    const hi = Math.round(v.peakSeconds / 60);
    const lo = Math.max(1, Math.round(v.seconds / 60));
    return hi < 60 ? fillN(s.minutes, { n: `${lo}–${hi}` }) : `${base}–${formatDuration(v.peakSeconds, s)}`;
  }
  return base;
}

/**
 * Car / public-transport travel-time chips. Pure markup (no hooks) so it renders on the server (job
 * cards, job page) and inside the client map panel alike.
 */
export function CommuteChips({
  commute,
  s,
  active,
  size = "md",
  className,
}: {
  commute: CommuteResult | undefined;
  s: JobsMapStrings;
  /** Mode the list is filtered/sorted by (highlighted). */
  active?: CommuteMode;
  size?: "sm" | "md";
  className?: string;
}) {
  if (!commute || !MODES.some((m) => commute[m])) return null;
  const estimates = MODES.map((m) => commute[m]).filter((v) => v?.source === "estimate");
  const estimateTitle = estimates.some((v) => v?.estimateReason !== "no-route") ? s.estimateNote : s.estimateNoRoute;
  return (
    <ul
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label={s.commute}
      data-testid="commute-chips"
    >
      {MODES.filter((m) => commute[m]).map((m) => {
        const v = commute[m];
        const Icon = ICONS[m];
        const transfers =
          m !== "car" && v?.seconds != null && v.source !== "estimate" && v.transfers != null
            ? v.transfers === 0
              ? s.direct
              : v.transfers === 1
                ? s.transfer1
                : fillN(s.transfers, { n: v.transfers })
            : null;
        return (
          <li
            key={m}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border font-semibold tabular-nums",
              size === "sm" ? "min-h-7 px-2 text-xs" : "min-h-8 px-2.5 text-sm",
              v?.seconds == null || v.source === "estimate" ? "text-muted-foreground border-dashed" : "bg-card",
              active === m && "border-primary bg-primary/10 text-foreground",
            )}
            title={
              v?.source === "estimate"
                ? v.estimateReason === "no-route"
                  ? s.estimateNoRoute
                  : s.estimateNote
                : m === "car"
                  ? s.trafficNote
                  : (transfers ?? undefined)
            }
            data-mode={m}
            data-source={v?.source}
          >
            <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
            <span className="sr-only">{s.modes[m]}:</span>
            <span>{commuteText(m, v, s)}</span>
            {transfers && size === "md" && <span className="text-muted-foreground font-normal">· {transfers}</span>}
          </li>
        );
      })}
      {estimates.length > 0 && (
        <li className="text-muted-foreground text-xs" title={estimateTitle}>
          ({s.estimate})
        </li>
      )}
    </ul>
  );
}
