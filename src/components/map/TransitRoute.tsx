import { Bus, ChevronRight, Footprints, TrainFront, TramFront } from "lucide-react";
import type { TransitLeg, TransitRoute } from "@/lib/commute/types";
import { fillN, formatDuration, legsSummary, type JobsMapStrings } from "@/lib/i18n/jobs-map";
import type { Locale } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";

const LEG_ICONS: Record<TransitLeg["kind"], typeof Bus> = {
  walk: Footprints,
  bus: Bus,
  rail: TrainFront,
  light_rail: TramFront,
  subway: TramFront,
  other: TramFront,
};

export function clockTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(iso));
}

function transfersText(n: number, s: JobsMapStrings) {
  return n === 0 ? s.direct : n === 1 ? s.transfer1 : fillN(s.transfers, { n });
}

/**
 * Leg breakdown of one public-transport itinerary: walk → bus 18 → walk → train → walk, then
 * transfers, total walking and leave/arrive times. Pure markup (server job page + client panel).
 */
export function TransitRouteView({
  route,
  s,
  locale,
  size = "md",
  className,
}: {
  route: TransitRoute;
  s: JobsMapStrings;
  locale: Locale;
  size?: "sm" | "md";
  className?: string;
}) {
  const icon = size === "sm" ? "size-3.5" : "size-4";
  return (
    <div
      className={cn("flex flex-col gap-1", size === "sm" ? "text-xs" : "text-sm", className)}
      data-testid="transit-route"
      aria-label={`${s.route}: ${legsSummary(route.legs, s)}`}
    >
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
        {route.legs.map((l, i) => {
          const Icon = LEG_ICONS[l.kind];
          const walk = l.kind === "walk";
          return (
            <li key={i} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight className="text-muted-foreground size-3 rtl:rotate-180" aria-hidden />}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                  walk ? "text-muted-foreground" : "bg-muted font-semibold",
                )}
                title={`${s.legs[l.kind]}${l.line ? ` ${l.line}` : ""} · ${formatDuration(l.seconds, s)}`}
              >
                <Icon className={icon} aria-hidden />
                {walk ? (
                  <span className="tabular-nums">{formatDuration(l.seconds, s)}</span>
                ) : (
                  <span>
                    {s.legs[l.kind]}
                    {l.line && <span className="tabular-nums"> {l.line}</span>}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground tabular-nums">
        {transfersText(route.transfers, s)} · {fillN(s.walking, { t: formatDuration(route.walkSeconds, s) })} ·{" "}
        {fillN(s.departArrive, { dep: clockTime(route.departAt, locale), arr: clockTime(route.arriveAt, locale) })}
      </p>
    </div>
  );
}
